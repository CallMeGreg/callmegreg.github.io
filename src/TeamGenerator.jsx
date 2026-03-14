import React, { useState, useEffect } from 'react';
import './TeamGenerator.css';

function TeamGenerator() {
  const [players, setPlayers] = useState(() => {
    const saved = localStorage.getItem('teamGenerator.players');
    return saved ? JSON.parse(saved) : [];
  });
  const [teams, setTeams] = useState(() => {
    const saved = localStorage.getItem('teamGenerator.teams');
    return saved ? JSON.parse(saved) : 2;
  });
  const [teamPlayers, setTeamPlayers] = useState(() => {
    const saved = localStorage.getItem('teamGenerator.teamPlayers');
    return saved ? JSON.parse(saved) : [];
  });
  const [showTeams, setShowTeams] = useState(() => {
    const saved = localStorage.getItem('teamGenerator.showTeams');
    return saved ? JSON.parse(saved) : false;
  });
  const [usePlaceholders, setUsePlaceholders] = useState(false);
  const [useGeckoNames, setUseGeckoNames] = useState(false);
  const [pasteText, setPasteText] = useState('');

  useEffect(() => {
    localStorage.setItem('teamGenerator.players', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem('teamGenerator.teams', JSON.stringify(teams));
  }, [teams]);

  useEffect(() => {
    localStorage.setItem('teamGenerator.teamPlayers', JSON.stringify(teamPlayers));
  }, [teamPlayers]);

  useEffect(() => {
    localStorage.setItem('teamGenerator.showTeams', JSON.stringify(showTeams));
  }, [showTeams]);

  const leopardGeckoNames = ['Leo', 'Luna', 'Ziggy', 'Gizmo', 'Spike', 'Rex', 'Milo', 'Cleo', 'Jax', 'Nova', 'Echo', 'Onyx', 'Jade', 'Ruby', 'Sapphire', 'Topaz', 'Opal', 'Amber', 'Jasper', 'Emerald', 'Buddy', 'Cinnamon', 'Dexter', 'Finn', 'Gatsby', 'Hazel', 'Ivy', 'Jasmine', 'Koda', 'Loki', 'Mango', 'Nala', 'Oscar', 'Penny', 'Quincy', 'Riley', 'Sage', 'Toby', 'Ursula', 'Violet', 'Willow', 'Xander', 'Yara', 'Zara', 'Charmello'];

  const handleAddPlayer = () => {
    let newPlayerName;
    if (useGeckoNames) {
      const availableNames = leopardGeckoNames.filter(name => !players.includes(name));
      if (availableNames.length === 0) {
        newPlayerName = leopardGeckoNames[Math.floor(Math.random() * leopardGeckoNames.length)];
      } else {
        newPlayerName = availableNames[Math.floor(Math.random() * availableNames.length)];
      }
    } else if (usePlaceholders) {
      newPlayerName = `Player ${players.length + 1}`;
    } else {
      newPlayerName = '';
    }
    setPlayers([...players, newPlayerName]);
  };

  const handleDeletePlayer = (index) => {
    const newPlayers = [...players];
    newPlayers.splice(index, 1);
    setPlayers(newPlayers);
  };

  const handlePlayerChange = (index, value) => {
    const newPlayers = [...players];
    newPlayers[index] = value;
    setPlayers(newPlayers);
  };

  const handleTeamChange = (event) => {
    setTeams(parseInt(event.target.value));
  };

  const handleGenerateTeams = () => {
    const shuffledPlayers = players.sort(() => 0.5 - Math.random());
    const teamSize = Math.floor(shuffledPlayers.length / teams);
    const remainingPlayers = shuffledPlayers.slice(teams * teamSize);
    const newTeamPlayers = Array.from({ length: teams }, (_, i) =>
      shuffledPlayers.slice(i * teamSize, (i + 1) * teamSize)
    );
    let i = 0;
    while (remainingPlayers.length > 0) {
      newTeamPlayers[i].push(remainingPlayers.shift());
      i = (i + 1) % teams;
    }
    setTeamPlayers(newTeamPlayers);
    setShowTeams(true);
  };

  const handleUsePlaceholdersChange = (event) => {
    setUsePlaceholders(event.target.checked);
  };

  const handleUseGeckoNamesChange = (event) => { // new function to handle checkbox change
    setUseGeckoNames(event.target.checked);
  };

  const handleImportPlayers = () => {
    const names = pasteText
      .split(/[\n,]+/)
      .map(name => name.trim())
      .filter(name => name.length > 0);
    if (names.length > 0) {
      setPlayers([...players, ...names]);
      setPasteText('');
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset? This will clear all players and teams.')) {
      localStorage.removeItem('teamGenerator.players');
      localStorage.removeItem('teamGenerator.teams');
      localStorage.removeItem('teamGenerator.teamPlayers');
      localStorage.removeItem('teamGenerator.showTeams');
      setPlayers([]);
      setTeams(2);
      setTeamPlayers([]);
      setShowTeams(false);
      setUsePlaceholders(false);
      setUseGeckoNames(false);
      setPasteText('');
    }
  };

  return (
    <div className="team-generator">
      <div className="tg-header">
        <h1>Random Team Generator</h1>
        <button className="tg-reset-btn" onClick={handleReset}>Reset</button>
      </div>
      <div className="tg-main">
        <div className="tg-panel tg-left">
          <h2>Players ({players.length})</h2>
          <div className="tg-controls">
            <div className="tg-team-count">
              <label htmlFor="teams">Number of Teams:</label>
              <input
                type="number"
                id="teams"
                name="teams"
                min="2"
                value={teams}
                onChange={handleTeamChange}
              />
            </div>
            <div className="tg-checkboxes">
              <div className="checkbox-container">
                <input
                  type="checkbox"
                  id="usePlaceholders"
                  name="usePlaceholders"
                  checked={usePlaceholders}
                  onChange={handleUsePlaceholdersChange}
                />
                <label htmlFor="usePlaceholders">Autofill player names</label>
              </div>
              <div className="checkbox-container">
                <input
                  type="checkbox"
                  id="useGeckoNames"
                  name="useGeckoNames"
                  checked={useGeckoNames}
                  onChange={handleUseGeckoNamesChange}
                />
                <label htmlFor="useGeckoNames">Leopard gecko names</label>
              </div>
            </div>
          </div>
          <div className="paste-container">
            <textarea
              className="paste-textarea"
              placeholder="Paste names (one per line or comma-separated)"
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              rows={3}
            />
            <button onClick={handleImportPlayers}>Import</button>
          </div>
          <div className="tg-player-list">
            {players.map((player, index) => (
              <div className="tg-player-row" key={index}>
                <input
                  type="text"
                  value={player}
                  onChange={(event) => handlePlayerChange(index, event.target.value)}
                  placeholder={`Player ${index + 1}`}
                />
                <button className="tg-delete-btn" onClick={() => handleDeletePlayer(index)}>✕</button>
              </div>
            ))}
          </div>
          <div className="tg-actions">
            <button onClick={handleAddPlayer}>+ Add Player</button>
            <button className="tg-generate-btn" onClick={handleGenerateTeams}>Generate Teams</button>
          </div>
        </div>
        <div className="tg-panel tg-right">
          <h2>Teams</h2>
          {showTeams ? (
            <div className="tg-teams-grid">
              {teamPlayers.map((team, i) => (
                <div className="tg-team-card" key={i}>
                  <h3>Team {i + 1}</h3>
                  <ul>
                    {team.map((player, j) => (
                      <li key={j}>{player}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="tg-placeholder-text">Add players and click "Generate Teams" to see results here.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeamGenerator;