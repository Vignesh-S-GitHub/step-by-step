# Step by Step

A gentle, visual habit tracker with the approved Rising Steps purple icon, dynamic themed backgrounds, and an interactive 3D **Momentum Core** crystal.

## Live site

**https://vignesh-s-github.github.io/step-by-step/**

The site is deployed automatically from the `dist/` directory through `.github/workflows/pages.yml` whenever `main` changes. Deployment status: [GitHub Actions](https://github.com/Vignesh-S-GitHub/step-by-step/actions).

## Features

- Small daily or selected-weekday habits with timed 5/10-minute (or custom) sessions and check-offs
- Optional goal increases after five sessions, with a configurable maximum
- Touch/mouse-draggable, rotating 3D crystal; touch/click pulse, progress shards and milestones
- Theme-wide **Amethyst**, **Lagoon**, **Dusk**, and **Orbit** palettes with animated atmospheres that respond to today's progress
- Matching SVG controls, accessible dropdowns, themed seven-day multiselect, responsive mobile navigation
- Session history and progress charts; archived and paused habits
- Installable offline-ready PWA with the approved 1024px Rising Steps logo and optimized device icons
- Local browser storage and JSON data export (no account or server required)

## Development

The deployable static app lives in **`dist/`**, with plain ES modules; no package install or build step is required.

```sh
python -m http.server 8080 --directory dist
```

Then open [http://localhost:8080](http://localhost:8080). The browser requires a local HTTP server for the service worker and ES modules.

Run regression tests with Node.js:

```sh
node --test tests/*.test.mjs
```

## GitHub Pages setup

The workflow deploys automatically **after** Pages is enabled for this repository. If your workflow says `Get Pages site failed`, navigate to **Settings → Pages → Build and deployment → Source: GitHub Actions**. A future `main` push will republish the app, or you can re-run the workflow from the Actions tab.

The published artifact is `dist/`, not the repository root. Keep relative asset URLs so GitHub project pages work correctly.

## Privacy and limitations

Habits, timer state, and completions are stored on this device in the current browser. They do not sync between browsers or devices. Use Settings → Export to keep a backup. Installed PWA icons and offline behavior depend on browser support.
