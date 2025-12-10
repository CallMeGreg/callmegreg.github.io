import React, { useState, useEffect } from 'react';
import './Unmatched.css';
import Papa from 'papaparse';
import charactersCSV from './UnmatchedCharacters.csv';
import mapsCSV from './UnmatchedMaps.csv';

function Unmatched() {
  const [numPlayers, setNumPlayers] = useState(2); // Default number of players set to 2
  const [characters, setCharacters] = useState([]);
  const [maps, setMaps] = useState([]);
  const [selectedCharacters, setSelectedCharacters] = useState([]);
  const [selectedMaps, setSelectedMaps] = useState([]);
  const [matchup, setMatchup] = useState({ players: [], map: '' });
  const [characterData, setCharacterData] = useState([]); // State to store parsed character data
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasInteracted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasInteracted]);

  useEffect(() => {
    Papa.parse(charactersCSV, {
      download: true,
      header: true, // Enable header parsing
      complete: (result) => {
        const characterNames = result.data.map(row => row['Winner']).filter(name => name); // Fetch from the "Winner" column and filter out empty values
        setCharacters(characterNames);
        setSelectedCharacters(characterNames.map(() => true));
        setCharacterData(result.data); // Store parsed character data
      }
    });

    Papa.parse(mapsCSV, {
      download: true,
      header: true, // Enable header parsing
      complete: (result) => {
        const mapNames = result.data.map(row => row['name']); // Adjust to fetch from the "name" column
        setMaps(mapNames);
        setSelectedMaps(mapNames.map(() => true));
      }
    });
  }, []);

  const handleNumPlayersChange = (e) => {
    setNumPlayers(e.target.value);
  };

  const handleCharacterChange = (index) => {
    setHasInteracted(true);
    const newSelectedCharacters = [...selectedCharacters];
    newSelectedCharacters[index] = !newSelectedCharacters[index];
    setSelectedCharacters(newSelectedCharacters);
  };

  const handleMapChange = (index) => {
    setHasInteracted(true);
    const newSelectedMaps = [...selectedMaps];
    newSelectedMaps[index] = !newSelectedMaps[index];
    setSelectedMaps(newSelectedMaps);
  };

  const generateMatchup = () => {
    setHasInteracted(true);
    const availableCharacters = characters.filter((_, index) => selectedCharacters[index]);
    const availableMaps = maps.filter((_, index) => selectedMaps[index]);

    if (availableCharacters.length < numPlayers || availableMaps.length === 0) {
      alert("Not enough characters or maps selected.");
      return;
    }

    const players = [];
    for (let i = 0; i < numPlayers; i++) {
      const randomIndex = Math.floor(Math.random() * availableCharacters.length);
      players.push(availableCharacters.splice(randomIndex, 1)[0]);
    }

    if (numPlayers === 2) {
      const player1 = players[0].split(' (')[0]; // Extract character name without win rate
      const player2 = players[1].split(' (')[0]; // Extract character name without win rate
      const player1Data = characterData.find(row => row['Winner'] === player1);
      const player2Data = characterData.find(row => row['Winner'] === player2);
      const player1WinRate = player1Data ? player1Data[player2] : 'N/A';
      const player2WinRate = player2Data ? player2Data[player1] : 'N/A';
      players[0] = `${player1} (${player1WinRate}%)`;
      players[1] = `${player2} (${player2WinRate}%)`;
    }

    const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];

    setMatchup({ players, map: randomMap });
  };

  const threshold = 10; // Define the threshold value
  const minWinRate = 40; // Minimum win rate
  const maxWinRate = 60; // Maximum win rate

  const generateFairMatchup = () => {
    setHasInteracted(true);
    const availableCharacters = characters.filter((_, index) => selectedCharacters[index]);
    const availableMaps = maps.filter((_, index) => selectedMaps[index]);

    const fairMatchups = [];

    characterData.forEach(row => {
      const rowCharacter = row['Winner'];
      if (availableCharacters.includes(rowCharacter)) {
        availableCharacters.forEach(colCharacter => {
          const winRate = row[colCharacter];
          if (winRate >= threshold && winRate >= minWinRate && winRate <= maxWinRate) {
            fairMatchups.push({ rowCharacter, colCharacter, value: winRate });
          }
        });
      }
    });

    if (fairMatchups.length === 0) {
      alert("No fair matchups found.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * fairMatchups.length);
    const selectedMatchup = fairMatchups[randomIndex];

    const player1WinRate = selectedMatchup.value;
    const player2WinRate = characterData.find(row => row['Winner'] === selectedMatchup.colCharacter)[selectedMatchup.rowCharacter];

    const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];

    setMatchup({
      players: [
        `${selectedMatchup.rowCharacter} (${player1WinRate}%)`,
        `${selectedMatchup.colCharacter} (${player2WinRate}%)`
      ],
      map: randomMap,
      fairMatchupCount: Math.floor(fairMatchups.length / 2) // Add the count of fair matchups divided by 2
    });
  };

  const generateUnfairMatchup = () => {
    setHasInteracted(true);
    const availableCharacters = characters.filter((_, index) => selectedCharacters[index]);
    const availableMaps = maps.filter((_, index) => selectedMaps[index]);

    const unfairMatchups = [];

    characterData.forEach(row => {
      const rowCharacter = row['Winner'];
      if (availableCharacters.includes(rowCharacter)) {
        availableCharacters.forEach(colCharacter => {
          const winRate = row[colCharacter];
          if (winRate >= threshold && (winRate < minWinRate || winRate > maxWinRate)) {
            unfairMatchups.push({ rowCharacter, colCharacter, value: winRate });
          }
        });
      }
    });

    if (unfairMatchups.length === 0) {
      alert("No unfair matchups found.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * unfairMatchups.length);
    const selectedMatchup = unfairMatchups[randomIndex];

    const player1WinRate = selectedMatchup.value;
    const player2WinRate = characterData.find(row => row['Winner'] === selectedMatchup.colCharacter)[selectedMatchup.rowCharacter];

    const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];

    setMatchup({
      players: [
        `${selectedMatchup.rowCharacter} (${player1WinRate}%)`,
        `${selectedMatchup.colCharacter} (${player2WinRate}%)`
      ],
      map: randomMap,
      unfairMatchupCount: Math.floor(unfairMatchups.length / 2) // Add the count of unfair matchups divided by 2
    });
  };

  const regeneratePlayer = (index) => {
    setHasInteracted(true);
    const availableCharacters = characters.filter((_, i) => selectedCharacters[i] && !matchup.players.includes(characters[i]));
    const randomIndex = Math.floor(Math.random() * availableCharacters.length);
    const newPlayers = [...matchup.players];
    newPlayers[index] = availableCharacters[randomIndex];

    if (numPlayers === 2) {
      const player1 = newPlayers[0].split(' (')[0]; // Extract character name without win rate
      const player2 = newPlayers[1].split(' (')[0]; // Extract character name without win rate
      const player1Data = characterData.find(row => row['Winner'] === player1);
      const player2Data = characterData.find(row => row['Winner'] === player2);
      const player1WinRate = player1Data ? player1Data[player2] : 'N/A';
      const player2WinRate = player2Data ? player2Data[player1] : 'N/A';
      newPlayers[0] = `${player1} (${player1WinRate}%)`;
      newPlayers[1] = `${player2} (${player2WinRate}%)`;
    }

    setMatchup({ ...matchup, players: newPlayers });
  };

  const regenerateMap = () => {
    setHasInteracted(true);
    const availableMaps = maps.filter((_, index) => selectedMaps[index]);
    const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
    setMatchup({ ...matchup, map: randomMap });
  };

  const selectAllCharacters = () => {
    setHasInteracted(true);
    setSelectedCharacters(characters.map(() => true));
  };

  const deselectAllCharacters = () => {
    setHasInteracted(true);
    setSelectedCharacters(characters.map(() => false));
  };

  const selectAllMaps = () => {
    setHasInteracted(true);
    setSelectedMaps(maps.map(() => true));
  };

  const deselectAllMaps = () => {
    setHasInteracted(true);
    setSelectedMaps(maps.map(() => false));
  };

  return (
    <div className="unmatched">
      <h1>⚔️ Unmatched Matchup 🛡️</h1> {/* Added swords and shield emojis */}
      <div>
        <label>
          Number of Players:
          <input type="number" value={numPlayers} onChange={handleNumPlayersChange} min="2" max="5" />
        </label>
      </div>
      <div className="generate-button-container">
        <button className="generate-button" onClick={generateMatchup}>Random Matchup</button>
        <div className="generate-button-group">
          <button className="generate-button" onClick={generateFairMatchup}>Fair Matchup</button>
          <button className="generate-button" onClick={generateUnfairMatchup}>Unfair Matchup</button>
        </div>
      </div>
      {matchup.players.length > 0 && (
        <div className="matchup-results">
          <h2>Matchup Results</h2>
          {matchup.fairMatchupCount && (
            <p>Number of possible fair matchups: {matchup.fairMatchupCount}</p>
          )}
          {matchup.unfairMatchupCount && (
            <p>Number of possible unfair matchups: {matchup.unfairMatchupCount}</p>
          )}
          <div className="results-grid">
            <div className="results-section">
              <h3>Characters</h3>
              <ul>
                {matchup.players.map((player, index) => (
                  <li key={index}>
                    {player} <button onClick={() => regeneratePlayer(index)}>↻</button> {/* Updated button text to arrow */}
                  </li>
                ))}
              </ul>
            </div>
            <div className="results-section">
              <h3>Map</h3>
              <p>{matchup.map} <button onClick={regenerateMap}>↻</button> {/* Updated button text to arrow */}</p>
            </div>
          </div>
        </div>
      )}
      <div className="grid">
        <div>
          <h2>Character Selection</h2>
          <button onClick={selectAllCharacters}>Select All</button>
          <button onClick={deselectAllCharacters}>Deselect All</button>
          <ul>
            {characters.map((character, index) => (
              <li key={character}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedCharacters[index]}
                    onChange={() => handleCharacterChange(index)}
                  />
                  {character}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Map Selection</h2>
          <button onClick={selectAllMaps}>Select All</button>
          <button onClick={deselectAllMaps}>Deselect All</button>
          <ul>
            {maps.map((map, index) => (
              <li key={map}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMaps[index]}
                    onChange={() => handleMapChange(index)}
                  />
                  {map}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Unmatched;
