import test from 'node:test';
import assert from 'node:assert/strict';
import { createHourPlayback, createBell } from './myHourPlayback.mjs';
import { createSession, SONG_DURATION_MS } from './myHourSession.mjs';

const flush = async () => {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

function makeSession(count = 3, endless = false) {
  return createSession({
    ownerId: 'listener',
    playlist: { id: 'playlist', name: 'My playlist' },
    tracks: Array.from({ length: count }, (_, index) => ({
      uri: `spotify:track:track${index}`, name: `Song ${index}`, artists: 'Artist',
      imageUrl: '', durationMs: 180_000,
    })),
    shuffle: false,
    endless,
  });
}

function fixture(t, options = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: 1_000_000 });
  const events = [];
  const errors = [];
  const completions = [];
  let position = 0;
  let playingSince = null;
  let uri = '';
  let disconnected = false;
  const transport = {
    activate: async () => {},
    prepare: async () => {},
    play: async (track, start) => {
      events.push(['play', track.uri, start]);
      uri = track.uri;
      position = start;
      playingSince = Date.now();
    },
    pause: async () => {
      events.push(['pause', Date.now()]);
      if (playingSince !== null) position += Date.now() - playingSince;
      playingSince = null;
    },
    getState: async () => uri ? ({
      paused: playingSince === null,
      position: position + (playingSince === null ? 0 : Date.now() - playingSince),
      track_window: { current_track: { uri } },
    }) : null,
    disconnect: () => { disconnected = true; playingSince = null; events.push(['disconnect']); },
    ...options.transport,
  };
  const bell = {
    activate: async () => {},
    ring: async () => { events.push(['bell']); },
    stop: () => {},
    ...options.bell,
  };
  const player = createHourPlayback({
    transport,
    bell,
    initialSession: options.initialSession,
    now: Date.now,
    onChange: snapshot => events.push(['snapshot', snapshot]),
    onError: error => errors.push(error),
    onComplete: session => completions.push(session),
  });
  t.after(() => player.dispose());
  return {
    player, transport, events, errors, completions,
    isDisconnected: () => disconnected,
    advance: async ms => { t.mock.timers.tick(ms); await flush(); },
  };
}

test('exact threshold: no pause at 59,999 ms; pause, ding, then song 2 at 60,000 ms', async t => {
  const f = fixture(t);
  await f.player.start(makeSession());
  assert.equal(f.player.getSnapshot().phase, 'playing');
  await f.advance(59_999);
  assert.equal(f.events.filter(event => event[0] === 'pause').length, 0);
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
  await f.advance(1);
  assert.deepEqual(f.events.filter(event => ['play', 'pause', 'bell'].includes(event[0])).map(event => event[0]),
    ['play', 'pause', 'bell', 'play']);
  assert.equal(f.player.getSnapshot().session.songNumber, 2);
  assert.equal(f.player.getSnapshot().session.elapsedMs, 0);
  assert.equal(f.errors.length, 0);
});

test('the countdown starts from confirmed playback, not a slow play request', async t => {
  const request = deferred();
  let audible = false;
  const f = fixture(t, { transport: {
    play: () => request.promise,
    getState: async () => audible ? {
      paused: false, position: 0, track_window: { current_track: { uri: 'spotify:track:track0' } },
    } : null,
  } });
  const starting = f.player.start(makeSession());
  await flush();
  await f.advance(9000);
  assert.equal(f.player.getSnapshot().phase, 'starting');
  assert.equal(f.player.getSnapshot().session.elapsedMs, 0);
  audible = true;
  request.resolve();
  await starting;
  assert.equal(f.player.getSnapshot().phase, 'playing');
  assert.equal(f.player.getSnapshot().session.elapsedMs, 0);
});

test('manual and external pauses preserve the remaining portion of the minute', async t => {
  const f = fixture(t);
  await f.player.start(makeSession());
  await f.advance(22_500);
  await f.player.pause();
  assert.equal(f.player.getSnapshot().session.elapsedMs, 22_500);
  await f.advance(120_000);
  assert.equal(f.player.getSnapshot().session.elapsedMs, 22_500);
  await f.player.start();
  assert.equal(f.events.filter(event => event[0] === 'play').at(-1)[2], 22_500);
  await f.advance(37_499);
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
  await f.advance(1);
  assert.equal(f.player.getSnapshot().session.songNumber, 2);
  await f.advance(3000);
  await f.transport.pause();
  f.player.handleState(await f.transport.getState());
  assert.equal(f.player.getSnapshot().phase, 'paused');
  assert.equal(f.player.getSnapshot().session.elapsedMs, 3000);
});

