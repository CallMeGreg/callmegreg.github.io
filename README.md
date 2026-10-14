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

My Hour treats Spotify playback commands as status-only acknowledgements: successful responses
(including HTTP 200 and 204) do not require JSON. Token, account, and playlist responses still
require JSON, and the minute timer starts only after the browser player confirms playback.

## Build & Deploy

The site automatically builds & deploys to [https://callmegreg.github.io/](https://callmegreg.github.io/) when changes are pushed to the `main` branch.
