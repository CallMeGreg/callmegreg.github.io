# [callmegreg.github.io](https://callmegreg.github.io/)

A fun collection of vibe-coded projects :robot:

## Tech Stack

- **React** - UI framework
- **Vite** - Build tool and dev server

## Local Development

Start the development server:

```bash
npm install --ignore-scripts
npm run dev
```

The site will be available at `http://localhost:5173/`

## Jeopardy!

Host a custom game of Jeopardy! Navigate to the [Jeopardy!](https://callmegreg.github.io/jeopardy) applet to configure and play.

### CSV Format

Questions are loaded via CSV files. Example files are included in the repo and can be downloaded from the setup screen.

**Round CSV** (`jeopardy-round-example.csv`) — 6 rows, one per category, with 5 questions each:

```
Category,Q1,Q2,Q3,Q4,Q5
Science,"What planet is known as the Red Planet?","What is the chemical symbol for water?","What gas do plants absorb?","What is the speed of light?","What particle carries a positive charge?"
History,"In what year did WWII end?","Who was the first US President?","What civilization built the pyramids?","When did the Berlin Wall fall?","Who wrote the Declaration of Independence?"
...
```

- **Q1** is the lowest value ($200 in Round 1, $400 in Round 2)
- **Q5** is the highest value ($1000 in Round 1, $2000 in Round 2)
- Must have exactly 6 rows (categories) and all 5 question columns filled

**Final Jeopardy CSV** (`jeopardy-final-example.csv`) — a single question with a category:

```
Category,Question
World Leaders,"This leader, born in 1769, crowned himself Emperor of France in 1804"
```

### Game Features

- **1 or 2 rounds** with 6 categories × 5 questions each
- **Optional Final Jeopardy** with team wagers
- **Customizable teams** with score tracking
- **State persistence** — refresh the page without losing progress
- **Confetti celebration** for the winning team 🎉

## Build & Deploy

The site automatically builds & deploys to [https://callmegreg.github.io/](https://callmegreg.github.io/) when changes are pushed to the `main` branch.
