import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import confetti from 'canvas-confetti';
import './EdmWordle.css';

const STORAGE = {
  seed: 'edmWordle.seed',
  guesses: 'edmWordle.guesses',
  won: 'edmWordle.won',
  gaveUp: 'edmWordle.gaveUp',
  typeAssist: 'edmWordle.typeAssist',
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
    return { seed: upper, fresh: upper !== (saved || '') };
  }
  if (saved) return { seed: saved, fresh: false };
  return { seed: makeSeed(), fresh: true };
}

function EdmWordle() {
  const [artists, setArtists] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const initialSeed = useRef(getInitialSeed());

  const [seed, setSeed] = useState(initialSeed.current.seed);

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
    document.body.classList.add('edm-wordle-page');
    return () => document.body.classList.remove('edm-wordle-page');
  }, []);

  /* Load dataset */
  useEffect(() => {
    Papa.parse('/edm-artists.csv', {
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

  function doNewGame(customSeed) {
    const next = (customSeed || makeSeed()).toUpperCase();
    setSeed(next);
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
    const text = `EDM Wordle — I got it in ${guesses.length} guesses! Seed: ${seed}\n${url.toString()}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => setMessage('Result copied to clipboard!'),
        () => setMessage(`Seed: ${seed}`)
      );
    } else {
      setMessage(`Seed: ${seed}`);
    }
  }

  return (
    <div className="edm-wordle">
      <Link to="/" className="edm-home-link">← Home</Link>

      <header className="edm-header">
        <div className="edm-waves" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 14) * 0.07}s` }} />
          ))}
        </div>
        <h1 className="edm-title">EDM<span>WORDLE</span></h1>
        <p className="edm-tagline">Match the clues. Guess the EDM artist.</p>
      </header>

      {!loaded && <p className="edm-loading">Loading artists…</p>}

      {loaded && (
        <main className="edm-main">
          <div className="edm-controls">
            <div className="edm-seed-row">
              <span className="edm-seed-label">Seed</span>
              <code className="edm-seed-value">{seed}</code>
              <button className="edm-btn ghost" onClick={() => newGame()}>New Game</button>
            </div>

            <form
              className="edm-seed-play"
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
              <button className="edm-btn" type="submit">Go</button>
            </form>

            <label className="edm-toggle">
              <input
                type="checkbox"
                checked={typeAssist}
                onChange={(e) => setTypeAssist(e.target.checked)}
              />
              <span className="edm-toggle-track"><span className="edm-toggle-thumb" /></span>
              Type assist
            </label>
          </div>

          {won && answer && (
            <div className="edm-win">
              <h2>🎆 You got it!</h2>
              <p>
                The artist was <strong>{answer.name}</strong>. You nailed it in{' '}
                <strong>{guesses.length}</strong> {guesses.length === 1 ? 'guess' : 'guesses'}.
              </p>
              <p className="edm-win-seed">
                Challenge a friend with seed <code>{seed}</code>
              </p>
              <div className="edm-win-actions">
                <button className="edm-btn" onClick={shareSeed}>Share result</button>
                <button className="edm-btn ghost" onClick={() => newGame()}>Play again</button>
              </div>
            </div>
          )}

          {gaveUp && answer && (
            <div className="edm-giveup">
              <h2>🏳️ You gave up</h2>
              <p>
                The answer was <strong>{answer.name}</strong> — you made{' '}
                <strong>{guesses.length}</strong> {guesses.length === 1 ? 'guess' : 'guesses'} before
                giving up.
              </p>
              <p className="edm-win-seed">
                Want a rematch? Seed <code>{seed}</code>
              </p>
              <div className="edm-win-actions">
                <button className="edm-btn" onClick={() => newGame()}>New Game</button>
              </div>
            </div>
          )}

          {!won && !gaveUp && (
            <form className="edm-guess-form" onSubmit={handleSubmit} autoComplete="off">
              <div className="edm-input-wrap">
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
                <button className="edm-btn" type="submit">Guess</button>
                <button type="button" className="edm-btn giveup" onClick={giveUp}>
                  Give up
                </button>
                {suggestions.length > 0 && (
                  <ul className="edm-suggestions">
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

          {message && <p className="edm-message">{message}</p>}

          {(guessedArtists.length > 0 || (gaveUp && answer)) && (
            <div className="edm-board">
              <div className="edm-row edm-row-head">
                <div className="edm-cell edm-name-cell">Artist</div>
                {ATTRIBUTES.map((attr) => (
                  <div key={attr.key} className="edm-cell">{attr.label}</div>
                ))}
              </div>
              {gaveUp && answer && (
                <div className="edm-row edm-answer-row">
                  <div className="edm-cell edm-name-cell">{answer.name}</div>
                  {ATTRIBUTES.map((attr) => (
                    <div key={attr.key} className="edm-cell edm-attr answer">
                      <span className="edm-attr-val">{answer[attr.key] || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
              {guessedArtists
                .slice()
                .reverse()
                .map((g) => (
                  <div className="edm-row" key={g.name}>
                    <div className="edm-cell edm-name-cell">{g.name}</div>
                    {ATTRIBUTES.map((attr) => {
                      const { match, hint } = cellState(attr.key, g[attr.key]);
                      return (
                        <div
                          key={attr.key}
                          className={`edm-cell edm-attr ${match ? 'match' : 'miss'}`}
                        >
                          <span className="edm-attr-val">{g[attr.key] || '—'}</span>
                          {hint && <span className="edm-hint">{hint}</span>}
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
        <div className="edm-modal-overlay" onClick={() => setConfirmState(null)}>
          <div
            className="edm-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="edm-modal-message">{confirmState.message}</p>
            <div className="edm-modal-actions">
              <button className="edm-btn ghost" onClick={() => setConfirmState(null)}>
                {confirmState.cancelLabel || 'Cancel'}
              </button>
              <button
                className="edm-btn"
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

export default EdmWordle;
