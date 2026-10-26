import Papa from 'papaparse';

export function parseCsv(text) {
  const { data, errors, meta } = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transform: (value) => value.trim(),
  });
  if (errors.length) {
    throw new Error(`Invalid track CSV: ${errors.map((error) => error.message).join('; ')}`);
  }
  if (!['artist', 'title'].every((field) => meta.fields?.includes(field))) {
    throw new Error('Track CSV must include artist and title columns');
  }
  return { headers: meta.fields, rows: data };
}

export function toCsv(rows, headers) {
  return Papa.unparse({ fields: headers, data: rows }, { newline: '\n' }) + '\n';
}

function validateSearchTerm(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > 300 ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Invalid track ${field}: expected 1-300 characters without control characters`);
  }
}

export async function searchTracks(artist, title, clientId) {
  validateSearchTerm(artist, 'artist');
  validateSearchTerm(title, 'title');
  const url = new URL('https://api-v2.soundcloud.com/search/tracks');
  url.search = new URLSearchParams({
    q: `${artist} ${title}`,
    limit: '8',
    client_id: clientId,
  }).toString();
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw new Error(`SoundCloud search failed (HTTP ${response.status})`);
  const data = await response.json();
  return data.collection || [];
}

export async function fetchOembed(permalink) {
  if (typeof permalink !== 'string' || permalink.length > 2048 || /\s/.test(permalink)) {
    throw new Error('Invalid SoundCloud track URL');
  }
  const track = new URL(permalink);
  if (track.origin !== 'https://soundcloud.com' || track.username || track.password ||
      track.search || track.hash || !/^\/[a-z0-9_-]+\/[a-z0-9_-]+\/?$/i.test(track.pathname)) {
    throw new Error('Expected a public HTTPS SoundCloud track permalink without credentials or query parameters');
  }
  const url = new URL('https://soundcloud.com/oembed');
  url.search = new URLSearchParams({ format: 'json', url: track.href }).toString();
  return fetch(url, { redirect: 'error' });
}

export function isSoundCloudEmbed(html) {
  if (typeof html !== 'string') return false;
  // Read complete attributes so a data-src or text inside another value cannot stand in for src.
  const iframe = html.match(/^\s*<iframe\s+((?:[^"'<>]|"[^"]*"|'[^']*')*)>/i);
  if (!iframe) return false;
  const attributes = [...iframe[1].matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)];
  const sources = attributes.filter((attribute) => attribute[1].toLowerCase() === 'src');
  if (sources.length !== 1) return false;
  const source = sources[0][2] ?? sources[0][3] ?? sources[0][4];
  if (!source || !URL.canParse(source)) return false;
  const url = new URL(source);
  return url.origin === 'https://w.soundcloud.com' && url.pathname === '/player/' &&
    !url.username && !url.password;
}
