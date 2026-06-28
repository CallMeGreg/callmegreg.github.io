import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import './Dropkit.css';

/* ── localStorage keys (namespaced) ───────────────────────────── */
const STORAGE = {
  subgenre: 'dropkit.subgenre',
  targetKey: 'dropkit.targetKey',
  targetBpm: 'dropkit.targetBpm',
  tolerance: 'dropkit.bpmTolerance',
  halfDouble: 'dropkit.allowHalfDouble',
  neighbors: 'dropkit.includeNeighbors',
  tier: 'dropkit.tierPreference',
  playlist: 'dropkit.playlistName',
};
const ALL_KEYS = Object.values(STORAGE);

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

/* ── Subgenre presets ─────────────────────────────────────────── */
const SUBGENRES = {
  'Drum and Bass': {
    bpm: 174,
    key: '6A',
    accent: '#00f6ff',
    emoji: '🥁',
    blurb: '174 BPM rollers & jump-up — relentless energy that keeps the rave airborne.',
  },
  Dubstep: {
    bpm: 140,
    key: '8A',
    accent: '#a64bff',
    emoji: '🤖',
    blurb: '140 BPM headbangers — filthy, weighty drops engineered for the mosh pit.',
  },
  House: {
    bpm: 126,
    key: '4A',
    accent: '#ff8a00',
    emoji: '🕺',
    blurb: '124–128 BPM grooves — hypnotic, sweaty, hands-in-the-air tech house.',
  },
  Riddim: {
    bpm: 150,
    key: '11A',
    accent: '#ff2bd6',
    emoji: '👹',
    blurb: '150 BPM triplet bass — minimal, grimy, pure neck-snapping chaos.',
  },
};
const SUBGENRE_LIST = Object.keys(SUBGENRES);

/* ── Camelot wheel helpers ────────────────────────────────────── */
const CAMELOT_NAMES = {
  '1A': 'Abm', '2A': 'Ebm', '3A': 'Bbm', '4A': 'Fm', '5A': 'Cm', '6A': 'Gm',
  '7A': 'Dm', '8A': 'Am', '9A': 'Em', '10A': 'Bm', '11A': 'F#m', '12A': 'C#m',
  '1B': 'B', '2B': 'F#', '3B': 'Db', '4B': 'Ab', '5B': 'Eb', '6B': 'Bb',
  '7B': 'F', '8B': 'C', '9B': 'G', '10B': 'D', '11B': 'A', '12B': 'E',
};
const KEY_OPTIONS = Object.keys(CAMELOT_NAMES);

function parseCamelot(c) {
  const m = /^(\d{1,2})([AB])$/.exec(c || '');
  return m ? { num: Number(m[1]), letter: m[2] } : null;
}

// Lower = more compatible. 0 = identical key.
function keyScore(trackC, targetC) {
  const t = parseCamelot(trackC);
  const g = parseCamelot(targetC);
  if (!t || !g) return 99;
  if (t.num === g.num && t.letter === g.letter) return 0; // same key
  let d = Math.abs(t.num - g.num);
  d = Math.min(d, 12 - d); // wrap around the wheel
  if (t.num === g.num && t.letter !== g.letter) return 1; // relative maj/min
  if (d === 1 && t.letter === g.letter) return 1; // adjacent, same mode
  if (d === 1 && t.letter !== g.letter) return 3; // diagonal
  return 3 + d; // farther afield
}

// Closest BPM match, optionally allowing half/double-time mixing.
function bpmMatch(trackBpm, targetBpm, allowHalfDouble) {
  const opts = allowHalfDouble
    ? [
        { v: trackBpm, s: 'none' },
        { v: trackBpm / 2, s: 'half' },
        { v: trackBpm * 2, s: 'double' },
      ]
    : [{ v: trackBpm, s: 'none' }];
  opts.sort((a, b) => Math.abs(a.v - targetBpm) - Math.abs(b.v - targetBpm));
  return { dist: Math.abs(opts[0].v - targetBpm), shift: opts[0].s };
}

function scUrl(t) {
  return 'https://soundcloud.com/search?q=' + encodeURIComponent(`${t.artist} ${t.title}`);
}

// Best link for a track: the verified permalink if we have one, else a search.
function trackLink(t) {
  return t.soundcloudUrl || scUrl(t);
}

// SoundCloud embed player URL (public widget, no API key required).
function embedUrl(permalink) {
  const params = new URLSearchParams({
    url: permalink,
    color: '#a64bff',
    auto_play: 'true',
    hide_related: 'true',
    show_comments: 'false',
    show_user: 'true',
    show_reposts: 'false',
    show_teaser: 'false',
    visual: 'false',
  });
  return 'https://w.soundcloud.com/player/?' + params.toString();
}

