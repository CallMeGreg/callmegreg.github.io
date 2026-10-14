export const TOKEN_KEY = 'myHour.spotifyTokens';
export const LOGIN_KEY = 'myHour.spotifyLogin';

const API_URL = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

export class SpotifyError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'SpotifyError';
    this.status = status;
  }
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createSpotifyClient({
  clientId,
  redirectUri,
  storage,
  fetchImpl = (...args) => fetch(...args),
  now = Date.now,
}) {
  let refreshPromise = null;
  let callbackPromise = null;
  let generation = 0;

  function readTokens() {
    const saved = storage.getItem(TOKEN_KEY);
    if (!saved) return null;
    const tokens = JSON.parse(saved);
    if (tokens.clientId !== clientId) return null;
    if (typeof tokens.accessToken !== 'string' || typeof tokens.refreshToken !== 'string' ||
        !Number.isFinite(tokens.expiresAt)) {
      throw new SpotifyError('Saved Spotify sign-in is invalid. Reset My Hour and connect again.');
    }
    return tokens;
  }

  function disconnect() {
    generation += 1;
    refreshPromise = null;
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(LOGIN_KEY);
  }

  async function fetchResponse(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      const text = response.status === 204 ? '' : await response.text();
      return { status: response.status, ok: response.ok, headers: response.headers, text };
    } catch (error) {
      throw new SpotifyError(controller.signal.aborted
        ? 'Spotify took too long to respond. Check your connection and try again.'
        : `Could not reach Spotify. Check your connection and try again. ${error.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function responseBody(response, allowEmpty = false) {
    if (response.status === 204) return null;
    if (allowEmpty && response.ok && !response.text.trim()) return null;
    try {
      return JSON.parse(response.text);
    } catch {
      throw new SpotifyError(`Spotify returned an unreadable response (HTTP ${response.status}). Try again.`, response.status);
    }
  }

  async function exchangeToken(parameters, previousRefreshToken, expectedGeneration) {
    const response = await fetchResponse(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...parameters, client_id: clientId }),
    });
    const data = await responseBody(response);
    if (generation !== expectedGeneration) throw new SpotifyError('Spotify sign-in was cancelled.');
    if (!response.ok) {
      if (data?.error === 'invalid_grant') {
        disconnect();
        throw new SpotifyError('Your Spotify sign-in expired. Connect to Spotify again.', 401);
      }
      throw new SpotifyError(`Spotify sign-in failed (HTTP ${response.status}). Check the app configuration and reconnect.`, response.status);
    }
    const refreshToken = data.refresh_token || previousRefreshToken;
    if (!data.access_token || !refreshToken || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
      throw new SpotifyError('Spotify did not return a usable sign-in. Please reconnect.');
    }
    const tokens = {
      clientId,
      accessToken: data.access_token,
      refreshToken,
      expiresAt: now() + data.expires_in * 1000,
    };
    storage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    return tokens.accessToken;
  }

  async function authorizationUrl() {
    const expectedGeneration = generation;
    if (!/^[a-fA-F0-9]{32}$/.test(clientId)) {
      throw new SpotifyError('The site owner must configure VITE_SPOTIFY_CLIENT_ID before connecting Spotify.');
    }
    const redirect = new URL(redirectUri);
    if (redirect.protocol !== 'https:' &&
        !(redirect.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(redirect.hostname))) {
      throw new SpotifyError('Spotify requires HTTPS or a loopback IP. For local development, open http://127.0.0.1:5173/my-hour instead of localhost.');
    }
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)));
    const state = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    if (generation !== expectedGeneration) throw new SpotifyError('Spotify sign-in was cancelled.');
    storage.setItem(LOGIN_KEY, JSON.stringify({
      verifier, state, clientId, redirectUri, createdAt: now(),
    }));
    const url = new URL('https://accounts.spotify.com/authorize');
    url.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    }).toString();
    return url.href;
  }

  function completeAuthorization(search) {
    const params = new URLSearchParams(search);
    if (!params.has('code') && !params.has('error')) return Promise.resolve(false);
    // StrictMode may mount the auth effect twice; an authorization code is single-use.
    if (callbackPromise) return callbackPromise;
    callbackPromise = (async () => {
      try {
        const raw = storage.getItem(LOGIN_KEY);
        const login = raw ? JSON.parse(raw) : null;
        if (!login || !params.get('state') || params.get('state') !== login.state ||
            login.clientId !== clientId || login.redirectUri !== redirectUri ||
            typeof login.verifier !== 'string' || !Number.isFinite(login.createdAt) ||
            now() - login.createdAt > 10 * 60_000 || now() < login.createdAt) {
          throw new SpotifyError('Spotify sign-in could not be verified or has expired. Please connect again.');
        }
        if (params.has('error')) {
          throw new SpotifyError('Spotify access was not granted. Connect again when you are ready.');
        }
        if (!params.get('code')) throw new SpotifyError('Spotify did not return an authorization code. Please connect again.');
        await exchangeToken({
          grant_type: 'authorization_code',
          code: params.get('code'),
          redirect_uri: redirectUri,
          code_verifier: login.verifier,
        }, null, generation);
        return true;
      } finally {
        storage.removeItem(LOGIN_KEY);
      }
    })();
    return callbackPromise;
  }

  async function accessToken(rejectedToken = null) {
    const tokens = readTokens();
    if (!tokens) throw new SpotifyError('Connect to Spotify to continue your session.', 401);
    if (tokens.expiresAt > now() + 60_000 && tokens.accessToken !== rejectedToken) return tokens.accessToken;
    if (!refreshPromise) {
      const pending = exchangeToken({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
      }, tokens.refreshToken, generation);
      refreshPromise = pending;
      try {
        return await pending;
      } finally {
        if (refreshPromise === pending) refreshPromise = null;
      }
    }
    return refreshPromise;
  }

  async function request(path, { method = 'GET', body } = {}, retry = true, rejectedToken = null) {
    const url = new URL(path.startsWith('https://') ? path : `${API_URL}${path}`);
    if (url.origin !== 'https://api.spotify.com' || !url.pathname.startsWith('/v1/')) {
      throw new SpotifyError('Spotify returned an unexpected API address.');
    }
    const token = await accessToken(rejectedToken);
    const response = await fetchResponse(url.href, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 401 && retry) return request(path, { method, body }, false, token);
    if (response.status === 429) {
      const seconds = Number(response.headers.get('Retry-After'));
      throw new SpotifyError(`Spotify's request limit was reached. ${seconds > 0 ? `Wait ${seconds} seconds, then try again.` : 'Please try again later.'}`, 429);
    }
    if (response.status === 403) {
      throw new SpotifyError('Spotify denied access. Check that you have Premium, are on this app\'s allowlist, and own or collaborate on this playlist.', 403);
    }
    if (response.status === 401) {
      disconnect();
      throw new SpotifyError('Your Spotify sign-in expired. Connect to Spotify again.', 401);
    }
    const data = await responseBody(response, method === 'PUT');
    if (!response.ok) {
      throw new SpotifyError(`Spotify request failed (HTTP ${response.status})${data?.error?.message ? `: ${data.error.message}` : '.'}`, response.status);
    }
    return data;
  }

  async function allPages(path) {
    const items = [];
    const visited = new Set();
    let next = path;
    while (next) {
      if (visited.has(next)) throw new SpotifyError('Spotify returned a repeated playlist page. Please try again.');
      visited.add(next);
      const page = await request(next);
      if (!Array.isArray(page?.items) || (page.next != null && typeof page.next !== 'string')) {
        throw new SpotifyError('Spotify returned an incomplete playlist response. Please try again.');
      }
      items.push(...page.items);
      next = page.next;
    }
    return items;
  }

  return {
    authorizationUrl,
    completeAuthorization,
    accessToken,
    disconnect,
    isAuthenticated: () => Boolean(readTokens()),
    profile: () => request('/me'),
    playlists: () => allPages('/me/playlists?limit=50'),
    playlistItems: id => allPages(`/playlists/${encodeURIComponent(id)}/items?limit=50`),
    preparePlayback: async deviceId => {
      await request('/me/player', { method: 'PUT', body: { device_ids: [deviceId], play: false } });
      await request(`/me/player/repeat?state=off&device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' });
      await request(`/me/player/shuffle?state=false&device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' });
    },
    play: (deviceId, track, positionMs) => request(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: 'PUT',
      body: { uris: [track.uri], position_ms: Math.floor(positionMs) },
    }),
  };
}

let sdkPromise;

export function loadSpotifySdk() {
  if (window.Spotify?.Player) return Promise.resolve(window.Spotify);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    const previousReady = window.onSpotifyWebPlaybackSDKReady;
    const timeout = setTimeout(() => fail('Spotify\'s player did not load. Check your connection or content blocker and retry.'), 15_000);
    function fail(message) {
      clearTimeout(timeout);
      script.remove();
      window.onSpotifyWebPlaybackSDKReady = previousReady;
      sdkPromise = null;
      reject(new SpotifyError(message));
    }
    window.onSpotifyWebPlaybackSDKReady = () => {
      clearTimeout(timeout);
      window.onSpotifyWebPlaybackSDKReady = previousReady;
      resolve(window.Spotify);
    };
    script.onerror = () => fail('Spotify\'s player could not load. Check your connection or content blocker and retry.');
    document.head.appendChild(script);
  });
  return sdkPromise;
}
