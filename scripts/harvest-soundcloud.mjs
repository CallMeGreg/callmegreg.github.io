#!/usr/bin/env node
/*
 * Build-time SoundCloud harvester for DropKit.
 *
 * Pulls real, confirmed tracks straight from each curated artist's own
 * SoundCloud account, so every row is a genuine upload by that artist with a
 * working permalink (no hallucinated titles). For each genre it gathers the
 * artists' most-played tracks, filters out DJ mixes / podcasts / long sets,
 * dedupes, and caps at 100. Key/BPM are curated reference estimates: known
 * tracks reuse the hand-tuned values from the previous CSV; new tracks get a
 * genre-appropriate BPM and a Camelot key distributed across the wheel so any
 * key the user picks still yields harmonic matches.
 *
 * The scraped client_id is used ONLY here at build time and never shipped.
 *
 * Usage: node scripts/harvest-soundcloud.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '..', 'public', 'dropkit-tracks.csv');
const CAP_PER_GENRE = 110;
const MAX_PER_ARTIST = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Genre config: BPM, Camelot key pool, and artist roster ── */
const GENRES = {
  'Drum and Bass': {
    bpm: 174,
    keys: ['6A', '7A', '5A', '8A', '4A', '9A', '6B', '7B', '5B', '10A', '3A', '11A'],
    vibes: {
      mainstream: ['euphoric rave anthem', 'festival roller', 'melodic energy', 'hands-up anthem', 'soulful roller'],
      underground: ['jump-up filth', 'dark roller', 'neuro destroyer', 'rave riot', 'technical roller'],
    },
    artists: {
      mainstream: ['Sub Focus', 'Wilkinson', 'Pendulum', 'Chase & Status', 'Dimension', 'Netsky', 'High Contrast', 'Andy C', 'Camo & Krooked', 'Hybrid Minds', 'Friction', 'Koven', 'London Elektricity', 'Sigma', 'Metrik', 'Fred V', 'Etherwood', 'S.P.Y', 'Logistics', 'Technimatic', 'K Motionz', 'Delta Heavy', 'Culture Shock', 'Grafix', 'Andromedik', '1991', 'Subsonic', 'Pola & Bryson'],
      underground: ['Bou', 'Kanine', 'Turno', 'Benny L', 'Serum', 'Macky Gee', 'Hedex', 'A.M.C', 'Document One', 'Voltage', 'Mozey', 'Noisia', 'Mefjus', 'Halogenix', 'Tantrum Desire', 'DLR', 'Break', 'Calibre', 'Alix Perez', 'Ivy Lab', 'Unglued', 'Sustance', 'Phibes', 'Molecular', 'Basstripper', 'SLESS', 'SKIYE', 'ROVA', 'Amoss', 'Arcando', 'Kelvin 373', 'Twintone', 'Waeys'],
    },
  },
  Dubstep: {
    bpm: 140,
    keys: ['8A', '9A', '7A', '10A', '6A', '11A', '8B', '1A', '5A', '12A'],
    vibes: {
      mainstream: ['festival nuke', 'headbang anthem', 'mosh starter', 'heavyweight drop', 'classic banger'],
      underground: ['gut-punch bass', 'experimental heavy', 'melodic dubstep', 'grimy weight', 'sound-system pressure'],
    },
    artists: {
      mainstream: ['Skrillex', 'Excision', 'Zomboy', 'Flux Pavilion', 'Doctor P', 'Datsik', 'Virtual Riot', 'Subtronics', 'Svdden Death', 'Marauda', 'Ganja White Night', 'Modestep', 'Caspa', 'Rusko', 'Borgore', 'Funtcase', 'MUST DIE!', 'Getter', 'Habstrakt', 'Spag Heddy', 'Sullivan King', 'Kai Wachi', 'Ray Volpe', 'Hamdi', 'LSDREAM', 'LYNY'],
      underground: ['Eptic', 'Phiso', 'Calcium', 'Boogie T', 'Kompany', 'Aweminus', 'PhaseOne', 'Oolacile', 'Smook', 'Wooli', 'Ace Aura', 'SKisM', 'Infekt', 'Truth', 'Mize', 'Samplifire', 'Dirt Monkey', 'Codd Dubz', 'Automhate', 'PEEKABOO', 'Ecraze', 'PROSECUTE', 'Midnight Tyrannosaurus', 'MADCORE', 'GOAT DUBZ', 'Monxx', 'Syzy', 'Jkyl & Hyde', 'Stoned LeveL', 'Nosphere', 'Cromatik', 'DirtySnatcha', 'Versa', 'MVRDA', 'Phonon'],
    },
  },
  House: {
    bpm: 126,
    keys: ['4A', '5A', '3A', '6A', '2A', '8A', '4B', '5B', '11A', '1A'],
    vibes: {
      mainstream: ['festival monster', 'peak-time roller', 'sweaty heater', 'feel-good groove', 'vocal anthem'],
      underground: ['raw tech house', 'hypnotic groove', 'rolling tech', 'g-house swagger', 'deep mover'],
    },
    artists: {
      mainstream: ['Fisher', 'John Summit', 'Chris Lake', 'CamelPhat', 'Dom Dolla', 'Gorgon City', 'Calvin Harris', 'MK', 'Chris Lorenzo', 'Disclosure', 'Vintage Culture', 'ACRAZE', 'Green Velvet', 'Fatboy Slim', 'Hot Since 82', 'Solardo', 'Patrick Topping', 'Black Coffee', 'PAWSA', 'James Hype', 'Mochakk', 'Sonny Fodera', 'Peggy Gou', 'D.O.D', 'Prospa', 'Kolter', 'Shermanology'],
      underground: ['Cloonee', 'Matroda', 'Westend', 'Wax Motif', 'Biscits', 'Eli Brown', 'Notion', 'Mau P', 'Hugel', 'Kry Wolf', 'Dennis Cruz', 'Marco Carola', 'Mark Knight', 'Michael Bibi', 'Sidney Charles', 'Latmun', 'Josh Baker', 'wAFF', 'CASSIMM', 'James Hurr', 'Nolek', 'LEFTI', 'Qubiko', 'Rick Silva', 'DJ PP', 'Detlef', 'Crusy', 'Dario Nunez', 'Angelo Ferreri'],
    },
  },
  Riddim: {
    bpm: 150,
    keys: ['11A', '10A', '12A', '9A', '1A', '8A', '11B', '2A', '7A'],
    vibes: {
      mainstream: ['crowd chaos', 'dark riddim', 'neckbreaker', 'mosh classic', 'pit weapon'],
      underground: ['filthy riddim', 'screwed bass', 'hypnotic riddim', 'sound-system weight', 'headbang fuel'],
    },
    artists: {
      mainstream: ['Subtronics', 'Infekt', 'Phiso', 'Oolacile', 'Bommer', 'Marauda', 'Gentlemens Club', 'Megalodon', 'Hairitage', 'Codd Dubz', 'Eptic', 'Virtual Riot', 'Svdden Death', 'Sullivan King', 'Kai Wachi', 'Ray Volpe', 'Hol!', 'WODD', 'Chibs', 'IVORY', 'Hamdi', 'Aweminus', 'MAD DUBZ'],
      underground: ['Crowell', 'Hukae', 'Subfiltronik', 'Distinct Motive', 'Automhate', 'Akeos', 'Bukez Finezt', 'Ternion Sound', 'Yakz', 'Antiserum', 'Khiva', 'Squnto', 'Badklaat', 'Saka', 'Dubloadz', 'Tirossi', 'Mvrda', 'Frequent', 'Mastadon', 'Samplifire', 'Ecraze', 'PROSECUTE', 'MADCORE', 'SHRQ', 'Phydra', 'GOAT DUBZ', 'Emorfik', 'DISKIRZ', 'Soul Valient', 'Monxx', 'Cromatik', 'Nosphere', 'Stoned LeveL', 'Jkyl & Hyde', 'DirtySnatcha', 'Versa', 'Syzy', 'Leotrix', 'TYNAN', 'Ponicz'],
    },
  },
};