test('refresh restores a paused song without autoplay and resumes at its saved position', async t => {
  const saved = { ...makeSession(), elapsedMs: 41_250 };
  const f = fixture(t, { initialSession: saved });
  await f.advance(90_000);
  assert.equal(f.player.getSnapshot().phase, 'paused');
  assert.equal(f.events.filter(event => event[0] === 'play').length, 0);
  await f.player.start();
  assert.equal(f.events.find(event => event[0] === 'play')[2], 41_250);
  await f.advance(18_750);
  assert.equal(f.player.getSnapshot().session.songNumber, 2);
});

for (const count of [1, 4, 60, 75]) {
  test(`playback stops and celebrates exactly once after ${Math.min(count, 60)} of ${count} songs`, async t => {
    const f = fixture(t);
    await f.player.start(makeSession(count));
    for (let index = 0; index < Math.min(count, 60); index += 1) await f.advance(SONG_DURATION_MS);
    assert.equal(f.player.getSnapshot().phase, 'finished');
    assert.equal(f.player.getSnapshot().session.songNumber, Math.min(count, 60));
    assert.equal(f.events.filter(event => event[0] === 'play').length, Math.min(count, 60));
    assert.equal(f.completions.length, 1);
    await f.advance(180_000);
    assert.equal(f.completions.length, 1);
    await f.player.start(makeSession(count));
    assert.equal(f.player.getSnapshot().session.songNumber, 1);
    assert.equal(f.player.getSnapshot().phase, 'playing');
    assert.equal(f.errors.length, 0);
  });
}

test('endless playback keeps playing past 60 and never fires completion confetti', async t => {
  const f = fixture(t);
  await f.player.start(makeSession(3, true));
  for (let index = 0; index < 65; index += 1) await f.advance(SONG_DURATION_MS);
  assert.equal(f.player.getSnapshot().session.songNumber, 66);
  assert.equal(f.player.getSnapshot().phase, 'playing');
  assert.equal(f.completions.length, 0);
  assert.equal(f.events.filter(event => event[0] === 'play').length, 66);
});

test('the next song waits for the bell, and duplicate boundary events cannot advance twice', async t => {
  const ringing = deferred();
  const f = fixture(t, { bell: { ring: () => ringing.promise } });
  await f.player.start(makeSession());
  await f.advance(SONG_DURATION_MS);
  assert.equal(f.player.getSnapshot().phase, 'transition');
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
  f.player.handleState({
    paused: false, position: SONG_DURATION_MS, track_window: { current_track: { uri: 'spotify:track:track0' } },
  });
  await f.advance(5000);
  assert.equal(f.events.filter(event => event[0] === 'play').length, 1);
  ringing.resolve();
  await flush();
  assert.equal(f.player.getSnapshot().session.songNumber, 2);
});

test('failed pause stops the player without a ding, completion, or advancing the counter', async t => {
  const f = fixture(t, { transport: { pause: async () => { throw new Error('Pause failed'); } } });
  await f.player.start(makeSession());
  await f.advance(SONG_DURATION_MS);
  assert.equal(f.player.getSnapshot().phase, 'error');
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
  assert.equal(f.isDisconnected(), true);
  assert.equal(f.events.filter(event => event[0] === 'bell').length, 0);
  assert.equal(f.completions.length, 0);
  assert.match(f.errors[0].message, /Pause failed/);
});

test('unmount/reset during a bell cannot start the next song', async t => {
  const ringing = deferred();
  const f = fixture(t, { bell: { ring: () => ringing.promise } });
  await f.player.start(makeSession());
  await f.advance(SONG_DURATION_MS);
  f.player.dispose();
  ringing.resolve();
  await flush();
  assert.equal(f.events.filter(event => event[0] === 'play').length, 1);
  assert.equal(f.completions.length, 0);
  assert.equal(f.isDisconnected(), true);
});

