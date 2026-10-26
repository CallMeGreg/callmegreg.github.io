import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readPriorTracks } from './harvest-soundcloud.mjs';
import { fetchOembed, isSoundCloudEmbed, parseCsv, searchTracks, toCsv } from './soundcloud.mjs';

const TRACK = 'https://soundcloud.com/artist/track';
const PLAYER = 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/123';

test('track CSV round-trips quoted commas, quotes, and newlines without shifting columns', () => {
  const rows = [{ artist: 'Artist & Friend', title: 'Song, "VIP"\nMix', soundcloudUrl: TRACK }];
  const headers = ['artist', 'title', 'soundcloudUrl'];
  assert.deepEqual(parseCsv(toCsv(rows, headers)), { headers, rows });
  assert.deepEqual(parseCsv('artist,title\r\n Artist , Song \r\n\r\n').rows,
    [{ artist: 'Artist', title: 'Song' }]);
});

test('malformed CSV and missing required columns fail explicitly', () => {
  for (const text of [
    'artist,title\nArtist,"unfinished',
    'artist,title\nArtist,Song,unexpected',
    'artist,title\nArtist',
    'title,soundcloudUrl\nSong,https://soundcloud.com/artist/track',
  ]) {
    assert.throws(() => parseCsv(text), /CSV/);
  }
});

test('search sends only artist/title to a fixed endpoint and cannot follow redirects', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.origin, 'https://api-v2.soundcloud.com');
    assert.equal(url.pathname, '/search/tracks');
    assert.deepEqual([...url.searchParams], [
      ['q', 'Artist & Friend Song, "VIP" &limit=100'],
      ['limit', '8'],
      ['client_id', 'test-client-id'],
    ]);
    assert.deepEqual(options, { redirect: 'error' });
    return Response.json({ collection: [{ id: 123 }] });
  });
  const { rows } = parseCsv('artist,title,private\nArtist & Friend,"Song, ""VIP"" &limit=100",not-for-upload\n');
  assert.deepEqual(await searchTracks(rows[0].artist, rows[0].title, 'test-client-id'), [{ id: 123 }]);
  assert.equal(fetch.mock.callCount(), 1);
});

test('invalid search metadata is rejected before any network request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('Unexpected request'));
  for (const value of ['', ' ', null, undefined, 123, 'x'.repeat(301), 'line\nbreak', 'nul\0byte', 'del\u007f']) {
    await assert.rejects(searchTracks(value, 'Song', 'client'), /Invalid track artist/);
    await assert.rejects(searchTracks('Artist', value, 'client'), /Invalid track title/);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('valid search terms retain punctuation and the 300-character boundary', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.searchParams.get('q'), `${'a'.repeat(300)} Song (VIP) [feat. Artist]`);
    return Response.json({ collection: [] });
  });
  assert.deepEqual(await searchTracks('a'.repeat(300), 'Song (VIP) [feat. Artist]', 'client'), []);
});

test('search failures do not look like an empty result', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429 }));
  await assert.rejects(searchTracks('Artist', 'Song', 'client'), /HTTP 429/);
  fetch.mock.mockImplementation(async () => { throw new Error('Redirect rejected'); });
  await assert.rejects(searchTracks('Artist', 'Song', 'client'), /Redirect rejected/);
});

test('oEmbed requests are limited to public track permalinks and do not follow redirects', async (t) => {
  const response = Response.json({ html: `<iframe src="${PLAYER}"></iframe>` });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.origin, 'https://soundcloud.com');
    assert.equal(url.pathname, '/oembed');
    assert.deepEqual([...url.searchParams], [['format', 'json'], ['url', TRACK]]);
    assert.deepEqual(options, { redirect: 'error' });
    return response;
  });
  assert.equal(await fetchOembed(TRACK), response);
});

