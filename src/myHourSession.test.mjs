import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSession, changeSessionPlaylist, createSession, currentTrack, defaultState, playableTracks,
  readSavedState, saveState, sessionSongLimit, SONG_DURATION_MS, STATE_KEY,
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

for (const [songNumber, count, endless] of [[25, 3, false], [59, 10, false], [60, 1, false], [123, 3, true]]) {
  test(`switching to ${count} tracks at song ${songNumber} preserves the counter and resets only the minute and queue`, () => {
    let previous = session(100, { endless });
    for (let number = 1; number < songNumber; number += 1) previous = advanceSession(previous);
    previous = { ...previous, elapsedMs: 43_000 };
    const nextTracks = tracks(count);
    nextTracks[0].uri = 'spotify:track:new';
    let next = changeSessionPlaylist(previous, {
      playlist: { id: 'new', name: 'New playlist' }, tracks: nextTracks,
    });
    assert.equal(next.songNumber, songNumber);
    assert.equal(next.playlistStartSongNumber, songNumber);
    assert.equal(next.elapsedMs, 0);
    assert.equal(next.index, 0);
    assert.equal(next.ownerId, previous.ownerId);
    assert.equal(next.shuffle, previous.shuffle);
    assert.equal(next.endless, previous.endless);
    assert.equal(currentTrack(next).uri, 'spotify:track:new');
    assert.equal(previous.elapsedMs, 43_000);
    const storage = memoryStorage();
    const roundTrip = () => {
      const state = { ...defaultState(), endless, playlistId: 'new', session: next };
      saveState(storage, state);
      assert.deepEqual(readSavedState(storage), { state, error: '' });
    };
    roundTrip();
    const turns = endless ? 70 : Math.min(60 - songNumber + 1, count);
    for (let turn = 0; turn < turns; turn += 1) {
      assert.equal(next.completed, false);
      assert.equal(next.songNumber, songNumber + turn);
      next = advanceSession(next);
      roundTrip();
    }
    assert.equal(next.completed, !endless);
    if (!endless) assert.equal(next.songNumber, sessionSongLimit(next));
  });
}

test('repeated shuffled playlist changes retain the global counter and create a fresh order', () => {
  let state = session(8, { shuffle: true });
  for (let number = 1; number < 5; number += 1) state = advanceSession(state);
  state = changeSessionPlaylist(state, { playlist: { id: 'two', name: 'Two' }, tracks: tracks(3) }, () => 0);
  assert.deepEqual(state.order, [1, 2, 0]);
  assert.equal(state.songNumber, 5);
  state = advanceSession(state);
  state = changeSessionPlaylist(state, { playlist: { id: 'three', name: 'Three' }, tracks: tracks(1) });
  assert.equal(state.songNumber, 6);
  assert.equal(state.playlistStartSongNumber, 6);
  assert.equal(sessionSongLimit(state), 6);
  assert.equal(advanceSession(state).completed, true);
  assert.throws(() => changeSessionPlaylist(state, { playlist: state.playlist, tracks: [] }), /no playable songs/);
  assert.equal(state.songNumber, 6);
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
  assert.equal(result.entries.length, 11);
  assert.deepEqual(result.entries.slice(0, 3).map(entry => entry.skipped), ['', '', 'Under one minute']);
  assert.deepEqual(result.entries.slice(4).map(entry => entry.skipped),
    ['Unavailable', 'Unavailable', 'Not a song', 'Local file', 'Local file', 'Unavailable', 'Unavailable']);
  assert.equal(result.entries[0].name, 'Song');
  assert.equal(result.entries[0].artists, 'Artist');
  assert.equal(result.entries[9].name, 'Unavailable item');
  assert.throws(() => session(0), /no playable songs/);
});

test('playlist previews retain all entries beyond ten without truncating long playlists', () => {
  const items = Array.from({ length: 125 }, (_, index) => ({
    item: {
      uri: `spotify:track:track${index}`, type: 'track', name: `Song ${index}`,
      artists: [{ name: 'Artist' }], duration_ms: 180_000,
    },
  }));
  const result = playableTracks(items);
  assert.equal(result.entries.length, 125);
  assert.equal(result.entries.at(-1).name, 'Song 124');
  assert.equal(result.tracks.length, 125);
});

test('progress round-trips, and Reset removes the persisted key', () => {
  const storage = memoryStorage();
  const state = { ...defaultState(), playlistId: 'playlist', session: { ...session(70), elapsedMs: 23_450 } };
  saveState(storage, state);
  assert.deepEqual(readSavedState(storage), { state, error: '' });
  saveState(storage, defaultState());
  assert.equal(storage.getItem(STATE_KEY), null);
});

test('hours saved before playlist switching remain restorable', () => {
  for (const endless of [false, true]) {
    const storage = memoryStorage();
    let previous = session(3, { endless });
    for (let turn = 0; turn < 3; turn += 1) previous = advanceSession(previous);
    delete previous.playlistStartSongNumber;
    const state = { ...defaultState(), endless, playlistId: 'playlist', session: previous };
    saveState(storage, state);
    assert.deepEqual(readSavedState(storage), { state, error: '' });
    assert.equal(sessionSongLimit(previous), 3);
  }
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
    ...[0, -1, 1.5, 2, null, '1'].map(playlistStartSongNumber =>
      JSON.stringify({ ...defaultState(), session: { ...session(3), playlistStartSongNumber } })),
    JSON.stringify({ ...defaultState(), session: { ...session(3), songNumber: 5, playlistStartSongNumber: 3 } }),
  ];
  for (const raw of invalidStates) {
    storage.setItem(STATE_KEY, raw);
    const restored = readSavedState(storage);
    assert.deepEqual(restored.state, defaultState());
    assert.match(restored.error, /could not be restored/);
  }
  assert.equal(warning.mock.callCount(), invalidStates.length);
});
