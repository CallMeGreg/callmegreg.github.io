import React, { useState } from 'react';
import './TeamGenerator.css';

function TeamGenerator() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState(2);
  const [teamPlayers, setTeamPlayers] = useState([]);
  const [showTeams, setShowTeams] = useState(false);
  const [usePlaceholders, setUsePlaceholders] = useState(false);
  const [useGeckoNames, setUseGeckoNames] = useState(false); // new state for checkbox

  const leopardGeckoNames = ['Leo', 'Luna', 'Ziggy', 'Gizmo', 'Spike', 'Rex', 'Milo', 'Cleo', 'Jax', 'Nova', 'Echo', 'Onyx', 'Jade', 'Ruby', 'Sapphire', 'Topaz', 'Opal', 'Amber', 'Jasper', 'Emerald'];

  const handleAddPlayer = () => {
    if (useGeckoNames) {
      setPlayers([...players, leopardGeckoNames[Math.floor(Math.random() * leopardGeckoNames.length)]]);
    } else if (usePlaceholders) { // new condition to autofill with gecko names
      setPlayers([...players, `Player ${players.length + 1}`]);
    } else {
      setPlayers([...players, '']);
    }
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

  return (
    <div className="team-generator">
      <h1>Random Team Generator</h1>
      <label htmlFor="teams">Number of Teams:</label>
      <input
        type="number"
        id="teams"
        name="teams"
        min="2"
        value={teams}
        onChange={handleTeamChange}
      />
      <div className="checkbox-container">
        <label htmlFor="usePlaceholders">Autofill player names?</label>
        <input
          type="checkbox"
          id="usePlaceholders"
          name="usePlaceholders"
          checked={usePlaceholders}
          onChange={handleUsePlaceholdersChange}
        />
      </div>
      <div className="checkbox-container"> {/* new checkbox container */}
        <label htmlFor="useGeckoNames">Autofill with leopard gecko names?</label>
        <input
          type="checkbox"
          id="useGeckoNames"
          name="useGeckoNames"
          checked={useGeckoNames}
          onChange={handleUseGeckoNamesChange}
        />
      </div>
      <button onClick={handleAddPlayer}>Add Player</button>
      {players.map((player, index) => (
        <div key={index}>
          <input
            type="text"
            value={player}
            onChange={(event) => handlePlayerChange(index, event.target.value)}
          />
          <button onClick={() => handleDeletePlayer(index)}>Delete</button>
        </div>
      ))}
      <button onClick={handleGenerateTeams}>Generate Teams</button>
      {showTeams && (
        <table>
          <thead>
            <tr>
              {Array.from({ length: teams }, (_, i) => (
                <th key={i}>Team {i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(...teamPlayers.map((team) => team.length)) }, (_, i) => (
              <tr key={i}>
                {teamPlayers.map((team, j) => (
                  <td key={j}>{team[i] || ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default TeamGenerator;