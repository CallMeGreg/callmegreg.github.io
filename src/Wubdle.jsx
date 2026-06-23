import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import confetti from 'canvas-confetti';
import './Wubdle.css';

const STORAGE = {
  seed: 'wubdle.seed',
  guesses: 'wubdle.guesses',
  won: 'wubdle.won',
  gaveUp: 'wubdle.gaveUp',
  typeAssist: 'wubdle.typeAssist',
  seeded: 'wubdle.seeded',
  isDaily: 'wubdle.isDaily',
  dailyDone: 'wubdle.dailyDone',
};

const MEMBER_ORDER = ['Solo', 'Duo', 'Trio', 'Quartet', 'Quintet', 'Collective'];
const ALPHA_GROUPS = ['A-M', 'N-Z'];
const STREAM_ORDER = ['<1M', '1M-2.5M', '2.5M-5M', '5M-10M', '10M+'];

const ATTRIBUTES = [
  { key: 'alphabet', label: 'Alphabet', order: ALPHA_GROUPS, reverseHint: true },
  { key: 'members', label: 'Members', order: MEMBER_ORDER },
  { key: 'gender', label: 'Gender' },
  { key: 'location', label: 'Location' },
  { key: 'subgenre', label: 'Subgenre' },
  { key: 'debut', label: 'First Record', numeric: true },
  { key: 'streams', label: 'Monthly Spotify', order: STREAM_ORDER },
];

