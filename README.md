# Step by Step

A visual, privacy-first habit tracker with an interactive progress crystal, focused sessions, adaptive themes and offline-first PWA support.

## Features

- Recurring daily and weekly habits with 5 or 10 minute focus sessions
- Interactive 3D progress crystal, pulse interactions, optional growth nudges
- Animated Amethyst, Lagoon, Dusk and Orbit backgrounds
- Accessible, responsive icons and consistent controls
- Local-only browser storage and JSON backup/restore
- Seven-day progress and streak insights

## Run locally

Open `index.html` via a local web server (for example `python -m http.server 8080`), then navigate to `http://localhost:8080`.

## Deployment

A GitHub Actions workflow in `.github/workflows/pages.yml` publishes the repository to GitHub Pages. In **Settings → Pages**, select **GitHub Actions** as the build and deployment source if not already selected.

Expected live URL: https://vignesh-s-github.github.io/step-by-step/

All personal habit data is stored in the current browser; it is not synced to GitHub or a server.