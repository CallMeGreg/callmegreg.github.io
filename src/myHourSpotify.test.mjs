import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSpotifyClient, LOGIN_KEY, TOKEN_KEY } from './myHourSpotify.mjs';

const CLIENT_ID = '0123456789abcdef0123456789abcdef';
const REDIRECT_URI = 'http://127.0.0.1:5173/my-hour';
const NOW = 1_000_000;

function storage() {
  const entries = new Map();
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key),
  };
}

function response(data, status = 200, headers = {}) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function fixture(fetchImpl = async () => response({}), options = {}) {
  const store = storage();
  const client = createSpotifyClient({
    clientId: CLIENT_ID, redirectUri: REDIRECT_URI, storage: store, fetchImpl, now: () => NOW, ...options,
  });
  function signIn(expiresAt = NOW + 3_600_000) {
    store.setItem(TOKEN_KEY, JSON.stringify({
      clientId: CLIENT_ID, accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt,
    }));
  }
  return { client, store, signIn };
}

test('PKCE login sends a SHA-256 challenge, scopes, and random state, never a client secret', async () => {
  const { client, store } = fixture();
  const url = new URL(await client.authorizationUrl());
  const pending = JSON.parse(store.getItem(LOGIN_KEY));
  assert.equal(url.origin, 'https://accounts.spotify.com');
  assert.equal(url.pathname, '/authorize');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('client_id'), CLIENT_ID);
  assert.equal(url.searchParams.get('redirect_uri'), REDIRECT_URI);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(pending.verifier).digest('base64url'));
  assert.equal(url.searchParams.get('state'), pending.state);
  assert.ok(pending.verifier.length >= 43 && pending.verifier.length <= 128);
  assert.ok(pending.state.length >= 32);
  assert.match(url.searchParams.get('scope'), /streaming/);
  assert.match(url.searchParams.get('scope'), /playlist-read-private/);
  assert.equal(url.searchParams.has('client_secret'), false);
  assert.equal(url.searchParams.has('code_verifier'), false);
});

test('localhost and missing client IDs get actionable configuration errors', async () => {
  await assert.rejects(fixture(undefined, { clientId: '' }).client.authorizationUrl(), /VITE_SPOTIFY_CLIENT_ID/);
  await assert.rejects(fixture(undefined, { redirectUri: 'http://localhost:5173/my-hour' }).client.authorizationUrl(), /127\.0\.0\.1/);
});

test('a validated callback exchanges a code once even when the effect runs twice', async () => {
  const requests = [];
  const { client, store } = fixture(async (url, options) => {
    requests.push([url, options]);
    return response({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 });
  });
  await client.authorizationUrl();
  const pending = JSON.parse(store.getItem(LOGIN_KEY));
  const callback = `?code=test-code&state=${pending.state}`;
  await Promise.all([client.completeAuthorization(callback), client.completeAuthorization(callback)]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], 'https://accounts.spotify.com/api/token');
  assert.equal(requests[0][1].body.get('code_verifier'), pending.verifier);
  assert.equal(requests[0][1].body.get('redirect_uri'), REDIRECT_URI);
  assert.equal(requests[0][1].body.get('client_secret'), null);
  assert.equal(store.getItem(LOGIN_KEY), null);
  assert.equal(JSON.parse(store.getItem(TOKEN_KEY)).accessToken, 'new-access');
  assert.equal(client.isAuthenticated(), true);
});

test('invalid state, expired attempts, and denied access cannot exchange tokens', async () => {
  for (const scenario of ['invalid-state', 'expired', 'denied']) {
    let requests = 0;
    const { client, store } = fixture(async () => { requests += 1; return response({}); });
    await client.authorizationUrl();
    const pending = JSON.parse(store.getItem(LOGIN_KEY));
    if (scenario === 'expired') store.setItem(LOGIN_KEY, JSON.stringify({ ...pending, createdAt: NOW - 600_001 }));
    const query = scenario === 'denied' ? `?error=access_denied&state=${pending.state}`
      : `?code=test-code&state=${scenario === 'invalid-state' ? 'wrong-state' : pending.state}`;
    await assert.rejects(client.completeAuthorization(query), /verified|expired|not granted/);
    assert.equal(requests, 0);
    assert.equal(store.getItem(TOKEN_KEY), null);
    assert.equal(store.getItem(LOGIN_KEY), null);
  }
});

test('long sessions share a refresh request and retain a refresh token when Spotify omits it', async () => {
  let refreshes = 0;
  const { client, store, signIn } = fixture(async (url, options) => {
    assert.equal(url, 'https://accounts.spotify.com/api/token');
    assert.equal(options.body.get('grant_type'), 'refresh_token');
    assert.equal(options.body.get('refresh_token'), 'test-refresh');
    refreshes += 1;
    return response({ access_token: 'refreshed', expires_in: 3600 });
  });
  signIn(NOW + 59_000);
  assert.deepEqual(await Promise.all([client.accessToken(), client.accessToken(), client.accessToken()]),
    ['refreshed', 'refreshed', 'refreshed']);
  assert.equal(refreshes, 1);
  assert.equal(JSON.parse(store.getItem(TOKEN_KEY)).refreshToken, 'test-refresh');
});

