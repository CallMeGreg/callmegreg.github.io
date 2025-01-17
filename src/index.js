import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import TeamGenerator from './TeamGenerator';
import Unmatched from './Unmatched'; // Import Unmatched component
import './index.css';
import CoinChaser from './CoinChaser';

function Home() {
  const quotes = [
    "Randomness is the spice of life.",
    "Embrace the chaos of randomness.",
    "In randomness, there is order.",
    "Randomness is the true nature of the universe.",
    "Life is a series of random events."
  ];
  const [quote, setQuote] = useState('');

  useEffect(() => {
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    setQuote(randomQuote);
  }, []);

  return (
    <div className="home">
      <h1>{quote}</h1>
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
      </Routes>
    </Router>
  </React.StrictMode>
);
