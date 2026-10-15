import { advanceSession, currentTrack, SONG_DURATION_MS } from './myHourSession.mjs';

export function createHourPlayback({
  transport,
  cue,
  initialSession = null,
  onChange,
  onError,
  onComplete,
  now = () => performance.now(),
}) {
  let session = initialSession;
  let phase = session ? (session.completed ? 'finished' : 'paused') : 'idle';
  let anchor = null;
  let deadline;
  let startupTimeout;
  let pollInterval;
  let polling = false;
  let pendingPlay = null;
  let pendingPreparation = null;
  let pausing = null;
  let epoch = 0;
  let disposed = false;
  let acceptingPlayback = false;

  function elapsed() {
    if (!session) return 0;
    return Math.min(SONG_DURATION_MS, session.elapsedMs + (anchor === null ? 0 : now() - anchor));
  }

  function getSnapshot() {
    return { phase, session: session ? { ...session, elapsedMs: elapsed() } : null };
  }

  function emit() {
    if (!disposed) onChange(getSnapshot());
  }

  function clearTimers() {
    clearTimeout(deadline);
    clearTimeout(startupTimeout);
    clearInterval(pollInterval);
  }

  function freeze() {
    if (session) session = { ...session, elapsedMs: elapsed() };
    anchor = null;
    acceptingPlayback = false;
    clearTimers();
  }

  function fail(error) {
    if (disposed) return;
    epoch += 1;
    freeze();
    cue.stop();
    phase = 'error';
    // Disconnecting also prevents a late Web API play request from restarting audio.
    transport.disconnect();
    emit();
    onError(error);
  }

  function armDeadline() {
    clearTimeout(deadline);
    const expectedEpoch = epoch;
    deadline = setTimeout(() => {
      if (epoch === expectedEpoch && phase === 'playing') void finishSong();
    }, Math.max(0, SONG_DURATION_MS - elapsed()));
  }

  async function poll(expectedEpoch) {
    if (polling || disposed || expectedEpoch !== epoch) return;
    polling = true;
    try {
      const state = await transport.getState();
      if (!disposed && expectedEpoch === epoch) handleState(state);
    } catch (error) {
      if (!disposed && expectedEpoch === epoch) fail(error);
    } finally {
      polling = false;
    }
  }

  function handleState(state) {
    if (disposed || !session || !['starting', 'playing', 'paused'].includes(phase)) return;
    if (phase === 'paused') {
      if (state && !state.paused) fail(new Error('Playback was resumed outside My Hour. Reconnect the player and use Resume here to keep your minute in sync.'));
      return;
    }
    if (!state) {
      if (phase === 'playing') fail(new Error('Playback left this browser or Spotify disconnected. Reconnect the player to resume your saved progress.'));
      return;
    }
    const track = currentTrack(session);
    const actualTrack = state.track_window?.current_track;
    const endedAtOneMinute = phase === 'playing' && track.durationMs === SONG_DURATION_MS &&
      elapsed() >= SONG_DURATION_MS - 1000 && state.paused && state.position === 0 &&
      (actualTrack?.uri === track.uri ||
        state.track_window?.previous_tracks?.some(previous => previous.uri === track.uri));
    if (endedAtOneMinute) {
      void finishSong();
      return;
    }
    if (actualTrack?.uri !== track.uri) {
      if (phase === 'playing') fail(new Error('The song was changed in Spotify. Reconnect the player and resume here to keep your counter in sync.'));
      return;
    }
    if (!Number.isFinite(state.position) || state.position < 0) {
      fail(new Error('Spotify returned an invalid playback position. Reconnect the player and resume.'));
      return;
    }
    if (phase === 'starting') {
      if (!acceptingPlayback || state.paused ||
          state.position < session.elapsedMs - 250 || state.position > session.elapsedMs + 5000) return;
      clearTimeout(startupTimeout);
      session = { ...session, elapsedMs: Math.min(SONG_DURATION_MS, state.position) };
      anchor = now();
      phase = 'playing';
    } else {
      if (Math.abs(state.position - elapsed()) > 2000) {
        fail(new Error('The song position changed in Spotify. Reconnect the player and resume here; seeking would change the one-minute turn.'));
        return;
      }
      session = { ...session, elapsedMs: Math.min(SONG_DURATION_MS, state.position) };
      anchor = state.paused ? null : now();
      if (state.paused) {
        clearTimers();
        phase = 'paused';
        emit();
        return;
      }
    }
    if (elapsed() >= SONG_DURATION_MS) {
      void finishSong();
    } else {
      armDeadline();
      emit();
    }
  }

  async function playCurrent(expectedEpoch) {
    if (disposed || expectedEpoch !== epoch) return;
    phase = 'starting';
    acceptingPlayback = true;
    emit();
    startupTimeout = setTimeout(() => {
      if (expectedEpoch === epoch) {
        fail(new Error('Spotify did not start the song. Reconnect the player, then click Resume. Your place is saved.'));
      }
    }, 15_000);
    pollInterval = setInterval(() => void poll(expectedEpoch), 1000);
    try {
      pendingPlay = transport.play(currentTrack(session), session.elapsedMs);
      await pendingPlay;
      if (!disposed && expectedEpoch === epoch) await poll(expectedEpoch);
    } catch (error) {
      if (!disposed && expectedEpoch === epoch) fail(error);
    } finally {
      pendingPlay = null;
    }
  }

  async function finishSong() {
    if (disposed || !session || !['playing', 'starting'].includes(phase)) return;
    const expectedEpoch = ++epoch;
    freeze();
    session = { ...session, elapsedMs: SONG_DURATION_MS };
    phase = 'transition';
    emit();
    try {
      await transport.pause();
      if (disposed || expectedEpoch !== epoch) return;
      // Keep the can-opening sound separate from Spotify playback.
      await cue.play();
      if (disposed || expectedEpoch !== epoch) return;
      session = advanceSession(session);
      if (session.completed) {
        phase = 'finished';
        emit();
        onComplete(session);
      } else {
        await playCurrent(expectedEpoch);
      }
    } catch (error) {
      if (!disposed && expectedEpoch === epoch) fail(error);
    }
  }

  async function start(nextSession = session) {
    if (disposed) throw new Error('Reconnect the Spotify player before starting.');
    if (!nextSession || nextSession.completed) throw new Error('Choose a playlist to start a new hour.');
    if (['starting', 'playing', 'transition', 'pausing'].includes(phase)) return;
    const expectedEpoch = ++epoch;
    clearTimers();
    session = nextSession;
    anchor = null;
    phase = 'starting';
    acceptingPlayback = false;
    emit();
    try {
      // Both activation calls must originate directly from the user's click on mobile.
      await Promise.all([transport.activate(), cue.activate()]);
      if (disposed || expectedEpoch !== epoch) return;
      pendingPreparation = transport.prepare();
      await pendingPreparation;
      if (disposed || expectedEpoch !== epoch) return;
      if (session.elapsedMs >= SONG_DURATION_MS) {
        await finishSong();
        return;
      }
      await playCurrent(expectedEpoch);
    } catch (error) {
      if (!disposed && expectedEpoch === epoch) fail(error);
    } finally {
      pendingPreparation = null;
    }
  }

  function pause() {
    if (pausing) return pausing;
    if (disposed || !['starting', 'playing', 'transition'].includes(phase)) return Promise.resolve();
    const expectedEpoch = ++epoch;
    freeze();
    cue.stop();
    phase = 'pausing';
    emit();
    pausing = (async () => {
      try {
        // Settle pending commands before pausing, so a playlist change cannot restart old audio.
        if (pendingPreparation) await pendingPreparation;
        if (pendingPlay) await pendingPlay;
        if (disposed || expectedEpoch !== epoch) return;
        await transport.pause();
        if (disposed || expectedEpoch !== epoch) return;
        const state = await transport.getState();
        if (disposed || expectedEpoch !== epoch) return;
        if (session.elapsedMs < SONG_DURATION_MS && state?.track_window?.current_track?.uri === currentTrack(session).uri &&
            Number.isFinite(state.position) && state.position >= 0) {
          session = { ...session, elapsedMs: Math.min(SONG_DURATION_MS, state.position) };
        }
        phase = 'paused';
        emit();
      } catch (error) {
        if (!disposed && expectedEpoch === epoch) fail(error);
      }
    })();
    return pausing.finally(() => { pausing = null; });
  }

  async function clearSession() {
    if (disposed) throw new Error('Reconnect the Spotify player before changing playlists.');
    await pause();
    if (disposed || phase === 'error') {
      throw new Error('Spotify could not stop the current hour. Reconnect the player before changing playlists.');
    }
    epoch += 1;
    freeze();
    cue.stop();
    session = null;
    phase = 'idle';
    emit();
  }

  function dispose() {
    if (disposed) return;
    epoch += 1;
    freeze();
    cue.stop();
    transport.disconnect();
    disposed = true;
  }

  return { getSnapshot, start, pause, clearSession, handleState, fail, dispose };
}

