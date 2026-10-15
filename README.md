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
| [My Hour](https://callmegreg.github.io/my-hour) | Play a Spotify playlist in one-minute turns with a can-opening sound, shuffle, and optional endless mode. |

## Local Development

```bash
npm ci --ignore-scripts
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/`. Run `npm test` for My Hour's checks and `npm run build` to generate `build/`.

My Hour treats Spotify playback commands as status-only acknowledgements: successful responses
(including HTTP 200 and 204) do not require JSON. Token, account, and playlist responses still
require JSON, and the minute timer starts only after the browser player confirms playback.

My Hour shows your Spotify profile picture and connection status in the account row. Use
the reload icon beside the playlist selector to refresh playlists and songs. Expand
the selected playlist to see its song count and browse every entry in a scrollable list capped at ten visible songs;
entries excluded from playback are labeled. Changing playlists during an unfinished hour
keeps the current song number, resets the timer to **1:00**, and stays paused until **Resume**.
The new playlist starts from its first song (or a fresh shuffled order); finite hours still
end at song 60 or when the new playlist runs out. Refreshing restores an unfinished hour paused.

Use **Sign out** to stop playback and disconnect My Hour without resetting your settings.
Connecting again always shows Spotify's authorization screen, where **Not you?** lets you
choose another account. Signing back in with the same account keeps your saved hour;
connecting a different account clears the previous account's hour and playlist selection.
Signing out of My Hour does not sign you out of Spotify in other tabs.

The full-volume transition cue is a recorded can opening, played only while Spotify is paused.
`public/sounds/can-opening.mp3` is the high-quality MP3 preview of
[“Can Opening fizzy drink soda pop high quality.wav” by CADSoundDesignEmporium](https://freesound.org/people/CADSoundDesignEmporium/sounds/513823/),
used under [CC0](https://creativecommons.org/publicdomain/zero/1.0/).

## Build & Deploy

The site automatically builds & deploys to [https://callmegreg.github.io/](https://callmegreg.github.io/) when changes are pushed to the `main` branch.
