import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import confetti from 'canvas-confetti';
import { Link } from 'react-router-dom';
import './Jeopardy.css';

const ROUND_1_VALUES = [200, 400, 600, 800, 1000];
const ROUND_2_VALUES = [400, 800, 1200, 1600, 2000];

function getStorageItem(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function setStorageItem(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const ALL_KEYS = [
  'jeopardy.gamePhase',
  'jeopardy.numRounds',
  'jeopardy.hasFinalJeopardy',
  'jeopardy.teams',
  'jeopardy.scores',
  'jeopardy.round1Data',
  'jeopardy.round2Data',
  'jeopardy.finalData',
  'jeopardy.currentRound',
  'jeopardy.visitedQuestions',
  'jeopardy.currentQuestion',
];

function parseRoundCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data;
        if (rows.length !== 6) {
          reject(new Error(`Expected 6 categories (rows), but found ${rows.length}. Each row should be a category with columns: Category, Q1, Q2, Q3, Q4, Q5.`));
          return;
        }
        const categories = [];
        for (const row of rows) {
          const category = row['Category'];
          const questions = [row['Q1'], row['Q2'], row['Q3'], row['Q4'], row['Q5']];
          if (!category || questions.some(q => !q)) {
            reject(new Error('Each row must have a Category and 5 questions (Q1-Q5). Check your CSV format.'));
            return;
          }
          categories.push({ category, questions });
        }
        resolve(categories);
      },
      error: (err) => reject(err),
    });
  });
}

function parseFinalCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data;
        if (rows.length < 1) {
          reject(new Error('Final Jeopardy CSV must have at least one row with Category and Question columns.'));
          return;
        }
        const row = rows[0];
        if (!row['Category'] || !row['Question']) {
          reject(new Error('Final Jeopardy CSV must have Category and Question columns.'));
          return;
        }
        resolve({ category: row['Category'], question: row['Question'] });
      },
      error: (err) => reject(err),
    });
  });
}

