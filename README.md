# Step by Step

A gentle, visual habit tracker with the approved Rising Steps purple icon, dynamic themed backgrounds, and the interactive 3D **Cosmic Flight**.

## Live site

**https://vignesh-s-github.github.io/step-by-step/**

The site is deployed automatically from the `dist/` directory through `.github/workflows/pages.yml` whenever `main` changes. Deployment status: [GitHub Actions](https://github.com/Vignesh-S-GitHub/step-by-step/actions).

## Features

- Small daily or selected-weekday habits with timed 5/10-minute (or custom) sessions and check-offs
- Optional goal increases after five sessions, with a configurable maximum
- Touch- and keyboard-interactive Cosmic Flight with a zone every eight lifetime sessions and occasional golden steps
- Theme-wide **Amethyst**, **Lagoon**, **Dusk**, and **Orbit** palettes with animated atmospheres that respond to today's progress
- Matching SVG controls, accessible dropdowns, themed seven-day multiselect, responsive mobile navigation
- Session history and progress charts, calendar check-ins for yesterday, and archived or paused habits
- Next-destination countdown and an optional weekly goal that counts distinct check-in days
- Installable offline-ready PWA with the approved 1024px Rising Steps logo and optimized device icons
- Local browser storage and JSON backup export/import with golden steps

## Development

The deployable static app lives in **`dist/`**, with plain ES modules; no package install or build step is required.

```sh
python -m http.server 8080 --directory dist
```

Then open [http://localhost:8080](http://localhost:8080). The browser requires a local HTTP server for the service worker and ES modules.

To check the scene on a phone, open Today, drag to orbit the scene, tap the rocket to fire the thruster, and log a session. Open `?zone=5` to preview the Moon without changing saved progress. Change the app theme and reopen Today to compare the scenery.

Run regression tests with Node.js:

```sh
node --test tests/*.test.mjs
```

## GitHub Pages setup

The workflow deploys automatically **after** Pages is enabled for this repository. If your workflow says `Get Pages site failed`, navigate to **Settings → Pages → Build and deployment → Source: GitHub Actions**. A future `main` push will republish the app, or you can re-run the workflow from the Actions tab.

The published artifact is `dist/`, not the repository root. Keep relative asset URLs so GitHub project pages work correctly.

## Privacy and limitations

Habits, timer state, and completions are stored on this device in the current browser. They do not sync between browsers or devices. Use Settings → Download activity data to keep a backup. Import activity data merges a backup into the current data and skips duplicate habit/day sessions. Cosmic Flight can use its cached Three.js renderer offline and uses an interactive Canvas 2D fallback if WebGL or the renderer is unavailable.
