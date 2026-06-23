import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import TeamGenerator from './TeamGenerator';
import Unmatched from './Unmatched'; // Import Unmatched component
import CoinChaser from './CoinChaser';
import HouseAlwaysWins from './HouseAlwaysWins';
import Jeopardy from './Jeopardy';
import EdmWordle from './EdmWordle';
import './index.css';

function Home() {
  return (
    <div className="home">
      <div className="button-container">
        <Link to="/team-generator" className="button">
          <img src="/images/vs_picture.jpeg" alt="Team Generator" />
          <span>Generate Teams</span>
        </Link>
        <Link to="/unmatched-matchup" className="button">
          <img src="/images/unmatched-cover.png" alt="Unmatched Matchup" />
          <span>Unmatched Matchup</span>
        </Link>
        <Link to="/godot-game" className="button">
          <img src="/images/coin-chase.png" alt="Coin Chaser" />
          <span>Coin Chaser</span>
        </Link>
        <Link to="/house-always-wins" className="button">
          <img src="/images/house-always-wins.png" alt="The House Always Wins" />
          <span>The House Always Wins</span>
        </Link>
        <Link to="/jeopardy" className="button">
          <img src="/images/jeopardy.svg" alt="Jeopardy!" />
          <span>Jeopardy!</span>
        </Link>
        <Link to="/edm-wordle" className="button">
          <img src="/images/edm-wordle.svg" alt="EDM Wordle" />
          <span>EDM Wordle</span>
        </Link>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/team-generator" element={<TeamGenerator />} />
        <Route path="/unmatched-matchup" element={<Unmatched />} />
        <Route path="/godot-game" element={<CoinChaser />} />
        <Route path="/house-always-wins" element={<HouseAlwaysWins />} />
        <Route path="/jeopardy" element={<Jeopardy />} />
        <Route path="/edm-wordle" element={<EdmWordle />} />
      </Routes>
    </Router>
  </React.StrictMode>
);