export function createCanOpeningSound() {
  let context;
  let buffer;
  let loading;
  let loadController;
  let playing;
  let disposed = false;

  function stop() {
    if (!playing) return;
    const current = playing;
    current.source.stop();
    current.finish();
  }

  function loadSound() {
    if (buffer) return Promise.resolve();
    if (loading) return loading;
    loadController = new AbortController();
    const timeout = setTimeout(() => loadController.abort(), 15_000);
    loading = (async () => {
      try {
        const response = await fetch('/sounds/can-opening.mp3', { signal: loadController.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        buffer = await context.decodeAudioData(await response.arrayBuffer());
      } catch (error) {
        throw new Error(`Could not load the can-opening sound. Check your connection, reconnect the player, and click Resume to retry. ${error.message}`);
      } finally {
        clearTimeout(timeout);
        loading = null;
      }
    })();
    return loading;
  }

  async function activate() {
    if (disposed) throw new Error('Reconnect the player to enable the can-opening sound.');
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('This browser cannot play the can-opening sound. Please use a browser with Web Audio support.');
    if (!context || context.state === 'closed') context = new AudioContext();
    await Promise.all([context.resume(), loadSound()]);
    if (context.state !== 'running') throw new Error('Can-opening audio is blocked. Allow audio in this browser and click Resume.');
  }

  function play() {
    if (disposed || context?.state !== 'running' || !buffer) {
      return Promise.reject(new Error('Can-opening audio was suspended. Click Resume to enable audio again.'));
    }
    stop();
    return new Promise(resolve => {
      const source = context.createBufferSource();
      source.buffer = buffer;
      let ended = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        source.disconnect();
        if (playing?.source === source) playing = null;
        resolve();
      };
      playing = { source, finish };
      source.onended = finish;
      source.connect(context.destination);
      source.start();
    });
  }

  async function dispose() {
    disposed = true;
    loadController?.abort();
    stop();
    if (context && context.state !== 'closed') await context.close();
  }

  return { activate, play, stop, dispose };
}
