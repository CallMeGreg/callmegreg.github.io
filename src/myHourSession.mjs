export const SONG_DURATION_MS = 60_000;
export const SONG_LIMIT = 60;
export const STATE_KEY = 'myHour.state';

export function defaultState() {
  return {
    version: 1,
    shuffle: true,
    endless: false,
    playlistId: '',
    session: null,
  };
}

export function playableTracks(items) {
  const tracks = [];
  let short = 0;
  let unavailable = 0;

  for (const entry of items) {
    const track = entry?.item ?? entry?.track;
    if (!track || track.type !== 'track' || entry.is_local || track.is_local ||
        track.is_playable === false || track.restrictions?.reason ||
        !/^spotify:track:[a-zA-Z0-9]+$/.test(track.uri) ||
        typeof track.name !== 'string' || !Array.isArray(track.artists) ||
        track.artists.some(artist => typeof artist?.name !== 'string') ||
        !Number.isFinite(track.duration_ms)) {
      unavailable += 1;
    } else if (track.duration_ms < SONG_DURATION_MS) {
      short += 1;
    } else {
      tracks.push({
        uri: track.uri,
        name: track.name,
        artists: track.artists.map(artist => artist.name).join(', '),
        imageUrl: track.album?.images?.[0]?.url || '',
        durationMs: track.duration_ms,
      });
    }
  }

  return { tracks, short, unavailable };
}

function makeOrder(length, shuffle, random) {
  const order = Array.from({ length }, (_, index) => index);
  if (shuffle) {
    for (let index = order.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
  }
  return order;
}

export function createSession({ ownerId, playlist, tracks, shuffle, endless }, random = Math.random) {
  if (!tracks.length) throw new Error('This playlist has no playable songs at least one minute long.');
  return {
    ownerId,
    playlist: { id: playlist.id, name: playlist.name },
    tracks,
    order: makeOrder(tracks.length, shuffle, random),
    index: 0,
    songNumber: 1,
    elapsedMs: 0,
    shuffle,
    endless,
    completed: false,
  };
}

export function currentTrack(session) {
  return session.tracks[session.order[session.index]];
}

export function advanceSession(session, random = Math.random) {
  if (session.completed) return session;
  const atEnd = session.index === session.order.length - 1;
  if (!session.endless && (atEnd || session.songNumber >= SONG_LIMIT)) {
    return { ...session, elapsedMs: SONG_DURATION_MS, completed: true };
  }

  let order = session.order;
  if (atEnd) {
    order = makeOrder(session.tracks.length, session.shuffle, random);
    // Avoid an immediate repeat at a shuffled cycle boundary when possible.
    if (session.shuffle && order.length > 1 && order[0] === session.order[session.index]) {
      [order[0], order[1]] = [order[1], order[0]];
    }
  }
  return {
    ...session,
    order,
    index: atEnd ? 0 : session.index + 1,
    songNumber: session.songNumber + 1,
    elapsedMs: 0,
  };
}

function validSession(session) {
  if (!session || typeof session.ownerId !== 'string' ||
      typeof session.playlist?.id !== 'string' || typeof session.playlist?.name !== 'string' ||
      typeof session.shuffle !== 'boolean' || typeof session.endless !== 'boolean' ||
      typeof session.completed !== 'boolean' ||
      !Number.isFinite(session.elapsedMs) || session.elapsedMs < 0 || session.elapsedMs > SONG_DURATION_MS ||
      !Number.isSafeInteger(session.songNumber) || session.songNumber < 1 ||
      !Array.isArray(session.tracks) || !session.tracks.length ||
      !Array.isArray(session.order) || session.order.length !== session.tracks.length ||
      new Set(session.order).size !== session.tracks.length ||
      !session.order.every(index => Number.isInteger(index) && index >= 0 && index < session.tracks.length) ||
      !Number.isInteger(session.index) || session.index < 0 || session.index >= session.order.length) {
    return false;
  }
  if (!session.endless && (session.songNumber > Math.min(SONG_LIMIT, session.tracks.length) ||
      session.index !== session.songNumber - 1)) return false;
  if (session.endless && (session.completed || session.index !== (session.songNumber - 1) % session.tracks.length)) {
    return false;
  }
  if (session.completed && (session.elapsedMs !== SONG_DURATION_MS ||
      session.songNumber !== Math.min(SONG_LIMIT, session.tracks.length))) return false;
  return session.tracks.every(track =>
    /^spotify:track:[a-zA-Z0-9]+$/.test(track?.uri) &&
    typeof track.name === 'string' && typeof track.artists === 'string' &&
    typeof track.imageUrl === 'string' &&
    Number.isFinite(track.durationMs) && track.durationMs >= SONG_DURATION_MS);
}

export function readSavedState(storage) {
  try {
    const raw = storage.getItem(STATE_KEY);
    if (!raw) return { state: defaultState(), error: '' };
    const state = JSON.parse(raw);
    if (state?.version !== 1 || typeof state.shuffle !== 'boolean' ||
        typeof state.endless !== 'boolean' || typeof state.playlistId !== 'string' ||
        (state.session !== null && !validSession(state.session))) {
      throw new Error('Unrecognized saved session.');
    }
    return { state, error: '' };
  } catch (error) {
    console.warn('Could not restore My Hour progress:', error);
    return {
      state: defaultState(),
      error: 'Saved My Hour progress could not be restored. Reset to clear it, or start a new session.',
    };
  }
}

export function saveState(storage, state) {
  if (state.shuffle && !state.endless && !state.playlistId && !state.session) {
    storage.removeItem(STATE_KEY);
  } else {
    storage.setItem(STATE_KEY, JSON.stringify(state));
  }
}

export function trackUrl(track) {
  return `https://open.spotify.com/track/${track.uri.split(':')[2]}`;
}
