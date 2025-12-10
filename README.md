# [callmegreg.github.io](https://callmegreg.github.io/)

This project was built _almost_ entirely through the use of [Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) :rocket:

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server (fast, modern alternative to Create React App)
- **React Router** - Client-side routing
- **PapaParse** - CSV parsing for game data

## Development

Start the development server:

```bash
npm install
npm run dev
```

The site will be available at `http://localhost:5173/`

## Deployment

This site is deployed to GitHub Pages using the `gh-pages` branch.

### Prerequisites

Before deploying, ensure you have all dependencies installed:

```bash
npm install
```

### Deploy to GitHub Pages

To deploy the site, run:

```bash
npm run deploy
```

This command will:
1. Build the production version of the app (via the `predeploy` script)
2. Deploy the contents of the `build` directory to the `gh-pages` branch
3. Push the changes to GitHub, which will automatically update the live site at [https://callmegreg.github.io/](https://callmegreg.github.io/)

### Manual Deployment Steps

If you prefer to deploy manually, you can run:

```bash
npm run build
npx gh-pages -d build
```

## Features

### Unmatched Matchup Generator
- Generate random character matchups for the Unmatched board game
- Control matchup fairness with adjustable win rate sliders
- Real-time display of potential matchup count
- Modern, sleek UI with gradient styling