test('untrusted or non-track oEmbed URLs never trigger a request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('Unexpected request'));
  for (const url of [
    '', null, 'not a URL', '//soundcloud.com/artist/track',
    'http://soundcloud.com/artist/track',
    'https://soundcloud.com.evil.example/artist/track',
    'https://evil.example/soundcloud.com/artist/track',
    'https://soundcloud.com@evil.example/artist/track',
    'https://user:password@soundcloud.com/artist/track',
    'https://soundcloud.com:444/artist/track',
    'https://soundcloud.com/artist',
    'https://soundcloud.com/artist/sets/playlist',
    `${TRACK}?secret=private`,
    `${TRACK}#private`,
    `${TRACK}\n`,
    'file:///private/data',
    `https://soundcloud.com/artist/${'x'.repeat(2048)}`,
  ]) {
    await assert.rejects(fetchOembed(url));
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('player validation accepts real quoted and unquoted iframe src attributes', () => {
  for (const html of [
    `<iframe width="100%" height="166" scrolling="no" frameborder="no" src="${PLAYER}"></iframe>`,
    `<iframe title="A > B" src='${PLAYER}'></iframe><div>Artist</div>`,
    ` <IFRAME SRC="${PLAYER}&amp;auto_play=false"></IFRAME>`,
    `<iframe src=${PLAYER}></iframe>`,
  ]) {
    assert.equal(isSoundCloudEmbed(html), true, html);
  }
});

test('player validation rejects host spoofing and SoundCloud text outside an iframe src', () => {
  for (const html of [
    undefined, {}, '', 'soundcloud.com',
    '<a href="https://soundcloud.com/artist/track">Track</a>',
    '<iframe src="https://w.soundcloud.com.evil.example/player/"></iframe>',
    '<iframe src="https://evil.example/player/?site=soundcloud.com"></iframe>',
    '<iframe src="https://w.soundcloud.com@evil.example/player/"></iframe>',
    '<iframe src="https://evil.example/w.soundcloud.com/player/"></iframe>',
    '<iframe src="http://w.soundcloud.com/player/"></iframe>',
    '<iframe src="//w.soundcloud.com/player/"></iframe>',
    '<iframe src="https://user:pass@w.soundcloud.com/player/"></iframe>',
    '<iframe src="https://w.soundcloud.com:444/player/"></iframe>',
    '<iframe src="https://w.soundcloud.com/not-player/"></iframe>',
    '<iframe src="not a URL" title="soundcloud.com"></iframe>',
    `<iframe data-src="${PLAYER}" src="https://evil.example"></iframe>`,
    `<iframe title='src="${PLAYER}"' src="https://evil.example"></iframe>`,
    `<iframe src="${PLAYER}" src="https://evil.example"></iframe>`,
    `<iframe data-src="${PLAYER}"></iframe>`,
    `<!-- <iframe src="${PLAYER}"></iframe> -->`,
  ]) {
    assert.equal(isSoundCloudEmbed(html), false, String(html));
  }
});

test('prior tracks are read directly and keep curated fields indexed by URL and artist/title', (t) => {
  t.mock.method(fs, 'existsSync', () => assert.fail('Do not check before reading'));
  const read = t.mock.method(fs, 'readFileSync', () =>
    `artist,title,bpm,camelot,vibe,soundcloudUrl\nArtist,"Song, VIP",174,6A,roller,${TRACK}\n`);
  const prior = readPriorTracks('catalog.csv');
  assert.equal(read.mock.callCount(), 1);
  assert.deepEqual(read.mock.calls[0].arguments, ['catalog.csv', 'utf8']);
  assert.equal(prior.get(TRACK), prior.get('artist|songvip'));
  assert.equal(prior.get(TRACK).bpm, '174');
  assert.equal(prior.get(TRACK).camelot, '6A');
  assert.equal(prior.get(TRACK).vibe, 'roller');
});

test('only a missing prior catalog is allowed; other read and CSV errors propagate', (t) => {
  const read = t.mock.method(fs, 'readFileSync', () => {
    throw Object.assign(new Error('Missing catalog'), { code: 'ENOENT' });
  });
  assert.equal(readPriorTracks('missing.csv').size, 0);
  for (const code of ['EACCES', 'EIO', 'EISDIR']) {
    read.mock.mockImplementation(() => { throw Object.assign(new Error(code), { code }); });
    assert.throws(() => readPriorTracks('catalog.csv'), { code });
  }
  read.mock.mockImplementation(() => 'artist,title\nArtist,"unfinished');
  assert.throws(() => readPriorTracks('catalog.csv'), /Invalid track CSV/);
});

test('the checked-in catalog round-trips and all tracks satisfy the request validation', async (t) => {
  const catalog = parseCsv(fs.readFileSync(new URL('../public/dropkit-tracks.csv', import.meta.url), 'utf8'));
  assert.ok(catalog.rows.length > 0);
  assert.deepEqual(parseCsv(toCsv(catalog.rows, catalog.headers)), catalog);
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ collection: [] }));
  for (const row of catalog.rows) {
    await searchTracks(row.artist, row.title, 'test-client-id');
    await fetchOembed(row.soundcloudUrl);
  }
  assert.equal(fetch.mock.callCount(), catalog.rows.length * 2);
});
