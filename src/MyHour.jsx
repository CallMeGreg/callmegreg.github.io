import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  createSession, currentTrack, defaultState, playableTracks, readSavedState,
  saveState, SONG_DURATION_MS, SONG_LIMIT, trackUrl,
} from './myHourSession.mjs';
import { createSpotifyClient, loadSpotifySdk } from './myHourSpotify.mjs';
import { createCanOpeningSound, createHourPlayback } from './myHourPlayback.mjs';
import './MyHour.css';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim() || '';
const CONFIGURED = /^[a-fA-F0-9]{32}$/.test(CLIENT_ID);
const LOCAL_STORAGE = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: key => window.localStorage.removeItem(key),
};

function initialPlayback(session) {
  return { session, phase: session ? (session.completed ? 'finished' : 'paused') : 'idle' };
}

export default function MyHour() {
  const navigate = useNavigate();
  const [restored] = useState(() => readSavedState(LOCAL_STORAGE));
  const [saved, setSaved] = useState(restored.state);
  const savedRef = useRef(saved);
  const [storageError, setStorageError] = useState(restored.error);
  const [playback, setPlayback] = useState(() => initialPlayback(restored.state.session));
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState('');
  const [authBusy, setAuthBusy] = useState(true);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [playerStatus, setPlayerStatus] = useState('disconnected');
  const [playerAttempt, setPlayerAttempt] = useState(0);
  const [playlists, setPlaylists] = useState([]);
  const [playlistsBusy, setPlaylistsBusy] = useState(false);
  const [playlistsError, setPlaylistsError] = useState('');
  const [playlistAttempt, setPlaylistAttempt] = useState(0);
  const [selection, setSelection] = useState(null);
  const [tracksBusy, setTracksBusy] = useState(false);
  const [tracksError, setTracksError] = useState('');
  const [tracksAttempt, setTracksAttempt] = useState(0);
  const [changingPlaylist, setChangingPlaylist] = useState(false);
  const [resetting, setResetting] = useState(false);
  const controllerRef = useRef(null);
  const leaveDialogRef = useRef(null);
  const allowNavigationRef = useRef(false);
  const redirectUri = `${window.location.origin}/my-hour`;
  const [spotify] = useState(() => createSpotifyClient({
    clientId: CLIENT_ID,
    redirectUri,
    storage: {
      getItem: key => window.sessionStorage.getItem(key),
      setItem: (key, value) => window.sessionStorage.setItem(key, value),
      removeItem: key => window.sessionStorage.removeItem(key),
    },
  }));

  const updateSaved = useCallback(patch => {
    const next = { ...savedRef.current, ...patch };
    savedRef.current = next;
    setSaved(next);
    try {
      saveState(LOCAL_STORAGE, next);
      setStorageError('');
    } catch (storageFailure) {
      console.warn('Could not save My Hour progress:', storageFailure);
      setStorageError('Your browser could not save My Hour progress. Keep this page open; refreshing may lose your session.');
    }
  }, []);

  useEffect(() => {
    document.body.classList.add('my-hour-page');
    return () => document.body.classList.remove('my-hour-page');
  }, []);

  useEffect(() => {
    let active = true;
    const search = window.location.search;
    const params = new URLSearchParams(search);
    const isCallback = params.has('code') || params.has('error');
    setAuthBusy(true);
    async function initialize() {
      try {
        await spotify.completeAuthorization(search);
        if (!active || !spotify.isAuthenticated()) return;
        const user = await spotify.profile();
        if (!active) return;
        if (!user?.id) throw new Error('Spotify did not return your account. Please connect again.');
        if (user.product && user.product !== 'premium') {
          throw new Error('My Hour requires Spotify Premium for full-song browser playback.');
        }
        if (savedRef.current.session && savedRef.current.session.ownerId !== user.id) {
          updateSaved({ session: null, playlistId: '' });
          setPlayback(initialPlayback(null));
        }
        setProfile(user);
      } catch (authError) {
        if (active) setError(authError.message);
      } finally {
        if (active) {
          setAuthBusy(false);
          if (isCallback) navigate('/my-hour', { replace: true });
        }
      }
    }
    void initialize();
    return () => { active = false; };
  }, [spotify, authAttempt, navigate, updateSaved]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setPlaylistsBusy(true);
    setPlaylistsError('');
    spotify.playlists().then(items => {
      if (!active) return;
      setPlaylists(items.filter(playlist =>
        playlist && (playlist.owner?.id === profile.id || playlist.collaborative)));
    }).catch(playlistError => {
      if (active) setPlaylistsError(playlistError.message);
    }).finally(() => {
      if (active) setPlaylistsBusy(false);
    });
    return () => { active = false; };
  }, [spotify, profile, playlistAttempt]);

  useEffect(() => {
    setSelection(null);
    setTracksError('');
    if (!profile || !saved.playlistId) {
      setTracksBusy(false);
      return;
    }
    let active = true;
    setTracksBusy(true);
    spotify.playlistItems(saved.playlistId).then(items => {
      if (active) setSelection({ playlistId: saved.playlistId, ...playableTracks(items) });
    }).catch(trackError => {
      if (active) setTracksError(trackError.message);
    }).finally(() => {
      if (active) setTracksBusy(false);
    });
    return () => { active = false; };
  }, [spotify, profile, saved.playlistId, tracksAttempt]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    let player;
    let deviceId;
    let controller;
    let failed = false;
    const cue = createCanOpeningSound();
    setPlayerStatus('connecting');

    function reportError(playerError) {
      if (!active) return;
      failed = true;
      clearTimeout(readyTimeout);
      setError(playerError.message);
      setPlayerStatus('error');
      if (playerError.status === 401) setProfile(null);
    }

    function failPlayer(playerError) {
      if (!active || failed) return;
      failed = true;
      if (controller) controller.fail(playerError);
      else {
        player?.disconnect();
        reportError(playerError);
      }
    }

    const readyTimeout = setTimeout(() => failPlayer(new Error(
      'Spotify could not connect this browser. Check Premium, your allowlist, and browser playback permissions, then reconnect the player.',
    )), 20_000);

    loadSpotifySdk().then(Spotify => {
      if (!active || failed) return;
      player = new Spotify.Player({
        name: 'My Hour',
        volume: 0.7,
        getOAuthToken: callback => {
          spotify.accessToken().then(token => {
            if (active && !failed) callback(token);
          }).catch(failPlayer);
        },
      });
      player.addListener('ready', ({ device_id: id }) => {
        if (!active || failed) return;
        clearTimeout(readyTimeout);
        deviceId = id;
        if (!controller) {
          controller = createHourPlayback({
            initialSession: savedRef.current.session,
            cue,
            transport: {
              activate: () => player.activateElement(),
              prepare: () => spotify.preparePlayback(deviceId),
              play: (track, positionMs) => spotify.play(deviceId, track, positionMs),
              pause: () => player.pause(),
              getState: () => player.getCurrentState(),
              disconnect: () => {
                deviceId = null;
                player.disconnect();
              },
            },
            onChange: snapshot => {
              if (!active) return;
              setPlayback(snapshot);
              updateSaved({ session: snapshot.session });
            },
            onError: reportError,
            onComplete: () => {
              confetti({
                particleCount: 180,
                spread: 100,
                origin: { y: 0.65 },
                colors: ['#b8f58c', '#b8a1ff', '#ffd887', '#ffffff'],
                disableForReducedMotion: true,
              });
            },
          });
          controllerRef.current = controller;
          setPlayback(controller.getSnapshot());
        }
        setPlayerStatus('ready');
      });
      player.addListener('player_state_changed', state => controller?.handleState(state));
      player.addListener('not_ready', () => {
        if (deviceId) failPlayer(new Error('Spotify disconnected from this browser. Reconnect the player to resume your saved progress.'));
      });
      player.addListener('initialization_error', ({ message }) => failPlayer(new Error(`Spotify cannot play in this browser: ${message}`)));
      player.addListener('authentication_error', ({ message }) => failPlayer(new Error(`Spotify authentication failed. Reset and connect again. ${message}`)));
      player.addListener('account_error', () => failPlayer(new Error('Spotify Premium is required. Check your subscription, then reconnect the player.')));
      player.addListener('playback_error', ({ message }) => failPlayer(new Error(`Spotify playback failed: ${message}`)));
      player.addListener('autoplay_failed', () => failPlayer(new Error('Your browser blocked playback. Reconnect the player and click Resume to allow audio.')));
      return player.connect().then(connected => {
        if (!connected) failPlayer(new Error('Spotify could not connect. Reconnect the player to try again.'));
      });
    }).catch(failPlayer);

    return () => {
      active = false;
      clearTimeout(readyTimeout);
      if (controller) {
        if (controllerRef.current === controller) {
          const snapshot = controller.getSnapshot();
          savedRef.current = { ...savedRef.current, session: snapshot.session };
          try {
            saveState(LOCAL_STORAGE, savedRef.current);
          } catch (storageFailure) {
            console.warn('Could not save My Hour before disconnecting:', storageFailure);
          }
          controllerRef.current = null;
        }
        controller.dispose();
      } else {
        player?.disconnect();
      }
      void cue.dispose().catch(audioError => console.warn('Could not close My Hour can-opening audio:', audioError));
    };
  }, [spotify, profile, playerAttempt, updateSaved]);

  const session = saved.session;
  const inProgress = Boolean(session && !session.completed);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    inProgress && !allowNavigationRef.current && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      void controllerRef.current?.pause();
      leaveDialogRef.current?.showModal();
    }
  }, [blocker.state]);

  useEffect(() => {
    if (!inProgress) return;
    function beforeUnload(event) {
      if (allowNavigationRef.current) return;
      void controllerRef.current?.pause();
      event.preventDefault();
      event.returnValue = '';
    }
    function pageHide() {
      const controller = controllerRef.current;
      if (controller) {
        updateSaved({ session: controller.getSnapshot().session });
        controller.dispose();
      }
    }
    function pageShow(event) {
      if (event.persisted) {
        setPlayback(initialPlayback(savedRef.current.session));
        setPlayerAttempt(attempt => attempt + 1);
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', pageShow);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('pagehide', pageHide);
      window.removeEventListener('pageshow', pageShow);
    };
  }, [inProgress, updateSaved]);

  async function connectSpotify() {
    setError('');
    setAuthBusy(true);
    try {
      const url = await spotify.authorizationUrl();
      allowNavigationRef.current = true;
      window.location.assign(url);
    } catch (authError) {
      allowNavigationRef.current = false;
      setError(authError.message);
      setAuthBusy(false);
    }
  }

  async function startSession() {
    setError('');
    try {
      if (!controllerRef.current) throw new Error('Connect the Spotify player before starting.');
      const playlist = playlists.find(item => item.id === saved.playlistId) ||
        (session?.playlist.id === saved.playlistId ? session.playlist : null);
      if (!playlist || selection?.playlistId !== saved.playlistId) throw new Error('Choose a playlist and wait for its songs to load.');
      await controllerRef.current.start(createSession({
        ownerId: profile.id,
        playlist,
        tracks: selection.tracks,
        shuffle: saved.shuffle,
        endless: saved.endless,
      }));
    } catch (playError) {
      setError(playError.message);
    }
  }

  async function resumeSession() {
    setError('');
    try {
      if (!controllerRef.current) throw new Error('Reconnect the Spotify player before resuming.');
      await controllerRef.current.start();
    } catch (playError) {
      setError(playError.message);
    }
  }

  async function changePlaylist(playlistId) {
    setChangingPlaylist(true);
    setError('');
    try {
      await controllerRef.current?.clearSession();
      updateSaved({ playlistId, session: null });
      setPlayback(initialPlayback(null));
    } catch (playlistError) {
      setError(playlistError.message);
    } finally {
      setChangingPlaylist(false);
    }
  }

  async function resetState() {
    setResetting(true);
    await controllerRef.current?.pause();
    if (!window.confirm('Reset My Hour? This stops playback, clears your saved progress and settings, and disconnects Spotify.')) {
      setResetting(false);
      return;
    }
    try {
      controllerRef.current?.dispose();
      controllerRef.current = null;
      spotify.disconnect();
      updateSaved(defaultState());
      setPlayback(initialPlayback(null));
      setProfile(null);
      setPlaylists([]);
      setSelection(null);
      setPlayerStatus('disconnected');
      setError('');
      setPlaylistsError('');
      setTracksError('');
      setAuthAttempt(attempt => attempt + 1);
    } catch (resetError) {
      setError(`My Hour could not fully reset: ${resetError.message}`);
    } finally {
      setResetting(false);
    }
  }

  const track = session ? currentTrack(session) : null;
  const seconds = Math.ceil((SONG_DURATION_MS - (playback.session?.elapsedMs || 0)) / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const busy = ['starting', 'transition', 'pausing'].includes(playback.phase);
  const readyToStart = playerStatus === 'ready' && !tracksBusy && selection?.playlistId === saved.playlistId &&
    selection.tracks.length > 0 && !resetting && !changingPlaylist;
  const limit = session ? Math.min(SONG_LIMIT, session.tracks.length) : SONG_LIMIT;
  const statusText = {
    starting: 'Waiting for Spotify...',
    transition: 'Minute complete...',
    pausing: 'Pausing Spotify...',
  }[playback.phase];
  const accountName = profile?.display_name || profile?.id;
  const avatarUrl = profile?.images?.find(image => image.url)?.url;
  const accountStatus = !profile ? (authBusy ? 'Connecting to Spotify...' : 'Connect your Spotify')
    : playerStatus === 'ready' ? `Connected as ${accountName}`
      : playerStatus === 'error' ? `Disconnected from Spotify (${accountName})`
        : `Connecting as ${accountName}...`;

  return (
    <main className="my-hour">
      <header className="mh-topbar">
        <Link to="/" className="mh-quiet-button">Home</Link>
        <h1 className="mh-wordmark">MY HOUR</h1>
        <button type="button" className="mh-quiet-button" onClick={resetState} disabled={resetting || changingPlaylist}>
          {resetting ? 'Resetting...' : 'Reset'}
        </button>
      </header>

      <div className="mh-content">
        {error && <div className="mh-alert" role="alert">{error}</div>}
        {storageError && <div className="mh-alert" role="alert">{storageError}</div>}

        <div className="mh-layout">
          <section className="mh-player mh-panel" aria-label="My Hour player">
            {session?.endless && <span className="mh-mode-tag">ENDLESS</span>}
            <div className="mh-clock" style={{ '--mh-progress': `${(1 - seconds / 60) * 360}deg` }}>
              <div className="mh-clock-inner">
                <span className="mh-small-label">SONG</span>
                <output className="mh-count" aria-label="Song number">{session?.songNumber || 1}</output>
                <span className="mh-count-total">
                  {session?.endless ? 'and counting' : `of ${limit}`}
                </span>
              </div>
            </div>
            <output className="mh-time" aria-label="Time remaining in this song">{time}</output>

            {track ? (
              <div className="mh-now-playing">
                {track.imageUrl && (
                  <a href={trackUrl(track)} target="_blank" rel="noopener noreferrer">
                    <img src={track.imageUrl} alt={`Artwork for ${track.name}`} width="76" height="76" />
                  </a>
                )}
                <div>
                  <a className="mh-track-name" href={trackUrl(track)} target="_blank" rel="noopener noreferrer">{track.name}</a>
                  <p>{track.artists}</p>
                  <a className="mh-spotify-link" href={trackUrl(track)} target="_blank" rel="noopener noreferrer">Listen on Spotify</a>
                </div>
              </div>
            ) : (
              <p className="mh-empty-track">Pick a playlist. We'll take it one minute at a time.</p>
            )}

            {session?.completed && (
              <p className="mh-completion" role="status">
                {session.songNumber} one-minute {session.songNumber === 1 ? 'song' : 'songs'}. Nicely done.
              </p>
            )}
            <div className="mh-play-controls">
              {inProgress ? (
                playback.phase === 'playing' ? (
                  <button type="button" className="mh-primary" onClick={() => void controllerRef.current?.pause()} disabled={resetting || changingPlaylist}>Pause</button>
                ) : (
                  <button type="button" className="mh-primary" onClick={resumeSession} disabled={busy || playerStatus !== 'ready' || resetting || changingPlaylist}>
                    {busy ? statusText : 'Resume'}
                  </button>
                )
              ) : (
                <button type="button" className="mh-primary" onClick={startSession} disabled={!readyToStart || busy}>
                  {session?.completed ? 'Play again' : 'Start My Hour'}
                </button>
              )}
            </div>
          </section>

          <aside className="mh-settings mh-panel" aria-label="Session setup">
            <div className="mh-account">
              {avatarUrl && avatarUrl !== failedAvatarUrl ? (
                <img className="mh-account-icon" src={avatarUrl} alt={`${accountName}'s profile`}
                  width="38" height="38" onError={() => {
                    console.warn('Could not load the Spotify profile picture.');
                    setFailedAvatarUrl(avatarUrl);
                  }} />
              ) : (
                <span className="mh-account-icon" aria-hidden="true">{profile ? accountName.slice(0, 1).toUpperCase() : '?'}</span>
              )}
              <div>
                <strong role="status">{accountStatus}</strong>
              </div>
            </div>
            {!profile ? (
              <button type="button" className="mh-spotify-button" onClick={connectSpotify} disabled={!CONFIGURED || authBusy || resetting}>
                {authBusy ? 'Connecting...' : 'Connect to Spotify'}
              </button>
            ) : playerStatus === 'error' && (
              <div className="mh-connection-status">
                <button type="button" className="mh-text-button" onClick={() => { setError(''); setPlayerAttempt(attempt => attempt + 1); }}>
                  Reconnect player
                </button>
              </div>
            )}

            {!CONFIGURED && (
              <div className="mh-setup-note">
                <strong>Spotify setup needed</strong>
                <p>The site owner must set <code>VITE_SPOTIFY_CLIENT_ID</code> in the build and register this redirect URI:</p>
                <code className="mh-callback">{redirectUri}</code>
                <p>No client secret or Spotify password belongs in this website.</p>
              </div>
            )}

            <label className="mh-field-label" htmlFor="mh-playlist">YOUR PLAYLIST</label>
            <select id="mh-playlist" value={saved.playlistId} disabled={!profile || playlistsBusy || busy || changingPlaylist || resetting}
              onChange={event => void changePlaylist(event.target.value)}>
              <option value="">{playlistsBusy ? 'Loading playlists...' : 'Choose a playlist'}</option>
              {saved.playlistId && !playlists.some(playlist => playlist.id === saved.playlistId) && (
                <option value={saved.playlistId}>{session?.playlist.name || 'Saved playlist'}</option>
              )}
              {playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
            </select>
            <p className="mh-field-hint">Playlists you own or collaborate on, including private playlists.</p>
            {inProgress && <p className="mh-field-hint">Changing playlists stops this hour and resets to song 1.</p>}
            {profile && !playlistsBusy && !playlists.length && !playlistsError && (
              <p className="mh-field-hint">No owned or collaborative playlists found. Create one in Spotify, then reload playlists.</p>
            )}
            {profile && (
              <button type="button" className="mh-text-button" disabled={playlistsBusy || changingPlaylist || resetting}
                onClick={() => { setPlaylistAttempt(attempt => attempt + 1); setTracksAttempt(attempt => attempt + 1); }}>
                Reload playlists
              </button>
            )}
            {playlistsError && <p className="mh-inline-error" role="alert">{playlistsError}</p>}
            {tracksBusy && <p className="mh-field-hint" role="status">Checking every song in this playlist...</p>}
            {tracksError && (
              <div className="mh-inline-error" role="alert">
                <p>{tracksError}</p>
                <button type="button" className="mh-text-button" onClick={() => setTracksAttempt(attempt => attempt + 1)}>Retry songs</button>
              </div>
            )}
            {selection && !tracksBusy && (
              <div className="mh-playlist-summary" role="status">
                <strong>{selection.tracks.length} eligible {selection.tracks.length === 1 ? 'song' : 'songs'}</strong>
                {(selection.short > 0 || selection.unavailable > 0) && (
                  <span>{selection.short} under a minute; {selection.unavailable} unavailable, local, or non-music items skipped.</span>
                )}
                {!selection.tracks.length && <span>Choose a playlist with playable songs at least 60 seconds long.</span>}
              </div>
            )}
            {selection?.entries.length > 0 && !tracksBusy && (
              <details className="mh-playlist-songs" key={selection.playlistId}>
                <summary>View playlist songs ({selection.entries.length})</summary>
                <ol role="list" tabIndex="0" aria-label="Playlist songs">
                  {selection.entries.map((song, index) => (
                    <li key={`${index}-${song.uri}`}>
                      <span className="mh-song-position" aria-hidden="true">{index + 1}</span>
                      <div>
                        {song.uri ? (
                          <a href={trackUrl(song)} target="_blank" rel="noopener noreferrer" title={song.name}>{song.name}</a>
                        ) : <strong title={song.name}>{song.name}</strong>}
                        <small title={[song.artists, song.skipped && `Skipped: ${song.skipped}`].filter(Boolean).join(' - ')}>
                          {[song.artists, song.skipped && `Skipped: ${song.skipped}`].filter(Boolean).join(' - ')}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            )}

            <div className="mh-options">
              <label className="mh-toggle-row">
                <span><strong>Shuffle</strong><small>A fresh order, no repeats within a cycle.</small></span>
                <input type="checkbox" checked={saved.shuffle} disabled={inProgress || resetting || changingPlaylist}
                  onChange={event => updateSaved({ shuffle: event.target.checked })} />
              </label>
              <label className="mh-toggle-row">
                <span><strong>Endless mode</strong><small>Keep going past 60. Loop when the playlist ends.</small></span>
                <input type="checkbox" checked={saved.endless} disabled={inProgress || resetting || changingPlaylist}
                  onChange={event => updateSaved({ endless: event.target.checked })} />
              </label>
            </div>
            {saved.endless && (
              <p className="mh-session-rule">
                No finish line. Pause whenever you like; each new cycle uses all eligible playlist entries.
              </p>
            )}
          </aside>
        </div>
      </div>

      {blocker.state === 'blocked' && (
        <dialog ref={leaveDialogRef} className="mh-modal" aria-labelledby="mh-leave-title" aria-describedby="mh-leave-description"
          onCancel={() => blocker.reset()}>
          <h2 id="mh-leave-title">Leave My Hour?</h2>
          <p id="mh-leave-description">Playback will stop and your progress is saved. You can resume this song when you come back.</p>
          <div className="mh-modal-actions">
            <button type="button" className="mh-secondary" autoFocus onClick={() => blocker.reset()}>Stay here</button>
            <button type="button" className="mh-primary" onClick={() => blocker.proceed()}>Leave</button>
          </div>
        </dialog>
      )}
    </main>
  );
}
