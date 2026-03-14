# Copilot Instructions

## Project Overview

This is a React 18 single-page application built with Vite and deployed to GitHub Pages. It uses React Router (react-router-dom) for client-side routing. Each route is a standalone mini-app with its own purpose and self-contained state.

## Architecture Principles

### Standalone Route Apps

Each route (`/team-generator`, `/unmatched-matchup`, `/godot-game`, etc.) is a self-contained app. Components for a route should:

- Own all their state and logic — no shared global state or context providers across routes.
- Manage their own data fetching and initialization.
- Be independently functional — navigating directly to a route via URL must work without visiting the home page first.
- Have their own CSS file for styling.

### Local Storage for State Persistence

All meaningful user state must be persisted to `localStorage` so that refreshing the page does not wipe progress. Follow these patterns:

- **Initialize state from localStorage:** When a component mounts, read saved state from `localStorage` and use it as the initial value. Fall back to sensible defaults if nothing is stored.

  ```jsx
  const [players, setPlayers] = useState(() => {
    const saved = localStorage.getItem("teamGenerator.players");
    return saved ? JSON.parse(saved) : [];
  });
  ```

- **Sync state to localStorage on change:** Use `useEffect` to write state back to `localStorage` whenever it updates.

  ```jsx
  useEffect(() => {
    localStorage.setItem("teamGenerator.players", JSON.stringify(players));
  }, [players]);
  ```

- **Namespace keys by route/app:** Prefix localStorage keys with the app name to avoid collisions (e.g., `teamGenerator.players`, `unmatched.selectedCharacters`).

- **Store only serializable data:** Only persist plain objects, arrays, strings, numbers, and booleans. Do not store functions, DOM references, or derived/computed state.

- **Do not persist ephemeral UI state:** Transient things like hover states, animation flags, or modal open/close status should not be saved.

### Reset State on Demand

Every route app must include a visible "Reset" control that clears all persisted state for that app and restores defaults. Follow these patterns:

- Provide a `resetState` (or similarly named) function that clears all relevant `localStorage` keys for the app and resets React state to initial defaults in a single action.

  ```jsx
  function resetState() {
    localStorage.removeItem("teamGenerator.players");
    localStorage.removeItem("teamGenerator.teams");
    setPlayers([]);
    setTeams(2);
  }
  ```

- The reset button should be clearly labeled (e.g., "Reset", "Start Over") and placed where users can find it without it being too easy to hit accidentally.

- If resetting is destructive (e.g., clears a lot of user input), use a confirmation step like `window.confirm()` before proceeding.

## Code Style & Conventions

- **Functional components only** — no class components.
- **Hooks for state and effects** — use `useState`, `useEffect`, and custom hooks as needed.
- **Keep components in `src/`** — one JSX file and one CSS file per route app.
- **Static assets go in `public/`** — CSVs, images, and embedded game files live here and are referenced by absolute path (e.g., `/UnmatchedCharacters.csv`).
- **PapaParse** is used for CSV parsing — continue using it for any CSV data loading.
- **No external state libraries** — rely on React state + localStorage. Do not introduce Redux, Zustand, Jotai, or similar unless explicitly discussed.
- **Inline SVGs and images** for the home page navigation should remain as `<Link>` components wrapping image buttons.

## Build & Deploy

- Build tool: **Vite** with `@vitejs/plugin-react`.
- Output directory: `./build` (configured in `vite.config.js`).
- Deployment: GitHub Actions workflow builds and deploys to GitHub Pages on push to `main`.
- The Vite `base` is set to `'/'` for SPA routing support. A `404.html` in `public/` handles direct-navigation fallback on GitHub Pages.
