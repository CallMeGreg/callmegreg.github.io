import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSession, createSession, currentTrack, defaultState, playableTracks,
  readSavedState, saveState, SONG_DURATION_MS, STATE_KEY,
} from './myHourSession.mjs';

function tracks(count) {
  return Array.from({ length: count }, (_, index) => ({
    uri: `spotify:track:track${index}`,
    name: `Song ${index}`,
    artists: 'Artist',
    imageUrl: '',
    durationMs: 180_000,
  }));
}

function session(count, options = {}) {
  return createSession({
    ownerId: 'listener',
    playlist: { id: 'playlist', name: 'My playlist' },
    tracks: tracks(count),
    shuffle: false,
    endless: false,
    ...options,
  });
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('defaults are shuffled, finite, and a new play always begins at song 1', () => {
  assert.equal(defaultState().shuffle, true);
  assert.equal(defaultState().endless, false);
  const first = session(100);
  assert.equal(first.songNumber, 1);
  assert.equal(first.elapsedMs, 0);
  assert.equal(currentTrack(first).name, 'Song 0');
  assert.equal(session(100).songNumber, 1);
});

for (const count of [1, 3, 59, 60, 61, 120]) {
  test(`a ${count}-song playlist finishes on ${Math.min(count, 60)}, never one later`, () => {
    let state = session(count);
    for (let played = 1; played <= Math.min(count, 60); played += 1) {
      assert.equal(state.songNumber, played);
      assert.equal(state.completed, false);
      state = advanceSession(state);
    }
    assert.equal(state.completed, true);
    assert.equal(state.songNumber, Math.min(count, 60));
    assert.equal(state.elapsedMs, SONG_DURATION_MS);
    assert.equal(advanceSession(state), state);
  });
}

test('endless mode passes song 60 and loops in playlist order', () => {
  let state = session(3, { endless: true });
  for (let number = 1; number <= 125; number += 1) {
    assert.equal(state.songNumber, number);
    assert.equal(state.index, (number - 1) % 3);
    assert.equal(currentTrack(state).name, `Song ${(number - 1) % 3}`);
    assert.equal(state.completed, false);
    state = advanceSession(state);
  }
});

test('shuffle is a permutation, exhausts the cycle, and reshuffles without a boundary repeat', () => {
  const source = tracks(8);
  let randomCalls = 0;
  const random = () => { randomCalls += 1; return 0; };
  let state = createSession({
    ownerId: 'listener', playlist: { id: 'p', name: 'Playlist' },
    tracks: source, shuffle: true, endless: true,
  }, random);
  const firstOrder = state.order.slice();
  assert.equal(randomCalls, 7);
  assert.equal(new Set(firstOrder).size, 8);
  assert.notDeepEqual(firstOrder, source.map((_, index) => index));
  for (let index = 0; index < 7; index += 1) state = advanceSession(state, random);
  const lastTrack = currentTrack(state).uri;
  state = advanceSession(state, random);
  assert.equal(randomCalls, 14);
  assert.equal(state.songNumber, 9);
  assert.notEqual(currentTrack(state).uri, lastTrack);
  assert.deepEqual(source, tracks(8));
});

test('one-track endless sessions keep looping without corrupting the order', () => {
  let state = session(1, { endless: true, shuffle: true });
  for (let index = 0; index < 65; index += 1) state = advanceSession(state);
  assert.equal(state.songNumber, 66);
  assert.deepEqual(state.order, [0]);
});

test('playlist filtering includes exactly 60-second tracks and preserves duplicate entries', () => {
  const song = {
    uri: 'spotify:track:track1', type: 'track', name: 'Song',
    artists: [{ name: 'Artist' }], album: { images: [] }, duration_ms: 60_000,
  };
  const result = playableTracks([
    { item: song }, { track: song },
    { item: { ...song, duration_ms: 59_999 } },
    { item: { ...song, duration_ms: 10_000 } },
    { item: { ...song, is_playable: false } },
    { item: { ...song, restrictions: { reason: 'market' } } },
    { item: { ...song, type: 'episode' } },
    { item: { ...song, is_local: true } },
    { item: song, is_local: true },
    { item: null }, null,
  ]);
  assert.equal(result.tracks.length, 2);
  assert.equal(result.short, 2);
  assert.equal(result.unavailable, 7);
  assert.equal(result.tracks[0].durationMs, SONG_DURATION_MS);
  assert.throws(() => session(0), /no playable songs/);
});

test('progress round-trips, and Reset removes the persisted key', () => {
  const storage = memoryStorage();
  const state = { ...defaultState(), playlistId: 'playlist', session: { ...session(70), elapsedMs: 23_450 } };
  saveState(storage, state);
  assert.deepEqual(readSavedState(storage), { state, error: '' });
  saveState(storage, defaultState());
  assert.equal(storage.getItem(STATE_KEY), null);
});

test('bad JSON, invalid queues, and impossible counters are reported instead of restored', t => {
  const storage = memoryStorage();
  const warning = t.mock.method(console, 'warn', () => {});
  const invalidStates = [
    '{bad json',
    JSON.stringify({ ...defaultState(), session: { ...session(3), songNumber: 61 } }),
    JSON.stringify({ ...defaultState(), session: { ...session(3), order: [0, 0, 2] } }),
    JSON.stringify({ ...defaultState(), session: { ...session(3), elapsedMs: 60_001 } }),
    JSON.stringify({ ...defaultState(), session: { ...session(3), completed: true } }),
    JSON.stringify({ ...defaultState(), session: { ...session(3), tracks: [null] } }),
  ];
  for (const raw of invalidStates) {
    storage.setItem(STATE_KEY, raw);
    const restored = readSavedState(storage);
    assert.deepEqual(restored.state, defaultState());
    assert.match(restored.error, /could not be restored/);
  }
  assert.equal(warning.mock.callCount(), invalidStates.length);
});