test('a late play request is followed by pause, never by an automatic restart', async t => {
  const request = deferred();
  const f = fixture(t, { transport: { play: () => request.promise } });
  const starting = f.player.start(makeSession());
  await flush();
  const pausing = f.player.pause();
  request.resolve();
  await Promise.all([starting, pausing]);
  assert.equal(f.player.getSnapshot().phase, 'paused');
  assert.equal(f.events.filter(event => event[0] === 'pause').length, 1);
  await f.advance(120_000);
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
});

test('an autoplay timeout surfaces an error without advancing', async t => {
  const f = fixture(t, { transport: { getState: async () => null } });
  await f.player.start(makeSession());
  await f.advance(15_000);
  assert.match(f.errors[0].message, /did not start/);
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
  assert.equal(f.isDisconnected(), true);
});

test('seeking cannot silently consume a turn', async t => {
  const f = fixture(t);
  await f.player.start(makeSession());
  f.player.handleState({
    paused: false, position: 45_000, track_window: { current_track: { uri: 'spotify:track:track0' } },
  });
  assert.equal(f.player.getSnapshot().phase, 'error');
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
  assert.match(f.errors[0].message, /position changed/);
});

test('device loss and external track changes preserve the current turn', async t => {
  const f = fixture(t);
  await f.player.start(makeSession());
  await f.advance(12_000);
  f.player.handleState(null);
  assert.equal(f.player.getSnapshot().phase, 'error');
  assert.equal(f.player.getSnapshot().session.elapsedMs, 12_000);
  assert.match(f.errors[0].message, /disconnected/);
  await f.player.start();
  f.player.handleState({
    paused: false, position: 0, track_window: { current_track: { uri: 'spotify:track:elsewhere' } },
  });
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
  assert.match(f.errors[1].message, /song was changed/);
});

test('restoring a completed minute reconnects the device before advancing, without replaying that song', async t => {
  let prepared = false;
  const f = fixture(t, {
    initialSession: { ...makeSession(), elapsedMs: SONG_DURATION_MS },
    transport: {
      prepare: async () => { prepared = true; },
      pause: async () => { assert.equal(prepared, true); },
    },
  });
  await f.player.start();
  assert.equal(f.player.getSnapshot().session.songNumber, 2);
  assert.equal(f.events.filter(event => event[0] === 'play').length, 1);
  assert.equal(f.events.find(event => event[0] === 'play')[1], 'spotify:track:track1');
});

test('bell failure cannot continue silently or start overlapping Spotify audio', async t => {
  const f = fixture(t, { bell: { ring: async () => { throw new Error('Audio suspended'); } } });
  await f.player.start(makeSession());
  await f.advance(SONG_DURATION_MS);
  assert.equal(f.player.getSnapshot().phase, 'error');
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
  assert.equal(f.events.filter(event => event[0] === 'play').length, 1);
  assert.equal(f.isDisconnected(), true);
  assert.match(f.errors[0].message, /Audio suspended/);
});

test('a track ending naturally at exactly one minute completes its turn', async t => {
  const f = fixture(t);
  const saved = makeSession(1);
  saved.tracks[0].durationMs = SONG_DURATION_MS;
  await f.player.start(saved);
  await f.advance(59_500);
  f.player.handleState({
    paused: true, position: 0, track_window: { current_track: { uri: 'spotify:track:track0' } },
  });
  await flush();
  assert.equal(f.player.getSnapshot().phase, 'finished');
  assert.equal(f.completions.length, 1);
});

test('a cancelled bell cannot terminate the next bell through a stale audio event', async t => {
  const oscillators = [];
  const context = {
    state: 'running', currentTime: 0, destination: {},
    resume: async () => {},
    close: async () => {},
    createOscillator: () => {
      const node = { frequency: {}, connect() {}, disconnect() {}, start() {}, stop() {}, onended: null };
      oscillators.push(node);
      return node;
    },
    createGain: () => ({
      gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {}, disconnect() {},
    }),
  };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { AudioContext: function () { return context; } },
  });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  });
  const bell = createBell();
  await bell.activate();
  const first = bell.ring();
  bell.stop();
  await first;
  let ended = false;
  const second = bell.ring().then(() => { ended = true; });
  oscillators[2].onended();
  await flush();
  assert.equal(ended, false);
  oscillators[5].onended();
  await second;
  assert.equal(ended, true);
  await bell.dispose();
});
