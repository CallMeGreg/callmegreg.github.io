# [callmegreg.github.io](https://callmegreg.github.io/)

A fun collection of vibe-coded projects built with React and Vite :robot:

## Applets

| Applet | Description |
| --- | --- |
| [Team Generator](https://callmegreg.github.io/team-generator) | Randomly split a list of players into teams. |
| [Unmatched Matchup](https://callmegreg.github.io/unmatched-matchup) | Generate character and map combinations, with optional win-rate filters for two-player matchups. |
| [Coin Chaser](https://callmegreg.github.io/godot-game) | Play the Coin Chaser platformer directly in your browser. |
| [The House Always Wins](https://callmegreg.github.io/house-always-wins) | Launch the embedded The House Always Wins browser game. |
| [Jeopardy!](https://callmegreg.github.io/jeopardy) | Host a custom trivia game with CSV questions, team scores, multiple rounds, and Final Jeopardy. |
| [Wubdle](https://callmegreg.github.io/wubdle) | Guess an EDM artist from clues, with daily challenges and shareable seeded puzzles. |
| [DropKit](https://callmegreg.github.io/dropkit) | Build DJ sets by matching tracks to a subgenre, musical key, and BPM. |
| [My Hour](https://callmegreg.github.io/my-hour) | Play a Spotify playlist in one-minute turns with a bell, shuffle, and optional endless mode. |

## Local Development

```bash
npm ci --ignore-scripts
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/`. Run `npm test` for My Hour's checks and `npm run build` to generate `build/`.

## Spotify setup

My Hour requires Spotify Premium and an allowlisted account (development apps support up to five users). Create an app with Web API and Web Playback SDK access in the [Spotify dashboard](https://developer.spotify.com/dashboard).

Set its public Client ID as `VITE_SPOTIFY_CLIENT_ID` in `.env.local` (see `.env.example`) and as the `SPOTIFY_CLIENT_ID` Actions repository variable for deployment. Register `https://callmegreg.github.io/my-hour` and `http://127.0.0.1:5173/my-hour` as redirect URIs; never add a client secret. Playback timing can be affected by Spotify latency and browser suspension.

## Build & Deploy

The site automatically builds & deploys to [https://callmegreg.github.io/](https://callmegreg.github.io/) when changes are pushed to the `main` branch.
