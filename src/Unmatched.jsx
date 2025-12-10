import React, { useState, useEffect } from 'react';
import './Unmatched.css';
import Papa from 'papaparse';

const THRESHOLD = 10; // Minimum threshold value for valid matchups

function Unmatched() {
  const [numPlayers, setNumPlayers] = useState(2); // Default number of players set to 2
  const [characters, setCharacters] = useState([]);
  const [maps, setMaps] = useState([]);
  const [selectedCharacters, setSelectedCharacters] = useState([]);
  const [selectedMaps, setSelectedMaps] = useState([]);
  const [matchup, setMatchup] = useState({ players: [], map: '' });
  const [characterData, setCharacterData] = useState([]); // State to store parsed character data
  const [minWinRate, setMinWinRate] = useState(0); // Minimum win rate for slider
  const [maxWinRate, setMaxWinRate] = useState(100); // Maximum win rate for slider
  const [matchupCount, setMatchupCount] = useState(0); // Number of potential matchups

  useEffect(() => {
    Papa.parse('/UnmatchedCharacters.csv', {
      download: true,
      header: true, // Enable header parsing
      complete: (result) => {
        const characterNames = result.data.map(row => row['Winner']).filter(name => name); // Fetch from the "Winner" column and filter out empty values
        setCharacters(characterNames);
        setSelectedCharacters(characterNames.map(() => true));
        setCharacterData(result.data); // Store parsed character data
      }
    });

    Papa.parse('/UnmatchedMaps.csv', {
      download: true,
      header: true, // Enable header parsing
      complete: (result) => {
        const mapNames = result.data.map(row => row['name']); // Adjust to fetch from the "name" column
        setMaps(mapNames);
        setSelectedMaps(mapNames.map(() => true));
      }
    });
  }, []);

  // Calculate potential matchups count when slider values or character selections change
  useEffect(() => {
    if (characterData.length === 0) return;

    const availableCharacters = characters.filter((_, index) => selectedCharacters[index]);
    const matchups = [];

    characterData.forEach(row => {
      const rowCharacter = row['Winner'];
      if (availableCharacters.includes(rowCharacter)) {
        availableCharacters.forEach(colCharacter => {
          const winRate = parseFloat(row[colCharacter]);
          if (!isNaN(winRate) && winRate >= THRESHOLD && winRate >= minWinRate && winRate <= maxWinRate && rowCharacter !== colCharacter) {
            matchups.push({ rowCharacter, colCharacter, value: winRate });
          }
        });
      }
    });

    setMatchupCount(Math.floor(matchups.length / 2)); // Divide by 2 to avoid counting duplicates
  }, [minWinRate, maxWinRate, selectedCharacters, characterData, characters]);

  const handleNumPlayersChange = (num) => {
    setNumPlayers(num);
  };

  const handleCharacterChange = (index) => {
    const newSelectedCharacters = [...selectedCharacters];
    newSelectedCharacters[index] = !newSelectedCharacters[index];
    setSelectedCharacters(newSelectedCharacters);
  };

  const handleMapChange = (index) => {
    const newSelectedMaps = [...selectedMaps];
    newSelectedMaps[index] = !newSelectedMaps[index];
    setSelectedMaps(newSelectedMaps);
  };

  const generateMatchup = () => {
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
      players[0] = `${player1} (${player1WinRate})`;
      players[1] = `${player2} (${player2WinRate})`;
    }

    const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];

    setMatchup({ players, map: randomMap });
  };

  const generateRangedMatchup = () => {
    const availableCharacters = characters.filter((_, index) => selectedCharacters[index]);
    const availableMaps = maps.filter((_, index) => selectedMaps[index]);

    const rangedMatchups = [];

    characterData.forEach(row => {
      const rowCharacter = row['Winner'];
      if (availableCharacters.includes(rowCharacter)) {
        availableCharacters.forEach(colCharacter => {
          const winRate = parseFloat(row[colCharacter]);
          if (!isNaN(winRate) && winRate >= THRESHOLD && winRate >= minWinRate && winRate <= maxWinRate && rowCharacter !== colCharacter) {
            rangedMatchups.push({ rowCharacter, colCharacter, value: winRate });
          }
        });
      }
    });

    if (rangedMatchups.length === 0) {
      alert("No matchups found in the selected win rate range.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * rangedMatchups.length);
    const selectedMatchup = rangedMatchups[randomIndex];

    const player1Data = characterData.find(row => row['Winner'] === selectedMatchup.rowCharacter);
    const player2Data = characterData.find(row => row['Winner'] === selectedMatchup.colCharacter);
    const player1WinRate = player1Data ? player1Data[selectedMatchup.colCharacter] : 'N/A';
    const player2WinRate = player2Data ? player2Data[selectedMatchup.rowCharacter] : 'N/A';

    const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];

    setMatchup({
      players: [
        `${selectedMatchup.rowCharacter} (${player1WinRate})`,
        `${selectedMatchup.colCharacter} (${player2WinRate})`
      ],
      map: randomMap
    });
  };

  const regeneratePlayer = (index) => {
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
      newPlayers[0] = `${player1} (${player1WinRate})`;
      newPlayers[1] = `${player2} (${player2WinRate})`;
    }

    setMatchup({ ...matchup, players: newPlayers });
  };

  const regenerateMap = () => {
    const availableMaps = maps.filter((_, index) => selectedMaps[index]);
    const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
    setMatchup({ ...matchup, map: randomMap });
  };

  const selectAllCharacters = () => {
    setSelectedCharacters(characters.map(() => true));
  };

  const deselectAllCharacters = () => {
    setSelectedCharacters(characters.map(() => false));
  };

  const selectAllMaps = () => {
    setSelectedMaps(maps.map(() => true));
  };

  const deselectAllMaps = () => {
    setSelectedMaps(maps.map(() => false));
  };

  return (
    <div className="unmatched">
      <h1>⚔️ Unmatched Matchup 🛡️</h1> {/* Added swords and shield emojis */}
      
      {/* Number of Players Button Group */}
      <div className="player-count-container">
        <label>Number of Players:</label>
        <div className="player-button-group">
          <button 
            className={`player-button ${numPlayers === 2 ? 'selected' : ''}`}
            onClick={() => handleNumPlayersChange(2)}
          >
            2
          </button>
          <button 
            className={`player-button ${numPlayers === 3 ? 'selected' : ''}`}
            onClick={() => handleNumPlayersChange(3)}
          >
            3
          </button>
          <button 
            className={`player-button ${numPlayers === 4 ? 'selected' : ''}`}
            onClick={() => handleNumPlayersChange(4)}
          >
            4
          </button>
        </div>
      </div>
      
      {/* Win Rate Range Sliders - Only visible for 2 players */}
      {numPlayers === 2 && (
        <div className="slider-container">
          <h3>Win Rate Range</h3>
          <div className="slider-group">
            <div className="slider-item">
              <label htmlFor="minWinRate">Minimum Win Rate: {minWinRate}%</label>
              <input
                type="range"
                id="minWinRate"
                min="0"
                max="100"
                value={minWinRate}
                onChange={(e) => {
                  const value = Math.min(parseInt(e.target.value), 50);
                  setMinWinRate(value);
                  setMaxWinRate(100 - value);
                }}
                className="slider"
              />
            </div>
            <div className="slider-item">
              <label htmlFor="maxWinRate">Maximum Win Rate: {maxWinRate}%</label>
              <input
                type="range"
                id="maxWinRate"
                min="0"
                max="100"
                value={maxWinRate}
                onChange={(e) => {
                  const value = Math.max(parseInt(e.target.value), 50);
                  setMaxWinRate(value);
                  setMinWinRate(100 - value);
                }}
                className="slider"
              />
            </div>
          </div>
          <div className="matchup-counter">
            <p>Potential Matchups: <strong>{matchupCount}</strong></p>
          </div>
        </div>
      )}

      <div className="generate-button-container">
        <button className="generate-button" onClick={generateMatchup}>Random Matchup</button>
        {numPlayers === 2 && (
          <button className="generate-button ranged-button" onClick={generateRangedMatchup}>
            Generate Matchup ({minWinRate}% - {maxWinRate}%)
          </button>
        )}
      </div>
      {matchup.players.length > 0 && (
        <div className="matchup-results">
          <h2>Matchup Results</h2>
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
