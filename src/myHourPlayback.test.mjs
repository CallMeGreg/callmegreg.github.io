import test from 'node:test';
import assert from 'node:assert/strict';
import { createHourPlayback, createCanOpeningSound } from './myHourPlayback.mjs';
import { changeSessionPlaylist, createSession, SONG_DURATION_MS } from './myHourSession.mjs';

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
  const cue = {
    activate: async () => {},
    play: async () => { events.push(['cue']); },
    stop: () => {},
    ...options.cue,
  };
  const player = createHourPlayback({
    transport,
    cue,
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

test('exact threshold: no pause at 59,999 ms; pause, can opening, then song 2 at 60,000 ms', async t => {
  const f = fixture(t);
  await f.player.start(makeSession());
  assert.equal(f.player.getSnapshot().phase, 'playing');
  await f.advance(59_999);
  assert.equal(f.events.filter(event => event[0] === 'pause').length, 0);
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
  await f.advance(1);
  assert.deepEqual(f.events.filter(event => ['play', 'pause', 'cue'].includes(event[0])).map(event => event[0]),
    ['play', 'pause', 'cue', 'play']);
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

test('the next song waits for the can opening, and duplicate boundary events cannot advance twice', async t => {
  const ringing = deferred();
  const f = fixture(t, { cue: { play: () => ringing.promise } });
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

test('failed pause stops the player without a cue, completion, or advancing the counter', async t => {
  const f = fixture(t, { transport: { pause: async () => { throw new Error('Pause failed'); } } });
  await f.player.start(makeSession());
  await f.advance(SONG_DURATION_MS);
  assert.equal(f.player.getSnapshot().phase, 'error');
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
  assert.equal(f.isDisconnected(), true);
  assert.equal(f.events.filter(event => event[0] === 'cue').length, 0);
  assert.equal(f.completions.length, 0);
  assert.match(f.errors[0].message, /Pause failed/);
});

test('unmount/reset during a can opening cannot start the next song', async t => {
  const ringing = deferred();
  const f = fixture(t, { cue: { play: () => ringing.promise } });
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

test('can-opening failure cannot continue silently or start overlapping Spotify audio', async t => {
  const f = fixture(t, { cue: { play: async () => { throw new Error('Audio suspended'); } } });
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

test('clearing an hour stops playback and waits for a new Start', async t => {
  const f = fixture(t);
  await f.player.start(makeSession());
  await f.advance(22_000);
  await f.player.clearSession();
  assert.deepEqual(f.player.getSnapshot(), { phase: 'idle', session: null });
  assert.equal(f.isDisconnected(), false);
  await f.advance(120_000);
  assert.equal(f.events.filter(event => event[0] === 'play').length, 1);
  assert.equal(f.events.filter(event => event[0] === 'cue').length, 0);

  const next = makeSession(5);
  next.playlist = { id: 'new', name: 'New playlist' };
  next.tracks[0].uri = 'spotify:track:new';
  await f.player.start(next);
  assert.equal(f.player.getSnapshot().phase, 'playing');
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
  assert.equal(f.player.getSnapshot().session.elapsedMs, 0);
  assert.deepEqual(f.events.filter(event => event[0] === 'play').at(-1), ['play', 'spotify:track:new', 0]);
});

for (const phase of ['playing', 'paused']) {
  test(`switching a ${phase} playlist keeps song 3, resets to 1:00, and waits for Resume`, async t => {
    const f = fixture(t);
    await f.player.start(makeSession(10));
    await f.advance(SONG_DURATION_MS);
    await f.advance(SONG_DURATION_MS);
    await f.advance(22_000);
    if (phase === 'paused') await f.player.pause();
    const next = makeSession(5);
    next.playlist = { id: 'new', name: 'New playlist' };
    next.tracks[0].uri = 'spotify:track:new';
    await f.player.replaceSession(changeSessionPlaylist(f.player.getSnapshot().session, next));
    assert.equal(f.player.getSnapshot().phase, 'paused');
    assert.equal(f.player.getSnapshot().session.songNumber, 3);
    assert.equal(f.player.getSnapshot().session.elapsedMs, 0);
    assert.equal(f.player.getSnapshot().session.index, 0);
    const snapshot = f.player.getSnapshot();
    await f.advance(120_000);
    assert.deepEqual(f.player.getSnapshot(), snapshot);
    assert.equal(f.events.filter(event => event[0] === 'play').length, 3);
    assert.equal(f.events.filter(event => event[0] === 'cue').length, 2);
    await f.player.start();
    assert.deepEqual(f.events.filter(event => event[0] === 'play').at(-1), ['play', 'spotify:track:new', 0]);
    await f.advance(59_999);
    assert.equal(f.player.getSnapshot().session.songNumber, 3);
    await f.advance(1);
    assert.equal(f.player.getSnapshot().session.songNumber, 4);
    assert.equal(f.errors.length, 0);
  });
}

test('a switched playlist restored after refresh resumes the saved count and new track at zero', async t => {
  const previous = { ...makeSession(10), songNumber: 7, index: 6, elapsedMs: 28_000 };
  const saved = changeSessionPlaylist(previous, makeSession(2));
  const f = fixture(t, { initialSession: saved });
  assert.equal(f.player.getSnapshot().phase, 'paused');
  assert.equal(f.player.getSnapshot().session.songNumber, 7);
  await f.player.start();
  assert.equal(f.events.find(event => event[0] === 'play')[2], 0);
  await f.advance(SONG_DURATION_MS);
  assert.equal(f.player.getSnapshot().session.songNumber, 8);
  await f.advance(SONG_DURATION_MS);
  assert.equal(f.player.getSnapshot().phase, 'finished');
  assert.equal(f.completions.length, 1);
});

for (const command of ['prepare', 'play']) {
  test(`replacing a playlist settles a pending ${command} before saving the paused replacement`, async t => {
    const request = deferred();
    const f = fixture(t, { transport: { [command]: () => request.promise } });
    const starting = f.player.start(makeSession());
    await flush();
    const next = changeSessionPlaylist(f.player.getSnapshot().session, makeSession(2));
    const replacing = f.player.replaceSession(next);
    await flush();
    assert.equal(f.events.filter(event => event[0] === 'pause').length, 0);
    request.resolve();
    await Promise.all([starting, replacing]);
    assert.equal(f.events.filter(event => event[0] === 'pause').length, 1);
    assert.deepEqual(f.player.getSnapshot(), { phase: 'paused', session: next });
    await f.advance(120_000);
    assert.deepEqual(f.player.getSnapshot(), { phase: 'paused', session: next });
  });
}

test('a failed playlist replacement preserves the old queue, counter, and elapsed time', async t => {
  const f = fixture(t, { transport: { pause: async () => { throw new Error('Pause failed'); } } });
  await f.player.start(makeSession());
  await f.advance(20_000);
  const next = changeSessionPlaylist(f.player.getSnapshot().session, makeSession(2));
  await assert.rejects(f.player.replaceSession(next), /could not stop/);
  assert.equal(f.player.getSnapshot().session.tracks.length, 3);
  assert.equal(f.player.getSnapshot().session.songNumber, 1);
  assert.equal(f.player.getSnapshot().session.elapsedMs, 20_000);
  assert.equal(f.player.getSnapshot().phase, 'error');
});

test('signing out pauses and disconnects without losing the saved minute or allowing late audio', async t => {
  const f = fixture(t);
  await f.player.start(makeSession());
  await f.advance(SONG_DURATION_MS);
  await f.advance(23_000);
  await f.player.pause();
  const saved = f.player.getSnapshot();
  f.player.dispose();
  await f.advance(120_000);
  assert.equal(f.isDisconnected(), true);
  assert.deepEqual(f.player.getSnapshot(), saved);
  assert.equal(saved.session.songNumber, 2);
  assert.equal(saved.session.elapsedMs, 23_000);
  assert.equal(f.events.filter(event => event[0] === 'play').length, 2);
});

for (const phase of ['paused', 'finished']) {
  test(`a ${phase} hour can be cleared without starting audio`, async t => {
    const saved = makeSession(1);
    if (phase === 'finished') {
      saved.completed = true;
      saved.elapsedMs = SONG_DURATION_MS;
    }
    const f = fixture(t, { initialSession: saved });
    assert.equal(f.player.getSnapshot().phase, phase);
    await f.player.clearSession();
    assert.deepEqual(f.player.getSnapshot(), { phase: 'idle', session: null });
    assert.equal(f.events.filter(event => event[0] === 'play').length, 0);
  });
}

test('clearing a playlist waits for an already pending pause', async t => {
  const request = deferred();
  const f = fixture(t, { transport: { pause: () => request.promise } });
  await f.player.start(makeSession());
  const pausing = f.player.pause();
  const clearing = f.player.clearSession();
  await flush();
  assert.equal(f.player.getSnapshot().phase, 'pausing');
  assert.ok(f.player.getSnapshot().session);
  request.resolve();
  await Promise.all([pausing, clearing]);
  assert.deepEqual(f.player.getSnapshot(), { phase: 'idle', session: null });
});

for (const command of ['prepare', 'play']) {
  test(`clearing a playlist settles a late ${command} before pausing and discarding progress`, async t => {
    const request = deferred();
    const f = fixture(t, { transport: { [command]: () => request.promise } });
    const starting = f.player.start(makeSession());
    await flush();
    const clearing = f.player.clearSession();
    await flush();
    assert.equal(f.events.filter(event => event[0] === 'pause').length, 0);
    request.resolve();
    await Promise.all([starting, clearing]);
    assert.equal(f.events.filter(event => event[0] === 'pause').length, 1);
    assert.deepEqual(f.player.getSnapshot(), { phase: 'idle', session: null });
    await f.advance(120_000);
    assert.deepEqual(f.player.getSnapshot(), { phase: 'idle', session: null });
  });
}

test('clearing a playlist cancels its cue without advancing the old hour', async t => {
  const sound = deferred();
  const f = fixture(t, { cue: { play: () => sound.promise } });
  await f.player.start(makeSession());
  await f.advance(SONG_DURATION_MS);
  await f.player.clearSession();
  sound.resolve();
  await flush();
  assert.deepEqual(f.player.getSnapshot(), { phase: 'idle', session: null });
  assert.equal(f.events.filter(event => event[0] === 'play').length, 1);
  assert.equal(f.completions.length, 0);
});

test('a failed playlist change preserves progress and reports the failure', async t => {
  const f = fixture(t, { transport: { pause: async () => { throw new Error('Pause failed'); } } });
  await f.player.start(makeSession());
  await f.advance(20_000);
  await assert.rejects(f.player.clearSession(), /could not stop the current hour/);
  assert.equal(f.player.getSnapshot().session.elapsedMs, 20_000);
  assert.equal(f.player.getSnapshot().phase, 'error');
  assert.equal(f.isDisconnected(), true);
  assert.match(f.errors[0].message, /Pause failed/);
});

function audioFixture(t) {
  const sources = [];
  const buffer = { duration: 1.6 };
  const context = {
    state: 'running', currentTime: 0, destination: {},
    resume: async () => {},
    close: async () => { context.state = 'closed'; },
    decodeAudioData: async () => buffer,
    createBufferSource: () => {
      const node = {
        connect: t.mock.fn(), disconnect: t.mock.fn(), start: t.mock.fn(), stop: t.mock.fn(), onended: null,
      };
      sources.push(node);
      return node;
    },
  };
  const fetchSound = t.mock.method(globalThis, 'fetch', async () => new Response(new ArrayBuffer(8)));
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { AudioContext: function () { return context; } },
  });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  });
  const cue = createCanOpeningSound();
  t.after(() => cue.dispose());
  return { cue, sources, buffer, context, fetchSound };
}

test('can-opening audio loads once and plays the full recording at unity gain', async t => {
  const { cue, sources, buffer, context, fetchSound } = audioFixture(t);
  await cue.activate();
  await cue.activate();
  assert.equal(fetchSound.mock.callCount(), 1);
  assert.equal(fetchSound.mock.calls[0].arguments[0], '/sounds/can-opening.mp3');
  let ended = false;
  const playing = cue.play().then(() => { ended = true; });
  assert.equal(sources[0].buffer, buffer);
  assert.deepEqual(sources[0].connect.mock.calls[0].arguments, [context.destination]);
  assert.deepEqual(sources[0].start.mock.calls[0].arguments, []);
  await flush();
  assert.equal(ended, false);
  sources[0].onended();
  await playing;
  assert.equal(sources[0].disconnect.mock.callCount(), 1);
});

test('a cancelled can opening cannot terminate the next cue through a stale audio event', async t => {
  const { cue, sources } = audioFixture(t);
  await cue.activate();
  const first = cue.play();
  cue.stop();
  await first;
  let ended = false;
  const second = cue.play().then(() => { ended = true; });
  sources[0].onended();
  await flush();
  assert.equal(ended, false);
  sources[1].onended();
  await second;
  assert.equal(ended, true);
  assert.equal(sources[0].stop.mock.callCount(), 1);
});

test('unavailable or invalid can audio fails explicitly and can be retried', async t => {
  const { cue, fetchSound, context } = audioFixture(t);
  fetchSound.mock.mockImplementationOnce(async () => new Response('', { status: 404 }));
  await assert.rejects(cue.activate(), /Could not load the can-opening sound.*HTTP 404/);
  const decode = t.mock.method(context, 'decodeAudioData', async () => { throw new Error('Invalid audio'); });
  await assert.rejects(cue.activate(), /Could not load the can-opening sound.*Invalid audio/);
  decode.mock.restore();
  await cue.activate();
  assert.equal(fetchSound.mock.callCount(), 3);
});

test('suspended can audio cannot be skipped silently and disposal stops an active cue', async t => {
  const { cue, context, sources } = audioFixture(t);
  await cue.activate();
  context.state = 'suspended';
  await assert.rejects(cue.play(), /audio was suspended/);
  await assert.rejects(cue.activate(), /audio is blocked/);
  context.state = 'running';
  const playing = cue.play();
  await cue.dispose();
  await playing;
  assert.equal(context.state, 'closed');
  assert.equal(sources[0].stop.mock.callCount(), 1);
  await assert.rejects(cue.activate(), /Reconnect the player/);
});
