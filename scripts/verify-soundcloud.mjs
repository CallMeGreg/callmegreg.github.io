#!/usr/bin/env node
/*
 * Strict verification pass for DropKit's track list.
 *
 * Every row must link to a real, embeddable SoundCloud song. We confirm each
 * `soundcloudUrl` resolves through SoundCloud's public oEmbed endpoint (200 +
 * a thumbnail/html payload). Rows that are missing a URL or fail to resolve are
 * dropped. Writes the filtered list back to public/dropkit-tracks.csv.
 *
 * Usage: node scripts/verify-soundcloud.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '..', 'public', 'dropkit-tracks.csv');
const DRY = process.argv.includes('--dry');
const CONCURRENCY = 8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
function parseCsv(text) {
  const lines = text.trim().split('\n');
  const headers = splitCsvLine(lines.shift());
  return {
    headers,
    rows: lines.map((line) => {
      const cells = splitCsvLine(line);
      const row = {};
      headers.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()));
      return row;
    }),
  };
}
function csvCell(v) {
  const s = String(v ?? '');
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows, headers) {
  return (
    headers.join(',') +
    '\n' +
    rows.map((r) => headers.map((h) => csvCell(r[h])).join(',')).join('\n') +
    '\n'
  );
}

async function verify(url) {
  if (!url) return false;
  const oembed = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(oembed, { redirect: 'follow' });
      if (res.status === 429) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      if (!res.ok) return false;
      const data = await res.json();
      // A real, embeddable track returns an html iframe + thumbnail.
      return Boolean(data && data.html && /soundcloud\.com/.test(data.html));
    } catch {
      await sleep(300 * (attempt + 1));
    }
  }
  return false;
}

async function main() {
  const { headers, rows } = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  console.log(`Verifying ${rows.length} rows via oEmbed (concurrency ${CONCURRENCY})…\n`);

  const results = new Array(rows.length);
  let idx = 0;
  let done = 0;
  async function worker() {
    while (idx < rows.length) {
      const i = idx++;
      results[i] = await verify(rows[i].soundcloudUrl);
      done++;
      if (done % 40 === 0) console.log(`  …${done}/${rows.length}`);
      await sleep(40);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const kept = [];
  const removed = [];
  rows.forEach((r, i) => (results[i] ? kept.push(r) : removed.push(r)));

  // De-dupe within each genre by permalink, then cap each tier so every genre
  // lands at a clean 50 mainstream / 50 underground (100 total). Harvest order is
  // freshness-ranked, so keeping the first N keeps the most current tracks.
  const MAX_PER_TIER = 50;
  const seen = new Set();
  const tierCount = {};
  const deduped = [];
  for (const r of kept) {
    const k = `${r.subgenre}::${r.soundcloudUrl}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const tk = `${r.subgenre}::${r.tier}`;
    tierCount[tk] = tierCount[tk] || 0;
    if (tierCount[tk] >= MAX_PER_TIER) continue;
    tierCount[tk]++;
    deduped.push(r);
  }

  const byGenre = {};
  for (const r of deduped) {
    byGenre[r.subgenre] = byGenre[r.subgenre] || { total: 0, mainstream: 0, underground: 0 };
    byGenre[r.subgenre].total++;
    byGenre[r.subgenre][r.tier]++;
  }

  console.log(`\nRemoved ${removed.length} unverifiable/duplicate row(s):`);
  for (const r of removed) console.log(`  ✗ [${r.subgenre}] ${r.artist} — ${r.title}  (${r.soundcloudUrl || 'no url'})`);
  console.log('\nVerified counts by genre:');
  for (const [g, c] of Object.entries(byGenre)) console.log(`  ${g}: ${c.total} (mainstream ${c.mainstream}, underground ${c.underground})`);

  if (DRY) {
    console.log('\n[dry run] CSV not written.');
    return;
  }
  fs.writeFileSync(CSV_PATH, toCsv(deduped, headers));
  console.log(`\nWrote ${deduped.length} verified rows to ${path.relative(process.cwd(), CSV_PATH)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