test('a 401 refreshes and retries once, without using the stale access token', async () => {
  const tokens = [];
  let refreshes = 0;
  const { client, signIn } = fixture(async (url, options) => {
    if (url.includes('/api/token')) {
      refreshes += 1;
      return response({ access_token: 'refreshed', expires_in: 3600 });
    }
    tokens.push(options.headers.Authorization);
    return tokens.length === 1 ? response({ error: { message: 'Expired' } }, 401) : response({ id: 'listener' });
  });
  signIn();
  assert.deepEqual(await client.profile(), { id: 'listener' });
  assert.deepEqual(tokens, ['Bearer test-access', 'Bearer refreshed']);
  assert.equal(refreshes, 1);
});

test('expired refresh grants clear sign-in and require explicit reconnection', async () => {
  const { client, store, signIn } = fixture(async () => response({ error: 'invalid_grant' }, 400));
  signIn(NOW);
  await assert.rejects(client.accessToken(), error => error.status === 401 && /expired/.test(error.message));
  assert.equal(store.getItem(TOKEN_KEY), null);
});

test('reset during a refresh cannot restore credentials from the late response', async () => {
  let resolve;
  const pending = new Promise(accept => { resolve = accept; });
  const { client, store, signIn } = fixture(() => pending);
  signIn(NOW);
  const refreshing = client.accessToken();
  client.disconnect();
  resolve(response({ access_token: 'late-access', refresh_token: 'late-refresh', expires_in: 3600 }));
  await assert.rejects(refreshing, /cancelled/);
  assert.equal(store.getItem(TOKEN_KEY), null);
});

test('playlists and playlist items follow every page using the current items endpoint', async () => {
  const urls = [];
  const { client, signIn } = fixture(async url => {
    urls.push(url);
    if (url.includes('/me/playlists')) {
      return response({ items: [{ id: 'playlist' }], next: null });
    }
    return url.includes('offset=50')
      ? response({ items: [{ item: { name: 'last song' } }], next: null })
      : response({ items: [{ item: { name: 'first song' } }], next: 'https://api.spotify.com/v1/playlists/playlist/items?limit=50&offset=50' });
  });
  signIn();
  assert.equal((await client.playlists()).length, 1);
  assert.deepEqual((await client.playlistItems('playlist')).map(entry => entry.item.name), ['first song', 'last song']);
  assert.equal(urls[1], 'https://api.spotify.com/v1/playlists/playlist/items?limit=50');
  assert.equal(urls.length, 3);
});

test('pagination refuses external URLs instead of leaking the bearer token', async () => {
  let requests = 0;
  const { client, signIn } = fixture(async () => {
    requests += 1;
    return response({ items: [], next: 'https://example.com/collect-token' });
  });
  signIn();
  await assert.rejects(client.playlists(), /unexpected API address/);
  assert.equal(requests, 1);
});

test('rate limits and forbidden requests remain visible errors, not empty playlists', async () => {
  const limited = fixture(async () => response({}, 429, { 'Retry-After': '17' }));
  limited.signIn();
  await assert.rejects(limited.client.playlists(), error => error.status === 429 && /17 seconds/.test(error.message));
  const forbidden = fixture(async () => response({}, 403));
  forbidden.signIn();
  await assert.rejects(forbidden.client.playlists(), /Premium.*allowlist/);
  const malformed = fixture(async () => response({ items: 'not a list' }));
  malformed.signIn();
  await assert.rejects(malformed.client.playlists(), /incomplete playlist response/);
});

test('the request timeout also covers a stalled response body', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { client, signIn } = fixture(async (url, { signal }) => ({
    status: 200,
    ok: true,
    headers: new Headers(),
    text: () => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }),
  }));
  signIn();
  const request = client.profile();
  const rejected = assert.rejects(request, /too long to respond/);
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
  t.mock.timers.tick(15_000);
  await rejected;
});

test('playback transfers to the browser, disables Spotify repeat/shuffle, and queues only one song', async () => {
  const requests = [];
  const { client, signIn } = fixture(async (url, options) => {
    requests.push([url, options]);
    return response(null, 204);
  });
  signIn();
  await client.preparePlayback('browser-device');
  await client.play('browser-device', { uri: 'spotify:track:track1' }, 12_345.9);
  assert.deepEqual(JSON.parse(requests[0][1].body), { device_ids: ['browser-device'], play: false });
  assert.match(requests[1][0], /repeat\?state=off&device_id=browser-device/);
  assert.match(requests[2][0], /shuffle\?state=false&device_id=browser-device/);
  assert.deepEqual(JSON.parse(requests[3][1].body), { uris: ['spotify:track:track1'], position_ms: 12_345 });
  assert.ok(requests.every(([, options]) => options.method === 'PUT'));
});
