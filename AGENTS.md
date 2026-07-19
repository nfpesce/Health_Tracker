# Health Tracker

## Project overview

This repository contains a Spanish-language, single-user health tracking web app. It records blood pressure, body temperature, and oxygen saturation, shows summaries and trend charts, and exports CSV or JSON backups.

The application is intentionally static and has no backend or build step. All health records and metric preferences remain in the user's browser through `localStorage`; never introduce remote persistence or analytics without an explicit product decision and a privacy review.

## Repository map

- `index.html`: page structure, forms, summaries, charts, history, and asset cache-busting query strings.
- `styles.css`: complete visual design and responsive behavior.
- `app.js`: state management, validation, rendering, chart SVG generation, and exports.
- `.github/workflows/pages.yml`: GitHub Pages deployment from `main`.
- `.nojekyll`: keeps Pages serving the static files directly.

## Development workflow

Serve the repository root locally; for example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`. There is no package manager or compilation step. Verify JavaScript syntax with `node --check app.js` when Node.js is available, and test UI changes in a real browser at desktop and mobile viewport sizes.

## Implementation conventions

- Keep the app dependency-free and usable as plain static files unless a requested change clearly requires otherwise.
- Preserve compatibility with existing records under `health-tracker-records-v1` and settings under `health-tracker-settings-v1`.
- Treat browser-data compatibility as a release blocker: a deployment must keep the same GitHub Pages origin and must not rename, clear, or overwrite the existing `localStorage` keys.
- Continue accepting comma or period decimal separators and storing normalized numeric values.
- Treat each metric as independently configurable and preserve the last historical value for inactive metrics.
- Keep user-facing copy in Spanish and maintain keyboard and screen-reader accessibility.
- Escape user-provided content before inserting it into HTML.
- When changing `app.js` or `styles.css`, update their query-string versions in `index.html` so GitHub Pages clients receive the new assets.
- Add orientation-specific behavior only where needed; do not regress narrow portrait layouts or desktop grids.

## Deployment

Pushing a commit to `main` triggers `.github/workflows/pages.yml`, which publishes the repository root to GitHub Pages. Publishing new static assets does not clear browser storage as long as the Pages origin and storage keys stay unchanged. Before pushing, ensure the working tree contains only intended changes and run the relevant syntax, persistence, and browser checks.
