import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Link } from 'react-router-dom';
import TeamGenerator from './TeamGenerator';
import Unmatched from './Unmatched'; // Import Unmatched component
import CoinChaser from './CoinChaser';
import HouseAlwaysWins from './HouseAlwaysWins';
import Jeopardy from './Jeopardy';
import Wubdle from './Wubdle';
import Dropkit from './Dropkit';
import MyHour from './MyHour';
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
        <Link to="/wubdle" className="button">
          <img src="/images/wubdle.svg" alt="Wubdle" />
          <span>Wubdle</span>
        </Link>
        <Link to="/dropkit" className="button">
          <img src="/images/dropkit.svg" alt="DropKit" />
          <span>DropKit</span>
        </Link>
        <Link to="/my-hour" className="button">
          <img src="/images/my-hour.svg" alt="My Hour" />
          <span>My Hour</span>
        </Link>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/team-generator', element: <TeamGenerator /> },
  { path: '/unmatched-matchup', element: <Unmatched /> },
  { path: '/godot-game', element: <CoinChaser /> },
  { path: '/house-always-wins', element: <HouseAlwaysWins /> },
  { path: '/jeopardy', element: <Jeopardy /> },
  { path: '/wubdle', element: <Wubdle /> },
  { path: '/dropkit', element: <Dropkit /> },
  { path: '/my-hour', element: <MyHour /> },
]);

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