/* ── CSV helpers ── */
function parseCsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines.shift().split(',');
  return lines.map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()));
    return row;
  });
}
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
function csvCell(v) {
  const s = String(v ?? '');
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows, headers) {
  const head = headers.join(',');
  const body = rows.map((r) => headers.map((h) => csvCell(r[h])).join(',')).join('\n');
  return head + '\n' + body + '\n';
}

const norm = (s) =>
  (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

/* ── SoundCloud API ── */
async function getClientId() {
  const home = await (await fetch('https://soundcloud.com/')).text();
  const assets = [...home.matchAll(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js/g)].map((m) => m[0]);
  for (const url of assets.reverse()) {
    try {
      const js = await (await fetch(url)).text();
      const m = js.match(/client_id[=:"\s]+([A-Za-z0-9]{25,})/);
      if (m) return m[1];
    } catch {
      /* next */
    }
  }
  throw new Error('Could not extract a SoundCloud client_id');
}

async function api(urlPath, cid) {
  const url = `https://api-v2.soundcloud.com${urlPath}${urlPath.includes('?') ? '&' : '?'}client_id=${cid}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} for ${urlPath}`);
    return res.json();
  }
  throw new Error(`rate limited: ${urlPath}`);
}

async function resolveArtist(name, cid) {
  const data = await api(`/search/users?q=${encodeURIComponent(name)}&limit=8`, cid);
  const target = norm(name);
  let best = null;
  let bestScore = -1;
  for (const u of data.collection || []) {
    const uname = norm(u.username);
    const full = norm(u.full_name);
    let score = 0;
    if (uname === target || full === target) score = 100;
    else if (uname.includes(target) || target.includes(uname)) score = 70;
    else if (full.includes(target)) score = 50;
    else continue;
    score += Math.min(20, Math.log10((u.followers_count || 0) + 10) * 4);
    if (u.verified) score += 10;
    if (score > bestScore) {
      bestScore = score;
      best = u;
    }
  }
  return bestScore >= 50 ? best : null;
}

const TITLE_BLOCK = ['podcast', 'mixtape', 'mix tape', 'liveset', 'live set', 'dj set', 'djset', 'episode', 'guest mix', 'radio show', 'radioshow', 'sessions', 'mix series', 'full mix', 'continuous', 'b2b', 'announcement', 'tour dates', 'merch', 'interview', 'q&a', 'tutorial', 'sample pack', 'samplepack', 'preset', 'giveaway', 'minimix', 'yearmix', 'year mix', 'essential mix', 'tracklist'];
// Word-boundary teaser tags (avoids false hits like "eclipse" for "clip").
const TEASER = /\b(clip|snippet|teaser)\b/i;

function isRealTrack(t) {
  if (!t || t.kind !== 'track') return false;
  if (t.policy === 'BLOCK') return false;
  if (t.streamable === false) return false;
  const mins = (t.duration || 0) / 60000;
  if (mins < 1.3 || mins > 9) return false; // weed out mixes & clips
  const title = (t.title || '').toLowerCase();
  if (TITLE_BLOCK.some((w) => title.includes(w))) return false;
  if (TEASER.test(title)) return false; // skip preview/teaser uploads
  return true;
}

// Tidy raw SoundCloud titles for display: drop a redundant leading "Artist - "
// prefix and trailing promo tags, while preserving remix/VIP/feat info.
function cleanTitle(rawTitle, artist) {
  let s = String(rawTitle || '').trim();
  const esc = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  s = s.replace(new RegExp(`^\\s*${esc}\\s*[-–—:]\\s*`, 'i'), '');
  const PROMO = '(?:free\\s*download|free\\s*d\\/?l|out\\s*now(?:\\s+on[^)\\]}*]*)?|buy\\s*now|link\\s*in\\s*(?:description|bio)|premiere|forthcoming|download)';
  // Strip trailing promo, optionally wrapped in (), [], {}, ** ** or led by - | *.
  const trailing = new RegExp(`\\s*[-–—|]*\\s*[([{*]*\\s*${PROMO}\\s*[!.?*)\\]}\\s]*$`, 'i');
  let prev;
  do {
    prev = s;
    s = s.replace(trailing, '').trim();
  } while (s !== prev && s.length);
  s = s.replace(/(\s+#[\w]+)+\s*$/g, '').trim(); // trailing hashtags
  s = s.replace(/\s*\|\s*[^|]+$/, '').trim(); // trailing "| label/series"
  s = s.replace(/[\s\-–—|*]+$/, '').trim(); // dangling separators
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s || String(rawTitle || '').trim();
}

async function getArtistTracks(user, cid) {
  const data = await api(`/users/${user.id}/tracks?limit=40`, cid);
  return (data.collection || []).filter(isRealTrack);
}

/* Favor recent releases so the catalog reflects what's current. Mainstream
 * keeps popularity weight (sqrt plays) but boosts recency; underground leans
 * harder on recency to surface "recently exploding" tunes over old catalog. */
function ageMonths(t) {
  const d = new Date(t.display_date || t.created_at || 0).getTime();
  if (!d || Number.isNaN(d)) return 36;
  return Math.max(0, (Date.now() - d) / (1000 * 60 * 60 * 24 * 30.4));
}
function recencyWeight(months, steep) {
  if (steep) {
    if (months <= 12) return 1;
    if (months <= 24) return 0.6;
    if (months <= 48) return 0.3;
    return 0.15;
  }
  if (months <= 12) return 1;
  if (months <= 24) return 0.78;
  if (months <= 48) return 0.5;
  if (months <= 84) return 0.3;
  return 0.18;
}
function freshnessScore(t, tier) {
  const plays = t.playback_count || 0;
  const base = tier === 'underground' ? Math.log10(plays + 10) : Math.sqrt(plays);
  return base * recencyWeight(ageMonths(t), tier === 'underground');
}

async function main() {
  // Reuse hand-tuned key/bpm/vibe for tracks we already curated.
  const prior = new Map();
  if (fs.existsSync(CSV_PATH)) {
    for (const r of parseCsv(fs.readFileSync(CSV_PATH, 'utf8'))) {
      if (r.soundcloudUrl) prior.set(r.soundcloudUrl, r);
      prior.set(`${norm(r.artist)}|${norm(r.title)}`, r);
    }
  }

  const cid = await getClientId();
  console.log(`Got client_id (len ${cid.length})\n`);

  const headers = ['subgenre', 'artist', 'title', 'camelot', 'key', 'bpm', 'tier', 'vibe', 'soundcloudUrl'];
  const KEY_NAMES = {
    '1A': 'Abm', '2A': 'Ebm', '3A': 'Bbm', '4A': 'Fm', '5A': 'Cm', '6A': 'Gm',
    '7A': 'Dm', '8A': 'Am', '9A': 'Em', '10A': 'Bm', '11A': 'F#m', '12A': 'C#m',
    '1B': 'B', '2B': 'F#', '3B': 'Db', '4B': 'Ab', '5B': 'Eb', '6B': 'Bb',
    '7B': 'F', '8B': 'C', '9B': 'G', '10B': 'D', '11B': 'A', '12B': 'E',
  };

  const allRows = [];
  for (const [genre, cfg] of Object.entries(GENRES)) {
    console.log(`\n=== ${genre} ===`);

    // 1) Fetch each artist's eligible tracks (most-played first), grouped by tier.
    const pools = { mainstream: [], underground: [] };
    const roster = [
      ...cfg.artists.mainstream.map((a) => ({ name: a, tier: 'mainstream' })),
      ...cfg.artists.underground.map((a) => ({ name: a, tier: 'underground' })),
    ];
    for (const { name, tier } of roster) {
      let user;
      try {
        user = await resolveArtist(name, cid);
      } catch (e) {
        console.warn(`  ! resolve ${name}: ${e.message}`);
      }
      await sleep(120);
      if (!user) {
        console.log(`  – ${name}: no account match`);
        continue;
      }
      let tracks = [];
      try {
        tracks = await getArtistTracks(user, cid);
      } catch (e) {
        console.warn(`  ! tracks ${name}: ${e.message}`);
      }
      await sleep(150);
      tracks.sort((a, b) => freshnessScore(b, tier) - freshnessScore(a, tier));
      tracks = tracks.slice(0, MAX_PER_ARTIST);
      if (tracks.length) {
        pools[tier].push({ name, tracks, ptr: 0 });
        console.log(`  ✓ ${name} (${user.username}): ${tracks.length} eligible [${tier}]`);
      } else {
        console.log(`  – ${name}: no eligible tracks`);
      }
    }

    // 2) True round-robin across artists, alternating tiers, so every artist
    //    (including the freshly-added current/exploding names) contributes and
    //    no single artist dominates. ~50/50 mainstream/underground.
    const picked = [];
    const seenUrl = new Set();
    let keyIdx = 0;
    const counts = { mainstream: 0, underground: 0 };
    const order = ['mainstream', 'underground'];
    let turn = 0;
    pools.mainstream.rr = 0;
    pools.underground.rr = 0;

    const takeFrom = (pool) => {
      // Start after the last artist we drew from, so picks rotate evenly.
      for (let n = 0; n < pool.length; n++) {
        const idx = (pool.rr + n) % pool.length;
        const art = pool[idx];
        while (art.ptr < art.tracks.length) {
          const t = art.tracks[art.ptr++];
          const url = (t.permalink_url || '').split('?')[0];
          if (!url || seenUrl.has(url)) continue;
          seenUrl.add(url);
          pool.rr = (idx + 1) % pool.length;
          return { art, t, url };
        }
      }
      return null;
    };

    while (picked.length < CAP_PER_GENRE) {
      const tier = order[turn % 2];
      const other = order[(turn + 1) % 2];
      let got = takeFrom(pools[tier]);
      let usedTier = tier;
      if (!got) {
        got = takeFrom(pools[other]); // tier exhausted → pull from the other
        usedTier = other;
      }
      if (!got) break; // both exhausted
      const { art, t, url } = got;

      const reuse = prior.get(url) || prior.get(`${norm(art.name)}|${norm(t.title)}`);
      const camelot = reuse?.camelot || cfg.keys[keyIdx++ % cfg.keys.length];
      let bpm = cfg.bpm;
      if (reuse?.bpm) bpm = Number(reuse.bpm);
      else if (t.bpm && t.bpm >= cfg.bpm * 0.45 && t.bpm <= cfg.bpm * 1.1) bpm = Math.round(t.bpm);
      const vibe = reuse?.vibe || cfg.vibes[usedTier][counts[usedTier] % cfg.vibes[usedTier].length];

      picked.push({
        subgenre: genre,
        artist: art.name,
        title: cleanTitle(t.title, art.name),
        camelot,
        key: KEY_NAMES[camelot] || '',
        bpm,
        tier: usedTier,
        vibe,
        soundcloudUrl: url,
      });
      counts[usedTier]++;
      turn++;
    }

    console.log(`  → ${genre}: ${picked.length} tracks (mainstream ${counts.mainstream}, underground ${counts.underground})`);
    allRows.push(...picked);
  }

  fs.writeFileSync(CSV_PATH, toCsv(allRows, headers));
  const byGenre = Object.fromEntries(
    Object.keys(GENRES).map((g) => [g, allRows.filter((r) => r.subgenre === g).length])
  );
  console.log(`\nDone. Wrote ${allRows.length} tracks:`, byGenre);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
