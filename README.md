# Marginalia

Marginalia is a local-first browser extension for annotating the web. The repository is built with React, TypeScript, Vite, Vitest, and the CRX Vite plugin so Chrome- and Firefox-compatible extension surfaces can ship from one codebase.

For the roadmap and phase-by-phase delivery plan, see [`plans/plan-marginalia.md`](plans/plan-marginalia.md).

## Overview

This project is aimed at a web annotation workspace with:

- an extension popup for quick controls
- an options page for settings and shortcuts
- a dashboard page for browsing saved annotations
- content-script and background entry points for extension runtime behavior
- a local-first architecture that can later grow into optional sync

Today, the repository contains the Phase 0 foundations and an initial Phase 1 runtime slice: extension scaffolding, shared UI scaffolding, automated lint/typecheck/test/build scripts, CI workflows, URL canonicalization, local storage plumbing, badge updates, and annotation-mode toggling.

## Feature Scope

The planned product scope is described in [`plans/plan-marginalia.md`](plans/plan-marginalia.md) and currently covers:

- Phase 0: repository foundations, documentation, and CI
- Phase 1: extension skeleton, local storage, URL normalization, and mode toggling
- Phase 2+: annotation tools, highlights, dashboard workflows, sync, and export features

## Current Status

### Implemented in this slice

- Phase 0 repository foundations are in place:
  - project documentation and contribution guidance
  - GitHub Actions workflows for CI and PR feedback
  - React entry points for `popup`, `options`, and `dashboard`
  - MV3 manifest plus background/content script entry files
  - lint, typecheck, test, and build scripts wired through npm
- A Phase 1 runtime slice is in place:
  - the toolbar button and keyboard shortcut toggle annotation mode on the active page
  - the content script mounts a full-document SVG overlay that becomes inert when mode is off
  - IndexedDB-backed local storage and canonical URL normalization are implemented
  - the background service worker tracks per-tab canonical URLs and badge counts
- Build output is generated in `dist/` and currently includes:
  - `manifest.json`
  - `popup.html`
  - `options.html`
  - `dashboard.html`
  - compiled assets under `dist/assets/`

### Planned next phases

- Phase 2 will add canvas interactions, selection, undo/redo, and persistent rendering of annotation objects.
- Later phases will add richer annotation tools, dashboard data workflows, sync, and export/integration features.

If you are looking for the detailed roadmap, start with [`plans/plan-marginalia.md`](plans/plan-marginalia.md).

## Setup

### Prerequisites

- Node.js 22.x recommended for local development and CI
- npm (bundled with Node.js)

### Install dependencies

```bash
npm ci
```

## Development Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite in development mode for extension work. |
| `npm run lint` | Run ESLint across the TypeScript/React codebase. |
| `npm run typecheck` | Run the TypeScript project references build in check mode. |
| `npm run test` | Run the Vitest suite once. |
| `npm run build` | Build the extension bundle into `dist/`. |

A good local verification pass before opening a pull request is:

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

## Loading the Extension

Build the extension first:

```bash
npm run build
```

### Chrome / Chromium

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository's `dist/` directory.
5. Click the toolbar button to toggle annotation mode on the current page.
6. Open `dist/popup.html`, `dist/options.html`, or `dist/dashboard.html` if you want to inspect the scaffolded React surfaces directly.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `dist/manifest.json`.
4. Click the toolbar button to toggle annotation mode on the current page.
5. Open the built extension pages if you want to inspect the scaffolded React surfaces.

Notes:

- Firefox temporary add-ons are removed when the browser restarts.
- Re-run `npm run build` whenever source changes need to be reflected in `dist/`.

## Architecture Summary

The current repository foundation is organized around a few clear surfaces:

- `src/manifest.ts` defines the MV3 manifest through `@crxjs/vite-plugin`.
- `src/popup/`, `src/options/`, and `src/dashboard/` are separate React entry points for future extension surfaces.
- `src/shared/` holds reusable UI and shared config.
- `src/content/index.ts` is the content-script entry.
- `src/content/overlayController.ts` and `src/content/navigationObserver.ts` manage the page overlay and SPA URL observation.
- `src/background/index.ts` is the service worker entry.
- `src/shared/storage/` contains the IndexedDB-backed local adapter used in the Phase 1 slice.
- `src/shared/url/` contains canonical URL normalization logic.
- `src/shared/runtime/` contains shared runtime message and shortcut handling.
- `vite.config.ts` wires the CRX plugin and build inputs for `popup.html`, `options.html`, and `dashboard.html`.
- `vitest.config.ts` configures jsdom-based tests with shared test setup.

Current build artifacts are emitted to `dist/`, which is also the directory uploaded by CI for review.

## Contribution Flow

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full flow. In short:

1. Branch from `main`.
2. Make a focused change.
3. Run the required local checks.
4. Open a pull request with a clear summary and testing notes.
5. Wait for the required GitHub checks to pass before merging.

### Required status checks

Document these in branch protection for `main`:

- `pr-checks / lint`
- `pr-checks / typecheck`
- `pr-checks / test`
- `ci / verify`
- `ci / build`

## Troubleshooting

### `dist/` is missing or stale

Run:

```bash
npm run build
```

### ESLint or TypeScript checks fail after switching branches

Refresh dependencies and rerun the verification commands:

```bash
npm ci
npm run lint
npm run typecheck
```

### The extension will not load in the browser

- Make sure you selected `dist/` for Chrome or `dist/manifest.json` for Firefox.
- Rebuild after any source changes with `npm run build`.
- If the browser cached an old unpacked build, remove the extension and load the latest `dist/` output again.

### Tests fail in CI but passed locally

Use the same sequence as CI:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```