function matchBadge(track, target, allowHalfDouble, tolerance) {
  const ks = keyScore(track.camelot, target.key);
  const { dist, shift } = bpmMatch(track.bpm, target.bpm, allowHalfDouble);
  if (ks === 0 && shift === 'none' && dist <= tolerance) return { label: '🎯 Perfect match', cls: 'perfect' };
  if (ks === 0 && shift === 'half') return { label: 'In key · ½× BPM', cls: 'good' };
  if (ks === 0 && shift === 'double') return { label: 'In key · 2× BPM', cls: 'good' };
  if (ks === 0) return { label: 'In key', cls: 'good' };
  if (ks <= 1) return { label: 'Harmonic neighbor', cls: 'ok' };
  return { label: 'Energy shift', cls: 'stretch' };
}

/* ── Component ────────────────────────────────────────────────── */
function Dropkit() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [subgenre, setSubgenre] = useState(() => load(STORAGE.subgenre, null));
  const [targetKey, setTargetKey] = useState(() => load(STORAGE.targetKey, '6A'));
  const [targetBpm, setTargetBpm] = useState(() => load(STORAGE.targetBpm, 174));
  const [tolerance, setTolerance] = useState(() => load(STORAGE.tolerance, 3));
  const [allowHalfDouble, setAllowHalfDouble] = useState(() => load(STORAGE.halfDouble, true));
  const [includeNeighbors, setIncludeNeighbors] = useState(() => load(STORAGE.neighbors, true));
  const [tierPref, setTierPref] = useState(() => load(STORAGE.tier, 'all'));
  const [playlistName, setPlaylistName] = useState(() => load(STORAGE.playlist, ''));

  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  /* Load curated track data */
  useEffect(() => {
    Papa.parse('/dropkit-tracks.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data
          .filter((r) => r.subgenre && r.artist && r.title)
          .map((r) => ({
            id: `${r.subgenre}|${r.artist}|${r.title}`,
            subgenre: r.subgenre.trim(),
            artist: r.artist.trim(),
            title: r.title.trim(),
            camelot: r.camelot.trim(),
            key: r.key.trim(),
            bpm: Number(r.bpm),
            tier: r.tier.trim(),
            vibe: r.vibe.trim(),
            soundcloudUrl: (r.soundcloudUrl || '').trim(),
          }));
        setTracks(rows);
        setLoading(false);
      },
      error: () => setLoading(false),
    });
  }, []);

  /* Persist settings */
  useEffect(() => localStorage.setItem(STORAGE.subgenre, JSON.stringify(subgenre)), [subgenre]);
  useEffect(() => localStorage.setItem(STORAGE.targetKey, JSON.stringify(targetKey)), [targetKey]);
  useEffect(() => localStorage.setItem(STORAGE.targetBpm, JSON.stringify(targetBpm)), [targetBpm]);
  useEffect(() => localStorage.setItem(STORAGE.tolerance, JSON.stringify(tolerance)), [tolerance]);
  useEffect(() => localStorage.setItem(STORAGE.halfDouble, JSON.stringify(allowHalfDouble)), [allowHalfDouble]);
  useEffect(() => localStorage.setItem(STORAGE.neighbors, JSON.stringify(includeNeighbors)), [includeNeighbors]);
  useEffect(() => localStorage.setItem(STORAGE.tier, JSON.stringify(tierPref)), [tierPref]);
  useEffect(() => localStorage.setItem(STORAGE.playlist, JSON.stringify(playlistName)), [playlistName]);

  function chooseSubgenre(name) {
    const preset = SUBGENRES[name];
    setSubgenre(name);
    setTargetKey(preset.key);
    setTargetBpm(preset.bpm);
    setPlayingId(null);
  }

  function resetState() {
    if (!window.confirm('Reset DropKit? This clears your subgenre, tuning and playlist name.')) return;
    ALL_KEYS.forEach((k) => localStorage.removeItem(k));
    setSubgenre(null);
    setTargetKey('6A');
    setTargetBpm(174);
    setTolerance(3);
    setAllowHalfDouble(true);
    setIncludeNeighbors(true);
    setTierPref('all');
    setPlaylistName('');
    setPlayingId(null);
  }

  /* Rank the subgenre pool and take 20 floor-fillers */
  const recommendations = useMemo(() => {
    if (!subgenre) return [];
    const target = { key: targetKey, bpm: Number(targetBpm) };
    let pool = tracks.filter((t) => t.subgenre === subgenre);
    if (tierPref === 'mainstream') pool = pool.filter((t) => t.tier === 'mainstream');
    else if (tierPref === 'underground') pool = pool.filter((t) => t.tier === 'underground');

    return pool
      .map((t) => {
        const ks = keyScore(t.camelot, target.key);
        const { dist } = bpmMatch(t.bpm, target.bpm, allowHalfDouble);
        let score = ks * 12 + dist;
        if (!includeNeighbors && ks > 0) score += 30; // keep strictly in-key on top
        return { ...t, score };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 20);
  }, [tracks, subgenre, targetKey, targetBpm, allowHalfDouble, includeNeighbors, tierPref]);

  const mainstreamCount = recommendations.filter((t) => t.tier === 'mainstream').length;
  const undergroundCount = recommendations.length - mainstreamCount;

  function copyTracklist() {
    const name = playlistName.trim() || `My ${subgenre} Set`;
    const header = `🎧 ${name}  (${subgenre} · key ${CAMELOT_NAMES[targetKey]} / ${targetKey} · ~${targetBpm} BPM)\n`;
    const body = recommendations
      .map((t, i) => `${String(i + 1).padStart(2, '0')}. ${t.artist} - ${t.title}  →  ${trackLink(t)}`)
      .join('\n');
    const text = `${header}\n${body}\n`;
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
      done();
    }
  }

  function openAll() {
    if (
      !window.confirm(
        `Open all ${recommendations.length} tracks in new SoundCloud tabs? Your browser may ask permission to allow pop-ups.`
      )
    )
      return;
    recommendations.forEach((t, i) => {
      setTimeout(() => window.open(trackLink(t), '_blank', 'noopener'), i * 120);
    });
  }

  const accent = subgenre ? SUBGENRES[subgenre].accent : '#a64bff';

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="dk" style={{ '--accent': accent }}>
      <header className="dk-top">
        <Link to="/" className="dk-home-link">← Home</Link>
        <div className="dk-brand">
          <span className="dk-logo">DropKit</span>
        </div>
        <button className="dk-reset" onClick={resetState}>Reset</button>
      </header>

      {loading && <p className="dk-loading">Loading the crate…</p>}

      {!loading && !subgenre && (
        <section className="dk-pick">
          <h1 className="dk-h1">Pick your subgenre</h1>
          <p className="dk-sub">
            Learn harmonic mixing hands-on. Pick a subgenre, then dial in the key, BPM, and artist
            mix — DropKit pulls real SoundCloud tracks that all sit in the same key and tempo, so you
            can preview each one and save the set as a playlist.
          </p>
          <div className="dk-genre-grid">
            {SUBGENRE_LIST.map((name) => {
              const g = SUBGENRES[name];
              return (
                <button
                  key={name}
                  className="dk-genre-card"
                  style={{ '--accent': g.accent }}
                  onClick={() => chooseSubgenre(name)}
                >
                  <span className="dk-genre-emoji">{g.emoji}</span>
                  <span className="dk-genre-name">{name}</span>
                  <span className="dk-genre-meta">{g.bpm} BPM</span>
                  <span className="dk-genre-blurb">{g.blurb}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!loading && subgenre && (
        <section className="dk-build">
          <div className="dk-build-head">
            <div>
              <h1 className="dk-h1">
                {SUBGENRES[subgenre].emoji} {subgenre}
              </h1>
              <p className="dk-sub">{SUBGENRES[subgenre].blurb}</p>
            </div>
            <button className="dk-change" onClick={() => { setSubgenre(null); setPlayingId(null); }}>← Change subgenre</button>
          </div>

          {/* Tuning controls */}
          <div className="dk-controls">
            <div className="dk-control">
              <label>Key (Camelot)</label>
              <select value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
                {KEY_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {k} · {CAMELOT_NAMES[k]}
                  </option>
                ))}
              </select>
            </div>

            <div className="dk-control">
              <label>Target BPM</label>
              <div className="dk-stepper">
                <button onClick={() => setTargetBpm((b) => Math.max(60, Number(b) - 1))}>−</button>
                <input
                  type="number"
                  value={targetBpm}
                  onChange={(e) => setTargetBpm(Number(e.target.value) || 0)}
                />
                <button onClick={() => setTargetBpm((b) => Math.min(220, Number(b) + 1))}>+</button>
              </div>
            </div>

            <div className="dk-control">
              <label>BPM tolerance ±{tolerance}</label>
              <input
                type="range"
                min="0"
                max="8"
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
              />
            </div>

            <div className="dk-control dk-toggles">
              <label className="dk-check">
                <input
                  type="checkbox"
                  checked={includeNeighbors}
                  onChange={(e) => setIncludeNeighbors(e.target.checked)}
                />
                Harmonic neighbors
              </label>
              <label className="dk-check">
                <input
                  type="checkbox"
                  checked={allowHalfDouble}
                  onChange={(e) => setAllowHalfDouble(e.target.checked)}
                />
                Allow ½× / 2× BPM
              </label>
            </div>

            <div className="dk-control dk-control-wide">
              <label>Artist mix</label>
              <div className="dk-seg">
                {[
                  ['all', 'All'],
                  ['mainstream', 'Mainstream'],
                  ['underground', 'Underground'],
                ].map(([val, lbl]) => (
                  <button
                    key={val}
                    className={tierPref === val ? 'active' : ''}
                    onClick={() => setTierPref(val)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button className="dk-help-toggle" onClick={() => setShowHelp((s) => !s)}>
            {showHelp ? '▾' : '▸'} How does harmonic mixing work?
          </button>
          {showHelp && (
            <div className="dk-help">
              <p>
                Two tracks blend cleanly when they share a tempo and a compatible musical key. DJs use
                the <strong>Camelot wheel</strong>: a track in <strong>{targetKey}</strong> mixes
                smoothly with the same number/other letter (relative major/minor) and the numbers
                either side (e.g. {targetKey} pairs with its neighbours). Match the BPM and you can ride
                the energy without a key clash. Turn on <em>½× / 2× BPM</em> to mix half-time and
                full-tempo tracks — a classic trick in bass music.
              </p>
              <p className="dk-disclaimer">
                Key &amp; BPM values here are curated reference estimates for learning — always trust
                your ears and your DJ software&apos;s analysis on the night.
              </p>
            </div>
          )}

          {/* Results summary */}
          <div className="dk-summary">
            <span className="dk-pill">{recommendations.length} tracks</span>
            <span className="dk-pill">{mainstreamCount} mainstream · {undergroundCount} underground</span>
            <span className="dk-pill">Key {CAMELOT_NAMES[targetKey]} / {targetKey}</span>
            <span className="dk-pill">~{targetBpm} BPM</span>
          </div>

          {/* Track list */}
          <ol className="dk-list">
            {recommendations.map((t, i) => {
              const badge = matchBadge(t, { key: targetKey, bpm: Number(targetBpm) }, allowHalfDouble, tolerance);
              const canPlay = Boolean(t.soundcloudUrl);
              const isPlaying = playingId === t.id;
              return (
                <li key={t.id} className={`dk-track ${isPlaying ? 'playing' : ''}`}>
                  <div className="dk-track-row">
                    <span className="dk-num">{String(i + 1).padStart(2, '0')}</span>
                    {canPlay ? (
                      <button
                        className={`dk-play ${isPlaying ? 'on' : ''}`}
                        onClick={() => setPlayingId(isPlaying ? null : t.id)}
                        title={isPlaying ? 'Hide player' : 'Preview on SoundCloud'}
                        aria-label={isPlaying ? 'Hide player' : 'Preview track'}
                      >
                        {isPlaying ? '✕' : '▶'}
                      </button>
                    ) : (
                      <span className="dk-play disabled" title="No verified SoundCloud match — use the search link">🔍</span>
                    )}
                    <div className="dk-track-main">
                      <div className="dk-track-title">
                        <a href={trackLink(t)} target="_blank" rel="noopener noreferrer">
                          {t.artist} — {t.title}
                        </a>
                        {!canPlay && <span className="dk-search-note">search</span>}
                      </div>
                      <div className="dk-track-meta">
                        <span className={`dk-badge ${badge.cls}`}>{badge.label}</span>
                        <span className="dk-meta-chip">{t.camelot} · {t.key}</span>
                        <span className="dk-meta-chip">{t.bpm} BPM</span>
                        <span className={`dk-meta-chip tier-${t.tier}`}>{t.tier}</span>
                        <span className="dk-vibe">{t.vibe}</span>
                      </div>
                    </div>
                  </div>
                  {isPlaying && (
                    <div className="dk-player">
                      <iframe
                        title={`${t.artist} - ${t.title}`}
                        width="100%"
                        height="120"
                        scrolling="no"
                        frameBorder="no"
                        allow="autoplay"
                        src={embedUrl(t.soundcloudUrl)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Save to SoundCloud */}
          <div className="dk-save">
            <h2>Save this set to SoundCloud</h2>
            <div className="dk-save-row">
              <input
                className="dk-playlist-input"
                type="text"
                placeholder="Name your playlist…"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
              />
              <button className="dk-btn primary" onClick={copyTracklist}>
                {copied ? 'Copied! ✓' : 'Copy tracklist'}
              </button>
              <a
                className="dk-btn"
                href="https://soundcloud.com/you/sets"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open my SoundCloud playlists ↗
              </a>
              <button className="dk-btn" onClick={openAll}>Open all {recommendations.length} tracks ↗</button>
            </div>

            <p className="dk-disclaimer">
              Inline previews stream from SoundCloud&apos;s public player. SoundCloud doesn&apos;t let
              third-party sites create playlists for you, so DropKit preps everything — name your
              playlist, copy the tracklist, then add the tracks to a new playlist on SoundCloud.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

export default Dropkit;