/* ─── Setup Screen ─── */
function SetupScreen({ onStartGame }) {
  const [numRounds, setNumRounds] = useState(1);
  const [hasFinalJeopardy, setHasFinalJeopardy] = useState(false);
  const [numTeams, setNumTeams] = useState(2);
  const [teamNames, setTeamNames] = useState(['Team 1', 'Team 2']);
  const [round1File, setRound1File] = useState(null);
  const [round2File, setRound2File] = useState(null);
  const [finalFile, setFinalFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleNumTeamsChange(n) {
    const clamped = Math.max(1, Math.min(10, n));
    setNumTeams(clamped);
    setTeamNames(prev => {
      const next = [];
      for (let i = 0; i < clamped; i++) {
        next.push(prev[i] || `Team ${i + 1}`);
      }
      return next;
    });
  }

  function handleTeamNameChange(index, name) {
    setTeamNames(prev => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  }

  async function handleStart() {
    setError('');
    setLoading(true);
    try {
      if (!round1File) throw new Error('Please upload a CSV for Round 1.');
      if (numRounds === 2 && !round2File) throw new Error('Please upload a CSV for Round 2.');
      if (hasFinalJeopardy && !finalFile) throw new Error('Please upload a CSV for Final Jeopardy.');

      const round1Data = await parseRoundCSV(round1File);
      let round2Data = null;
      let finalData = null;
      if (numRounds === 2) round2Data = await parseRoundCSV(round2File);
      if (hasFinalJeopardy) finalData = await parseFinalCSV(finalFile);

      const teams = teamNames.map(name => name.trim() || 'Unnamed');
      const scores = {};
      teams.forEach(t => { scores[t] = 0; });

      onStartGame({ numRounds, hasFinalJeopardy, teams, scores, round1Data, round2Data, finalData });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="jeopardy-setup">
      <Link to="/" className="jeopardy-home-link">← Home</Link>
      <h1>Jeopardy! Setup</h1>

      <section className="setup-section">
        <h2>Rounds</h2>
        <div className="radio-group">
          <label><input type="radio" name="rounds" checked={numRounds === 1} onChange={() => setNumRounds(1)} /> 1 Round</label>
          <label><input type="radio" name="rounds" checked={numRounds === 2} onChange={() => setNumRounds(2)} /> 2 Rounds</label>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={hasFinalJeopardy} onChange={e => setHasFinalJeopardy(e.target.checked)} />
          Include Final Jeopardy
        </label>
      </section>

      <section className="setup-section">
        <h2>Upload Questions</h2>
        <div className="file-upload">
          <label>Round 1 CSV: <input type="file" accept=".csv" onChange={e => setRound1File(e.target.files[0])} /></label>
        </div>
        {numRounds === 2 && (
          <div className="file-upload">
            <label>Round 2 CSV: <input type="file" accept=".csv" onChange={e => setRound2File(e.target.files[0])} /></label>
          </div>
        )}
        {hasFinalJeopardy && (
          <div className="file-upload">
            <label>Final Jeopardy CSV: <input type="file" accept=".csv" onChange={e => setFinalFile(e.target.files[0])} /></label>
          </div>
        )}
        <p className="hint">
          Download example files: <a href="/jeopardy-round-example.csv" download>Round CSV</a> | <a href="/jeopardy-final-example.csv" download>Final Jeopardy CSV</a>
        </p>
      </section>

      <section className="setup-section">
        <h2>Teams</h2>
        <div className="teams-count">
          <label>Number of teams:
            <input type="number" min="1" max="10" value={numTeams} onChange={e => handleNumTeamsChange(parseInt(e.target.value, 10) || 1)} />
          </label>
        </div>
        <div className="team-names">
          {teamNames.map((name, i) => (
            <input key={i} type="text" value={name} placeholder={`Team ${i + 1}`} onChange={e => handleTeamNameChange(i, e.target.value)} />
          ))}
        </div>
      </section>

      {error && <p className="error-message">{error}</p>}

      <button className="start-button" onClick={handleStart} disabled={loading}>
        {loading ? 'Loading...' : 'Start Game'}
      </button>
    </div>
  );
}

/* ─── Board Screen ─── */
function BoardScreen({ roundData, values, currentRound, teams, scores, visitedQuestions, onSelectQuestion, onAdvanceRound, onFinalJeopardy, onReset, numRounds, hasFinalJeopardy }) {
  const isLastRound = currentRound === numRounds;

  return (
    <div className="jeopardy-board-screen">
      <div className="board-header">
        <h1>Round {currentRound}</h1>
        <div className="board-actions">
          {isLastRound && hasFinalJeopardy && (
            <button className="final-jeopardy-btn" onClick={() => onFinalJeopardy()}>Final Jeopardy!</button>
          )}
          {!isLastRound && (
            <button className="next-round-btn" onClick={onAdvanceRound}>Next Round →</button>
          )}
          {isLastRound && !hasFinalJeopardy && (
            <button className="finish-btn" onClick={() => onFinalJeopardy(true)}>Finish Game</button>
          )}
          <button className="reset-btn" onClick={onReset}>Reset</button>
        </div>
      </div>

      <div className="scoreboard">
        {teams.map(team => (
          <div key={team} className="score-card">
            <span className="team-name">{team}</span>
            <span className="team-score">${scores[team].toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="jeopardy-board">
        {/* Category headers */}
        {roundData.map((cat, colIdx) => (
          <div key={colIdx} className="board-category">{cat.category}</div>
        ))}
        {/* Question tiles — row by row */}
        {values.map((value, rowIdx) => (
          roundData.map((cat, colIdx) => {
            const qid = `r${currentRound}-c${colIdx}-q${rowIdx}`;
            const visited = visitedQuestions.includes(qid);
            return (
              <button
                key={qid}
                className={`board-tile ${visited ? 'visited' : ''}`}
                disabled={visited}
                onClick={() => onSelectQuestion(colIdx, rowIdx, qid)}
              >
                {visited ? '' : `$${value}`}
              </button>
            );
          })
        ))}
      </div>
    </div>
  );
}

/* ─── Question Screen ─── */
function QuestionScreen({ question, value, teams, scores, onAward, onDeduct, onBack }) {
  return (
    <div className="jeopardy-question-screen">
      <div className="question-card">
        <p className="question-value">${value.toLocaleString()}</p>
        <p className="question-text">{question}</p>
      </div>
      <div className="team-actions">
        {teams.map(team => (
          <div key={team} className="team-action-row">
            <span className="team-label">{team} (${scores[team].toLocaleString()})</span>
            <button className="award-btn" onClick={() => onAward(team)}>+${value.toLocaleString()}</button>
            <button className="deduct-btn" onClick={() => onDeduct(team)}>−${value.toLocaleString()}</button>
          </div>
        ))}
      </div>
      <button className="back-btn" onClick={onBack}>← Back to Board</button>
    </div>
  );
}

/* ─── Final Jeopardy Screen ─── */
function FinalJeopardyScreen({ finalData, teams, scores, onFinish }) {
  const [wagers, setWagers] = useState(() => {
    const w = {};
    teams.forEach(t => { w[t] = 0; });
    return w;
  });
  const [phase, setPhase] = useState('wager'); // wager | answer | done
  const [results, setResults] = useState({});

  function handleWagerChange(team, val) {
    const maxWager = Math.max(0, scores[team]);
    const wager = Math.max(0, Math.min(maxWager, parseInt(val, 10) || 0));
    setWagers(prev => ({ ...prev, [team]: wager }));
  }

  function handleReveal() {
    setPhase('answer');
  }

  function handleResult(team, correct) {
    setResults(prev => ({ ...prev, [team]: correct }));
  }

  function handleFinish() {
    const finalScores = { ...scores };
    teams.forEach(team => {
      if (results[team] === true) {
        finalScores[team] += wagers[team];
      } else if (results[team] === false) {
        finalScores[team] -= wagers[team];
      }
    });
    onFinish(finalScores);
  }

  const allAnswered = teams.every(t => results[t] === true || results[t] === false);

  return (
    <div className="jeopardy-final-screen">
      <h1>Final Jeopardy!</h1>
      <div className="final-category">Category: {finalData.category}</div>

      {phase === 'wager' && (
        <>
          <p className="final-instructions">Each team: enter your wager</p>
          <div className="wager-inputs">
            {teams.map(team => (
              <div key={team} className="wager-row">
                <span>{team} (${scores[team].toLocaleString()})</span>
                <input
                  type="number"
                  min="0"
                  max={Math.max(0, scores[team])}
                  value={wagers[team]}
                  onChange={e => handleWagerChange(team, e.target.value)}
                />
              </div>
            ))}
          </div>
          <button className="reveal-btn" onClick={handleReveal}>Reveal Question</button>
        </>
      )}

      {phase === 'answer' && (
        <>
          <div className="final-question-card">
            <p className="question-text">{finalData.question}</p>
          </div>
          <div className="final-results">
            {teams.map(team => (
              <div key={team} className="final-result-row">
                <span>{team} (wagered ${wagers[team].toLocaleString()})</span>
                <div className="result-buttons">
                  <button
                    className={`correct-btn ${results[team] === true ? 'selected' : ''}`}
                    onClick={() => handleResult(team, true)}
                  >Correct</button>
                  <button
                    className={`incorrect-btn ${results[team] === false ? 'selected' : ''}`}
                    onClick={() => handleResult(team, false)}
                  >Incorrect</button>
                </div>
              </div>
            ))}
          </div>
          <button className="finish-btn" onClick={handleFinish} disabled={!allAnswered}>
            Show Final Scores
          </button>
        </>
      )}
    </div>
  );
}

/* ─── Results Screen ─── */
function ResultsScreen({ teams, scores, onReset }) {
  useEffect(() => {
    const duration = 4000;
    const end = Date.now() + duration;
    const colors = ['#FFD700', '#1a5fb4', '#e01b24'];

    function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    }
    frame();
  }, []);

  const sorted = [...teams].sort((a, b) => scores[b] - scores[a]);
  const topScore = scores[sorted[0]];
  const winners = sorted.filter(t => scores[t] === topScore);

  return (
    <div className="jeopardy-results-screen">
      <h1>🏆 Game Over! 🏆</h1>
      <h2 className="winner-name">
        {winners.length > 1 ? `It's a tie! ${winners.join(' & ')}` : `${winners[0]} wins!`}
      </h2>
      <div className="final-scores">
        {sorted.map((team, i) => (
          <div key={team} className={`final-score-row ${i === 0 ? 'winner' : ''}`}>
            <span className="rank">#{i + 1}</span>
            <span className="team-name">{team}</span>
            <span className="team-score">${scores[team].toLocaleString()}</span>
          </div>
        ))}
      </div>
      <button className="reset-btn" onClick={onReset}>New Game</button>
    </div>
  );
}

/* ─── Main Jeopardy Component ─── */
export default function Jeopardy() {
  const [gamePhase, setGamePhase] = useState(() => getStorageItem('jeopardy.gamePhase', 'setup'));
  const [numRounds, setNumRounds] = useState(() => getStorageItem('jeopardy.numRounds', 1));
  const [hasFinalJeopardy, setHasFinalJeopardy] = useState(() => getStorageItem('jeopardy.hasFinalJeopardy', false));
  const [teams, setTeams] = useState(() => getStorageItem('jeopardy.teams', []));
  const [scores, setScores] = useState(() => getStorageItem('jeopardy.scores', {}));
  const [round1Data, setRound1Data] = useState(() => getStorageItem('jeopardy.round1Data', null));
  const [round2Data, setRound2Data] = useState(() => getStorageItem('jeopardy.round2Data', null));
  const [finalData, setFinalData] = useState(() => getStorageItem('jeopardy.finalData', null));
  const [currentRound, setCurrentRound] = useState(() => getStorageItem('jeopardy.currentRound', 1));
  const [visitedQuestions, setVisitedQuestions] = useState(() => getStorageItem('jeopardy.visitedQuestions', []));
  const [currentQuestion, setCurrentQuestion] = useState(() => getStorageItem('jeopardy.currentQuestion', null));

  // Allow page-level scrolling by overriding body constraints from other applet CSS
  useEffect(() => {
    document.body.style.height = 'auto';
    document.body.style.minHeight = '100vh';
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.height = '';
      document.body.style.minHeight = '';
      document.body.style.overflow = '';
    };
  }, []);

  // Persist all state to localStorage
  useEffect(() => { setStorageItem('jeopardy.gamePhase', gamePhase); }, [gamePhase]);
  useEffect(() => { setStorageItem('jeopardy.numRounds', numRounds); }, [numRounds]);
  useEffect(() => { setStorageItem('jeopardy.hasFinalJeopardy', hasFinalJeopardy); }, [hasFinalJeopardy]);
  useEffect(() => { setStorageItem('jeopardy.teams', teams); }, [teams]);
  useEffect(() => { setStorageItem('jeopardy.scores', scores); }, [scores]);
  useEffect(() => { setStorageItem('jeopardy.round1Data', round1Data); }, [round1Data]);
  useEffect(() => { setStorageItem('jeopardy.round2Data', round2Data); }, [round2Data]);
  useEffect(() => { setStorageItem('jeopardy.finalData', finalData); }, [finalData]);
  useEffect(() => { setStorageItem('jeopardy.currentRound', currentRound); }, [currentRound]);
  useEffect(() => { setStorageItem('jeopardy.visitedQuestions', visitedQuestions); }, [visitedQuestions]);
  useEffect(() => { setStorageItem('jeopardy.currentQuestion', currentQuestion); }, [currentQuestion]);

  const resetState = useCallback(() => {
    if (!window.confirm('Are you sure you want to reset? All progress will be lost.')) return;
    ALL_KEYS.forEach(k => localStorage.removeItem(k));
    setGamePhase('setup');
    setNumRounds(1);
    setHasFinalJeopardy(false);
    setTeams([]);
    setScores({});
    setRound1Data(null);
    setRound2Data(null);
    setFinalData(null);
    setCurrentRound(1);
    setVisitedQuestions([]);
    setCurrentQuestion(null);
  }, []);

  function handleStartGame({ numRounds: nr, hasFinalJeopardy: hfj, teams: t, scores: s, round1Data: r1, round2Data: r2, finalData: fd }) {
    setNumRounds(nr);
    setHasFinalJeopardy(hfj);
    setTeams(t);
    setScores(s);
    setRound1Data(r1);
    setRound2Data(r2);
    setFinalData(fd);
    setCurrentRound(1);
    setVisitedQuestions([]);
    setCurrentQuestion(null);
    setGamePhase('board');
  }

  function handleSelectQuestion(colIdx, rowIdx, qid) {
    const roundData = currentRound === 1 ? round1Data : round2Data;
    const values = currentRound === 1 ? ROUND_1_VALUES : ROUND_2_VALUES;
    setCurrentQuestion({
      question: roundData[colIdx].questions[rowIdx],
      value: values[rowIdx],
      qid,
    });
    setGamePhase('question');
  }

  function handleAward(team) {
    setScores(prev => ({ ...prev, [team]: prev[team] + currentQuestion.value }));
  }

  function handleDeduct(team) {
    setScores(prev => ({ ...prev, [team]: prev[team] - currentQuestion.value }));
  }

  function handleBackToBoard() {
    setVisitedQuestions(prev => prev.includes(currentQuestion.qid) ? prev : [...prev, currentQuestion.qid]);
    setCurrentQuestion(null);
    setGamePhase('board');
  }

  function handleAdvanceRound() {
    setCurrentRound(2);
    setGamePhase('board');
  }

  function handleFinalJeopardy(skipToResults) {
    if (skipToResults) {
      setGamePhase('results');
    } else {
      setGamePhase('finalJeopardy');
    }
  }

  function handleFinalFinish(finalScores) {
    setScores(finalScores);
    setGamePhase('results');
  }

  if (gamePhase === 'setup') {
    return <SetupScreen onStartGame={handleStartGame} />;
  }

  if (gamePhase === 'board') {
    const roundData = currentRound === 1 ? round1Data : round2Data;
    const values = currentRound === 1 ? ROUND_1_VALUES : ROUND_2_VALUES;
    return (
      <BoardScreen
        roundData={roundData}
        values={values}
        currentRound={currentRound}
        teams={teams}
        scores={scores}
        visitedQuestions={visitedQuestions}
        onSelectQuestion={handleSelectQuestion}
        onAdvanceRound={handleAdvanceRound}
        onFinalJeopardy={handleFinalJeopardy}
        onReset={resetState}
        numRounds={numRounds}
        hasFinalJeopardy={hasFinalJeopardy}
      />
    );
  }

  if (gamePhase === 'question') {
    return (
      <QuestionScreen
        question={currentQuestion.question}
        value={currentQuestion.value}
        teams={teams}
        scores={scores}
        onAward={handleAward}
        onDeduct={handleDeduct}
        onBack={handleBackToBoard}
      />
    );
  }

  if (gamePhase === 'finalJeopardy') {
    return (
      <FinalJeopardyScreen
        finalData={finalData}
        teams={teams}
        scores={scores}
        onFinish={handleFinalFinish}
      />
    );
  }

  if (gamePhase === 'results') {
    return (
      <ResultsScreen
        teams={teams}
        scores={scores}
        onReset={resetState}
      />
    );
  }

  return null;
}