/* ─── Seeded RNG helpers ─── */
function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/* Today's date in US Eastern time, formatted as YYMMDD — the daily seed. */
function getEasternDateSeed() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}${get('month')}${get('day')}`;
}

/* Milliseconds until the next midnight in US Eastern time. */
function msUntilEasternMidnight() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parseInt(parts.find((p) => p.type === t).value, 10);
  let h = get('hour');
  if (h === 24) h = 0;
  const secsIntoDay = h * 3600 + get('minute') * 60 + get('second');
  return (24 * 3600 - secsIntoDay) * 1000;
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function normalize(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

function alphabetGroup(name) {
  const first = name.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase();
  if (!first) return ALPHA_GROUPS[0];
  return first.charCodeAt(0) <= 77 ? ALPHA_GROUPS[0] : ALPHA_GROUPS[1];
}

function getInitialSeed() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('seed');
  const saved = localStorage.getItem(STORAGE.seed);
  if (fromUrl) {
    const upper = fromUrl.toUpperCase();
    return { seed: upper, fresh: upper !== (saved || ''), seeded: true };
  }
  if (saved) {
    const savedSeeded = localStorage.getItem(STORAGE.seeded);
    return { seed: saved, fresh: false, seeded: savedSeeded ? JSON.parse(savedSeeded) : false };
  }
  return { seed: makeSeed(), fresh: true, seeded: false };
}

function Wubdle() {
  const [artists, setArtists] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const initialSeed = useRef(getInitialSeed());

  const [seed, setSeed] = useState(initialSeed.current.seed);
  const [seeded, setSeeded] = useState(initialSeed.current.seeded);

  const [guesses, setGuesses] = useState(() => {
    if (initialSeed.current.fresh) return [];
    const saved = localStorage.getItem(STORAGE.guesses);
    return saved ? JSON.parse(saved) : [];
  });

  const [won, setWon] = useState(() => {
    if (initialSeed.current.fresh) return false;
    const saved = localStorage.getItem(STORAGE.won);
    return saved ? JSON.parse(saved) : false;
  });

  const [gaveUp, setGaveUp] = useState(() => {
    if (initialSeed.current.fresh) return false;
    const saved = localStorage.getItem(STORAGE.gaveUp);
    return saved ? JSON.parse(saved) : false;
  });

  const [typeAssist, setTypeAssist] = useState(() => {
    const saved = localStorage.getItem(STORAGE.typeAssist);
    return saved ? JSON.parse(saved) : false;
  });

  const [isDaily, setIsDaily] = useState(() => {
    if (initialSeed.current.fresh) return false;
    const saved = localStorage.getItem(STORAGE.isDaily);
    return saved ? JSON.parse(saved) : false;
  });

  const [dailyDone, setDailyDone] = useState(() => {
    const saved = localStorage.getItem(STORAGE.dailyDone);
    return saved ? JSON.parse(saved) : null;
  });

  /* Ticks every second so the daily reset countdown stays live. */
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [seedInput, setSeedInput] = useState('');
  const [confirmState, setConfirmState] = useState(null);
  const inputRef = useRef(null);

  function requestConfirm(message, confirmLabel, onConfirm, cancelLabel) {
    setConfirmState({ message, confirmLabel, onConfirm, cancelLabel });
  }

  /* Scope page-level body background to this route only */
  useEffect(() => {
    document.body.classList.add('wubdle-page');
    return () => document.body.classList.remove('wubdle-page');
  }, []);

  /* Load dataset */
  useEffect(() => {
    Papa.parse('/wubdle-artists.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data
          .filter((r) => r.Name && r.Name.trim())
          .map((r) => ({
            name: r.Name.trim(),
            alphabet: alphabetGroup(r.Name.trim()),
            members: (r.Members || '').trim(),
            gender: (r.Gender || '').trim(),
            location: (r.Location || '').trim(),
            subgenre: (r.Subgenre || '').trim(),
            debut: (r.Debut || '').trim(),
            streams: (r.Streams || '').trim(),
          }));
        setArtists(rows);
        setLoaded(true);
      },
    });
  }, []);

  /* Persist */
  useEffect(() => {
    localStorage.setItem(STORAGE.seed, seed);
  }, [seed]);
  useEffect(() => {
    localStorage.setItem(STORAGE.seeded, JSON.stringify(seeded));
  }, [seeded]);
  useEffect(() => {
    localStorage.setItem(STORAGE.guesses, JSON.stringify(guesses));
  }, [guesses]);
  useEffect(() => {
    localStorage.setItem(STORAGE.won, JSON.stringify(won));
  }, [won]);
  useEffect(() => {
    localStorage.setItem(STORAGE.gaveUp, JSON.stringify(gaveUp));
  }, [gaveUp]);
  useEffect(() => {
    localStorage.setItem(STORAGE.typeAssist, JSON.stringify(typeAssist));
  }, [typeAssist]);
  useEffect(() => {
    localStorage.setItem(STORAGE.isDaily, JSON.stringify(isDaily));
  }, [isDaily]);
  useEffect(() => {
    localStorage.setItem(STORAGE.dailyDone, JSON.stringify(dailyDone));
  }, [dailyDone]);

  /* Record the daily challenge as completed once it's won or given up. */
  useEffect(() => {
    if (isDaily && (won || gaveUp)) {
      setDailyDone(seed);
    }
  }, [isDaily, won, gaveUp, seed]);

  /* The answer for the current seed */
  const answer = useMemo(() => {
    if (!artists.length) return null;
    const rng = mulberry32(hashString(seed));
    const index = Math.floor(rng() * artists.length);
    return artists[index];
  }, [artists, seed]);

  /* Fireworks on win */
  useEffect(() => {
    if (!won) return;
    const duration = 4000;
    const end = Date.now() + duration;
    const colors = ['#00e5ff', '#ff00e5', '#7c4dff', '#00ffa3'];
    function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    }
    frame();
  }, [won]);

  const guessedArtists = useMemo(
    () => guesses.map((g) => artists.find((a) => a.name === g)).filter(Boolean),
    [guesses, artists]
  );

  const suggestions = useMemo(() => {
    if (!typeAssist || !input.trim()) return [];
    const q = normalize(input);
    const guessedSet = new Set(guesses);
    return artists
      .filter((a) => normalize(a.name).startsWith(q) && !guessedSet.has(a.name))
      .slice(0, 8);
  }, [typeAssist, input, artists, guesses]);

  function submitGuess(rawName) {
    if (won || gaveUp) return;
    const value = (rawName ?? input).trim();
    if (!value) return;
    const match = artists.find((a) => normalize(a.name) === normalize(value));
    if (!match) {
      setMessage(`"${value}" isn't a valid artist in this game. Guess doesn't count.`);
      return;
    }
    if (guesses.includes(match.name)) {
      setMessage(`You already guessed ${match.name}.`);
      return;
    }
    setMessage('');
    setInput('');
    const newGuesses = [...guesses, match.name];
    setGuesses(newGuesses);
    if (answer && match.name === answer.name) {
      setWon(true);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    submitGuess();
  }

  function doNewGame(customSeed, daily = false) {
    const next = (customSeed || makeSeed()).toUpperCase();
    setSeed(next);
    setSeeded(!!customSeed);
    setIsDaily(daily);
    setGuesses([]);
    setWon(false);
    setGaveUp(false);
    setInput('');
    setSeedInput('');
    setMessage('');
    const url = new URL(window.location.href);
    url.searchParams.delete('seed');
    window.history.replaceState({}, '', url);
  }

  function newGame(customSeed) {
    if (!customSeed && guesses.length > 0 && !won && !gaveUp) {
      requestConfirm(
        'Start a new game? Your progress on the current puzzle will be lost.',
        'New game',
        () => doNewGame()
      );
      return;
    }
    doNewGame(customSeed);
  }

  function startDaily() {
    const dailySeed = getEasternDateSeed();
    if (dailyDone === dailySeed) return;
    if (guesses.length > 0 && !won && !gaveUp) {
      requestConfirm(
        "Start today's Daily Challenge? Your progress on the current puzzle will be lost.",
        'Daily Challenge',
        () => doNewGame(dailySeed, true)
      );
      return;
    }
    doNewGame(dailySeed, true);
  }

  function giveUp() {
    if (won || gaveUp) return;
    requestConfirm(
      'Are you a quitter?',
      'Yes',
      () => {
        setGaveUp(true);
        setInput('');
        setMessage('');
      },
      "Nah I've got this"
    );
  }
  function cellState(attrKey, guessVal) {
    if (!answer) return { match: false };
    const answerVal = answer[attrKey];
    const match = guessVal === answerVal;
    const attr = ATTRIBUTES.find((a) => a.key === attrKey);
    let hint = null;
    if (!match && attr && attr.numeric) {
      const gi = parseInt(guessVal, 10);
      const ai = parseInt(answerVal, 10);
      if (!isNaN(gi) && !isNaN(ai)) hint = ai > gi ? '▲' : '▼';
    } else if (!match && attr && attr.order) {
      const gi = attr.order.indexOf(guessVal);
      const ai = attr.order.indexOf(answerVal);
      if (gi !== -1 && ai !== -1) {
        const higher = ai > gi;
        hint = (attr.reverseHint ? !higher : higher) ? '▲' : '▼';
      }
    }
    return { match, hint };
  }

  function shareSeed() {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', seed);
    const text = `Wubdle — I got it in ${guesses.length} guesses! Seed: ${seed}\n${url.toString()}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => setMessage('Result copied to clipboard!'),
        () => setMessage(`Seed: ${seed}`)
      );
    } else {
      setMessage(`Seed: ${seed}`);
    }
  }

  const todaySeed = getEasternDateSeed();
  const dailyCompletedToday = dailyDone === todaySeed;

  return (
    <div className="wubdle">
      <Link to="/" className="wubdle-home-link">← Home</Link>

      <header className="wubdle-header">
        <div className="wubdle-waves" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 14) * 0.07}s` }} />
          ))}
        </div>
        <h1 className="wubdle-title">WUB<span>DLE</span></h1>
        <p className="wubdle-tagline">Guess an EDM artist. Follow the clues. Find the answer.</p>
      </header>

      {!loaded && <p className="wubdle-loading">Loading artists…</p>}

      {loaded && (
        <main className="wubdle-main">
          <div className="wubdle-controls">
            <div className="wubdle-seed-row">
              <button className="wubdle-btn ghost" onClick={() => newGame()}>New Game</button>
              <button
                className="wubdle-btn ghost wubdle-daily"
                onClick={startDaily}
                disabled={dailyCompletedToday}
                title={
                  dailyCompletedToday
                    ? "You've finished today's Daily Challenge"
                    : "Play today's Daily Challenge"
                }
              >
                Daily Challenge
              </button>
            </div>

            {dailyCompletedToday && (
              <p className="wubdle-daily-reset">
                ✓ Daily done · next puzzle in{' '}
                <code>{formatCountdown(msUntilEasternMidnight())}</code>
              </p>
            )}

            <div className="wubdle-seed-play-row">
              <span className="wubdle-seed-label">Seed</span>
              <code className="wubdle-seed-value">{seed}</code>
              <form
                className="wubdle-seed-play"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (seedInput.trim()) newGame(seedInput.trim());
                }}
              >
                <input
                  type="text"
                  placeholder="Play a specific seed…"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                />
                <button className="wubdle-btn" type="submit">Go</button>
              </form>
            </div>

            <label className="wubdle-toggle">
              <input
                type="checkbox"
                checked={typeAssist}
                onChange={(e) => setTypeAssist(e.target.checked)}
              />
              <span className="wubdle-toggle-track"><span className="wubdle-toggle-thumb" /></span>
              Type assist
            </label>
          </div>

          {won && answer && (
            <div className="wubdle-win">
              <h2>🎆 You got it!</h2>
              {seeded && (
                <p className="wubdle-win-badge">🌱 Seeded run · <code>{seed}</code></p>
              )}
              <p>
                The artist was <strong>{answer.name}</strong>. You nailed it in{' '}
                <strong>{guesses.length}</strong> {guesses.length === 1 ? 'guess' : 'guesses'}.
              </p>
              <p className="wubdle-win-seed">
                Challenge a friend with seed <code>{seed}</code>
              </p>
              <div className="wubdle-win-actions">
                <button className="wubdle-btn" onClick={shareSeed}>Share result</button>
                <button className="wubdle-btn ghost" onClick={() => newGame()}>Play again</button>
              </div>
            </div>
          )}

          {gaveUp && answer && (
            <div className="wubdle-giveup">
              <h2>🏳️ You gave up</h2>
              <p>
                The answer was <strong>{answer.name}</strong> — you made{' '}
                <strong>{guesses.length}</strong> {guesses.length === 1 ? 'guess' : 'guesses'} before
                giving up.
              </p>
              <p className="wubdle-win-seed">
                Want a rematch? Seed <code>{seed}</code>
              </p>
              <div className="wubdle-win-actions">
                <button className="wubdle-btn" onClick={() => newGame()}>New Game</button>
              </div>
            </div>
          )}

          {!won && !gaveUp && (
            <form className="wubdle-guess-form" onSubmit={handleSubmit} autoComplete="off">
              <div className="wubdle-input-wrap">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Guess an artist…"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (message) setMessage('');
                  }}
                />
                <button className="wubdle-btn" type="submit">Guess</button>
                <button type="button" className="wubdle-btn giveup" onClick={giveUp}>
                  Give up
                </button>
                {suggestions.length > 0 && (
                  <ul className="wubdle-suggestions">
                    {suggestions.map((a) => (
                      <li key={a.name}>
                        <button type="button" onClick={() => submitGuess(a.name)}>
                          {a.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>
          )}

          {message && <p className="wubdle-message">{message}</p>}

          {(guessedArtists.length > 0 || (gaveUp && answer)) && (
            <div className="wubdle-board">
              <div className="wubdle-row wubdle-row-head">
                <div className="wubdle-cell wubdle-name-cell">Artist</div>
                {ATTRIBUTES.map((attr) => (
                  <div key={attr.key} className="wubdle-cell">{attr.label}</div>
                ))}
              </div>
              {gaveUp && answer && (
                <div className="wubdle-row wubdle-answer-row">
                  <div className="wubdle-cell wubdle-name-cell">{answer.name}</div>
                  {ATTRIBUTES.map((attr) => (
                    <div key={attr.key} className="wubdle-cell wubdle-attr answer">
                      <span className="wubdle-attr-val">{answer[attr.key] || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
              {guessedArtists
                .slice()
                .reverse()
                .map((g) => (
                  <div className="wubdle-row" key={g.name}>
                    <div className="wubdle-cell wubdle-name-cell">{g.name}</div>
                    {ATTRIBUTES.map((attr) => {
                      const { match, hint } = cellState(attr.key, g[attr.key]);
                      return (
                        <div
                          key={attr.key}
                          className={`wubdle-cell wubdle-attr ${match ? 'match' : 'miss'}`}
                        >
                          <span className="wubdle-attr-val">{g[attr.key] || '—'}</span>
                          {hint && <span className="wubdle-hint">{hint}</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          )}
        </main>
      )}

      {confirmState && (
        <div className="wubdle-modal-overlay" onClick={() => setConfirmState(null)}>
          <div
            className="wubdle-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="wubdle-modal-message">{confirmState.message}</p>
            <div className="wubdle-modal-actions">
              <button className="wubdle-btn ghost" onClick={() => setConfirmState(null)}>
                {confirmState.cancelLabel || 'Cancel'}
              </button>
              <button
                className="wubdle-btn"
                onClick={() => {
                  const cb = confirmState.onConfirm;
                  setConfirmState(null);
                  if (cb) cb();
                }}
              >
                {confirmState.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Wubdle;
