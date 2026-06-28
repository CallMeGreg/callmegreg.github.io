#!/usr/bin/env node
/*
 * Build-time SoundCloud permalink resolver for DROPKIT.
 *
 * Reads public/dropkit-tracks.csv (artist/title), searches SoundCloud's
 * internal search, scores candidates, verifies the winner via the public
 * oEmbed endpoint, and writes a `soundcloudUrl` column back to the CSV.
 *
 * The scraped client_id is used ONLY here at build time and is never shipped
 * to the browser — the app itself only ever loads SoundCloud's public embed
 * player (which needs no key). Tracks with no confident match get an empty
 * soundcloudUrl and the app falls back to a search link.
 *
 * Usage: node scripts/resolve-soundcloud.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '..', 'public', 'dropkit-tracks.csv');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Minimal CSV parse/stringify (no quoted fields in our data) ── */
function parseCsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines.shift().split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()));
    return row;
  });
}
function toCsv(rows, headers) {
  const head = headers.join(',');
  const body = rows.map((r) => headers.map((h) => r[h] ?? '').join(',')).join('\n');
  return head + '\n' + body + '\n';
}

/* ── Scrape a working client_id from soundcloud.com ── */
async function getClientId() {
  const home = await (await fetch('https://soundcloud.com/')).text();
  const assets = [...home.matchAll(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js/g)].map((m) => m[0]);
  for (const url of assets.reverse()) {
    try {
      const js = await (await fetch(url)).text();
      const m = js.match(/client_id[=:"\s]+([A-Za-z0-9]{25,})/);
      if (m) return m[1];
    } catch {
      /* try next */
    }
  }
  throw new Error('Could not extract a SoundCloud client_id');
}

/* ── Text normalization & scoring ── */
const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(feat|ft|featuring|original mix|extended mix|radio edit)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokens = (s) => new Set(norm(s).split(' ').filter(Boolean));
function overlap(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return hit / A.size;
}

// Words that signal a different/unwanted upload when NOT in the query.
const ALT_WORDS = ['remix', 'vip', 'bootleg', 'flip', 'mashup', 'edit', 'rework', 'cover', 'sped up', 'slowed'];
const MIX_WORDS = ['podcast', 'mixtape', 'mix tape', 'live set', 'dj set', 'liveset', 'episode', 'guest mix', 'radio show', 'sessions', 'b2b'];

function scoreCandidate(t, artist, title) {
  const qTitle = norm(title);
  const qArtist = norm(artist);
  const cTitle = norm(t.title || '');
  const cUser = norm(t.user?.username || '');

  let score = 0;
  // Title similarity (both directions) — heavily weighted.
  const tOverlap = Math.max(overlap(title, t.title), overlap(t.title, `${artist} ${title}`));
  score += tOverlap * 60;
  if (cTitle.includes(qTitle) && qTitle.length > 2) score += 25;

  // Artist match: official account or artist named in title.
  if (cUser.includes(qArtist) || qArtist.includes(cUser)) score += 25;
  else if (cTitle.includes(qArtist)) score += 12;
  else score -= 10;

  // Penalize alt versions / DJ mixes unless the query asked for them.
  for (const w of ALT_WORDS) if (cTitle.includes(w) && !qTitle.includes(w)) score -= 18;
  for (const w of MIX_WORDS) if (cTitle.includes(w) && !qTitle.includes(w)) score -= 40;

  // Duration: real tracks are usually 1.5–9 min; long uploads are mixes.
  const mins = (t.duration || 0) / 60000;
  if (mins > 12) score -= 50;
  else if (mins > 9) score -= 20;
  else if (mins >= 1.5 && mins <= 8) score += 8;

  // Popularity tiebreaker (tiny weight).
  score += Math.min(8, Math.log10((t.playback_count || 0) + 10));

  // Prefer streamable/public.
  if (t.streamable === false) score -= 30;
  if (t.policy === 'BLOCK') score -= 50;

  return score;
}

const ACCEPT_THRESHOLD = 55;

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'is', 'in', 'on', 'and', '&']);
const collapse = (s) => norm(s).replace(/\s/g, '');

/*
 * Strict gate: a candidate is only accepted if BOTH the artist and the title
 * genuinely match — this rejects "right word, wrong song" hits (e.g. a generic
 * "Drugs" or "Demons" upload by an unrelated artist).
 */
function gate(t, artist, title) {
  const artistC = collapse(artist);
  const userC = collapse(t.user?.username || '');
  const candTitleC = collapse(t.title || '');
  const candTokens = tokens(t.title || '');

  // Artist must appear in the uploader handle or the track title.
  const artistOK =
    artistC.length >= 3 && (userC.includes(artistC) || candTitleC.includes(artistC));
  if (!artistOK) return false;

  // Title coverage: most distinctive title tokens must be present.
  const qTokens = [...tokens(title)].filter((w) => !STOP.has(w));
  if (qTokens.length === 0) return false;
  const hit = qTokens.filter((w) => candTokens.has(w)).length;
  const coverage = hit / qTokens.length;
  const needsAll = qTokens.length <= 2;
  if (needsAll ? coverage < 1 : coverage < 0.67) return false;

  // Reject DJ mixes / podcasts that slipped through unless explicitly queried.
  const ct = norm(t.title || '');
  const qt = norm(title);
  for (const w of MIX_WORDS) if (ct.includes(w) && !qt.includes(w)) return false;

  return true;
}

async function searchTracks(artist, title, cid) {
  const q = `${artist} ${title}`;
  const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&limit=8&client_id=${cid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`search ${res.status}`);
  const data = await res.json();
  return data.collection || [];
}

async function verifyOembed(permalink) {
  const url = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(permalink)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(text);
  const headers = Object.keys(rows[0]);
  if (!headers.includes('soundcloudUrl')) headers.push('soundcloudUrl');

  console.log(`Resolving ${rows.length} tracks…`);
  const cid = await getClientId();
  console.log(`Got client_id (len ${cid.length})\n`);

  let ok = 0;
  let miss = 0;
  for (const row of rows) {
    let best = null;
    let bestScore = -Infinity;
    try {
      const cands = await searchTracks(row.artist, row.title, cid);
      for (const c of cands) {
        if (!gate(c, row.artist, row.title)) continue;
        const s = scoreCandidate(c, row.artist, row.title);
        if (s > bestScore) {
          bestScore = s;
          best = c;
        }
      }
    } catch (e) {
      console.warn(`  search error for ${row.artist} - ${row.title}: ${e.message}`);
    }

    let accepted = '';
    if (best && bestScore >= ACCEPT_THRESHOLD) {
      const oe = await verifyOembed(best.permalink_url);
      if (oe && oe.html) accepted = best.permalink_url;
      await sleep(120);
    }

    row.soundcloudUrl = accepted;
    if (accepted) {
      ok++;
      console.log(`  ✅ ${row.artist} - ${row.title}  [${bestScore.toFixed(0)}]  -> ${accepted}`);
    } else {
      miss++;
      const why = best ? `best "${best.title}" score ${bestScore.toFixed(0)}` : 'no candidates';
      console.log(`  ⚠️  ${row.artist} - ${row.title}  (fallback to search; ${why})`);
    }
    await sleep(160);
  }

  fs.writeFileSync(CSV_PATH, toCsv(rows, headers));
  console.log(`\nDone. ${ok} embedded, ${miss} fallback. Wrote ${CSV_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
