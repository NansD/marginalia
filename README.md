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

Today, the repository contains the Phase 0 foundations and an initial slice toward the v1 local MVP: extension scaffolding, shared UI scaffolding, automated lint/typecheck/test/build scripts, CI workflows, URL canonicalization, local storage plumbing, badge updates, annotation-mode toggling, and a first persisted rectangle path.

## Feature Scope

The detailed implementation phases live in [`plans/plan-marginalia.md`](plans/plan-marginalia.md), but the PRD publication roadmap rolls them up into broader milestones:

- **v1 local MVP (extension only):** sticky notes, text boxes, rectangles, ellipses, straight connectors, keyboard-first tool switching, undo/redo, local storage, URL normalization, and badge updates
- **v2:** highlights, freehand drawing, dashboard/library workflows, and shortcut/help polish
- **Later releases:** sync, monetization, export, and integrations

## Current Status

### Implemented on this branch

- Phase 0 repository foundations are in place:
  - project documentation and contribution guidance
  - GitHub Actions workflows for CI and PR feedback
  - React entry points for `popup`, `options`, and `dashboard`
  - MV3 manifest plus background/content script entry files
  - lint, typecheck, test, and build scripts wired through npm
- An initial runtime slice toward the v1 local MVP is in place:
  - the toolbar button and keyboard shortcut toggle annotation mode on the active page
  - the content script mounts a full-document SVG overlay that becomes inert when mode is off
  - rectangle annotations can already be drawn, saved locally, and rendered back onto the page
  - IndexedDB-backed local storage and canonical URL normalization are implemented
  - the background service worker tracks per-tab canonical URLs and badge counts
- Build output is generated in `dist/` and currently includes:
  - `manifest.json`
  - `popup.html`
  - `options.html`
  - `dashboard.html`
  - compiled assets under `dist/assets/`

### Remaining before the v1 local MVP

- keyboard-first tool switching beyond the mode-toggle shortcut
- selection/editing interactions and undo/redo
- sticky notes, text boxes, ellipses, and straight connectors
- finishing the full extension-only diagramming workflow described in the PRD

### Planned after v1

- v2 adds highlights, freehand drawing, and the dashboard/library workflows.
- Later releases add sync, export, and integrations.

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

| Command             | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | Start Vite in development mode for extension work.         |
| `npm run lint`      | Run ESLint across the TypeScript/React codebase.           |
| `npm run typecheck` | Run the TypeScript project references build in check mode. |
| `npm run test`      | Run the Vitest suite once.                                 |
| `npm run build`     | Build the extension bundle into `dist/`.                   |

A good local verification pass before opening a pull request is:

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

## Loading the Extension

Build the extension first:

```bash
npm run build
```

To rebuild automatically while developing:

```bash
npm run watch:build
```

For Firefox, build with the Firefox-specific manifest patch:

```bash
npm run build:firefox
```

For a Firefox watch build that reapplies the manifest patch after each rebuild:

```bash
npm run watch:build:firefox
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
- Re-run `npm run build:firefox` or keep `npm run watch:build:firefox` running whenever source changes need to be reflected in `dist/` for Firefox.
- The CRX plugin build output is Chromium-first; `build:firefox` patches `dist/manifest.json` to include `background.scripts` as a Firefox fallback.

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
