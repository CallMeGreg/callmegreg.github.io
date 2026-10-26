# [callmegreg.github.io](https://callmegreg.github.io/)

My personal site: projects, published work, and a playground of small games and
tools. Built with React and Vite.

## Deployment

Pushes to `main` run the [GitHub Actions workflow](.github/workflows/build-and-deploy.yml),
which installs dependencies, runs tests, builds the site into `build/`, and deploys
it to GitHub Pages. `public/404.html` supports direct links to app routes.

My Hour's Spotify integration uses the `SPOTIFY_CLIENT_ID` repository variable,
passed to Vite as `VITE_SPOTIFY_CLIENT_ID` during the build.
