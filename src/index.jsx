import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import TeamGenerator from './TeamGenerator';
import Unmatched from './Unmatched'; // Import Unmatched component
import CoinChaser from './CoinChaser';
import HouseAlwaysWins from './HouseAlwaysWins';
import Jeopardy from './Jeopardy';
import Wubdle from './Wubdle';
import Dropkit from './Dropkit';
import MyHour from './MyHour';
import Home from './Home';
import './index.css';

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
