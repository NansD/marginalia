# Plan: Marginalia — Web Annotation Extension

> Source PRD: `plans/PRD-marginalia.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Extension**: Web Extensions API MV3, cross-browser Firefox + Chrome
- **Canvas rendering**: SVG for all structured objects (sticky notes, text boxes, shapes, connectors); `<canvas>` composited inside SVG for freehand drawing (Phase 7)
- **Canvas coordinate system**: Document-absolute pixels (`position: absolute`, `top: 0, left: 0`); canvas spans full document width and height; no custom pan offset in v1 — page scrolls natively
- **SVG overlay**: `position: fixed`, `z-index: 2147483647`, direct child of `<body>`; `pointer-events: none` when annotation mode is off; `pointer-events: all` when on (scroll events pass through)
- **Storage interface**: Abstract `StorageAdapter` with `getAnnotations(canonicalUrl)`, `saveAnnotation(...)`, `deleteAnnotation(...)`, `listAnnotatedUrls()`; `LocalAdapter` (IndexedDB via `idb`) is the v1 default; `RemoteAdapter` (Phase 9) swaps in without touching consumers
- **Data models**:
  - `PageRecord { canonicalUrl, pageTitle, lastVisited, tags, annotations[] }`
  - `Annotation { id (UUID), type, createdAt, updatedAt, content }` where content is type-specific (`CanvasContent` or `ConnectorContent`)
- **URL canonical key**: Strip known tracking params (`utm_*`, `fbclid`, `gclid`, `ref`, `source`); strip `#anchor` fragments; preserve `#/…` and `#!/…` (hash-router SPA routes)
- **SPA navigation detection**: `MutationObserver` watching `location.href`; re-evaluates annotation layer on URL change (~50ms lag acceptable)
- **Keyboard Manager**: Central shortcut registry, default bindings persisted/overridden in `browser.storage.sync`, dispatches typed events to canvas and UI
- **Undo/redo**: In-memory command pattern, 100 steps, not persisted across reloads
- **Content script injection**: Eager (declarative in manifest); dormant if no annotations and mode is off
- **Service worker**: Badge updates + message routing only; stateless
- **Dashboard** (Phase 8): Extension page (`chrome-extension://[id]/dashboard.html`), reads `LocalAdapter` directly (same origin); switches to Remote API in Phase 9
- **Toolchain**: React + Vite for extension popup/settings UI and dashboard
- **Color palette**: 6-color fixed palette (`yellow`, `pink`, `green`, `blue`, `orange`, `purple`); custom colors are v2+

---

## Roadmap framing

This implementation plan breaks the PRD publication milestones into smaller delivery phases:

- **v1 local MVP** in the PRD maps to **Phases 1-4** below: extension-only, local-first annotation workflows with structured objects and connectors. It excludes highlights, freehand, dashboard workflows, sync, and export.
- **v2** in the PRD maps to **Phases 5-8** below: shortcut/help polish plus highlights, freehand, and the dashboard/library experience.
- **Later releases** map to **Phases 9-10** below: sync, monetization, export, and integrations.

Current branch status: Phase 0 foundations are in place, and the checked-out code is partway into the v1 track with annotation-mode toggling, local storage, URL normalization, badge updates, and an initial persisted rectangle slice. The remaining v1 scope is still planned work.

---

## Phase 0: Repository Foundations (README + GitHub Actions)

**User stories**: US52 (new contributor can set up locally in under 10 minutes), US53 (all pull requests run automated checks), US54 (main branch protected by passing checks)

### What to build

Create a production-ready `README.md` and baseline CI workflows so the project is easy to understand and safe to evolve. The README should include project purpose, current roadmap status, local setup, dev commands, extension loading steps (Chrome + Firefox), architecture summary, and contribution guidelines. GitHub Actions should run on pull requests and `main`: install dependencies, lint, typecheck, run tests, and build extension artifacts. Add a dedicated workflow for quick PR feedback and a release-ready workflow for heavier checks/artifact packaging.

### Acceptance criteria

- [ ] `README.md` exists at repo root with: overview, feature scope, setup, development commands, load-extension instructions for Chrome and Firefox, and troubleshooting notes
- [ ] README includes a "Current Status" section that links to this implementation plan and clearly marks completed vs upcoming phases
- [ ] `CONTRIBUTING.md` (or README contribution section) defines branch/PR expectations and required checks
- [ ] `.github/workflows/ci.yml` runs on push to `main` and pull requests; executes install, lint, typecheck, test, and build
- [ ] `.github/workflows/pr-checks.yml` provides fast feedback for pull requests (at minimum lint + typecheck + targeted tests)
- [ ] CI uses dependency caching and fails the job on any check failure
- [ ] Build step uploads extension artifacts (zip or packaged output) as workflow artifacts for review
- [ ] Required status checks are documented in README/CONTRIBUTING so branch protection can be configured consistently

---

## Phase 1 (v1 track): Extension Skeleton + Storage + URL Normalization

**User stories**: US1 (toolbar toggle), US2 (keyboard shortcut toggle), US25 (badge indicator), US26 (annotations don't block browsing when off), US28–31 (URL normalization + SPA routing), US32 (auto-save), US33 (local-only, no account)

### What to build

A fully wired extension skeleton: manifest, content script, and toolbar button that toggles annotation mode on/off. The SVG overlay mounts when annotation mode activates and becomes `pointer-events: none` when it deactivates. The Keyboard Manager is initialized with default bindings stored in `browser.storage.sync` — the mode-toggle shortcut works end-to-end. The URL Normalizer derives a canonical key on every page load and SPA navigation event. `LocalAdapter` (IndexedDB) implements the full `StorageAdapter` interface. The Badge Manager reads annotation count and updates the extension icon badge. This phase is primarily the runtime/storage skeleton that the rest of v1 builds on.

### Acceptance criteria

- [ ] Extension loads in Firefox and Chrome (MV3) without errors
- [ ] Toolbar button toggles annotation mode on/off; SVG overlay mounts/becomes inert correctly
- [ ] Configurable keyboard shortcut (default stored in `browser.storage.sync`) also toggles annotation mode
- [ ] URL Normalizer strips tracking params and `#anchor` fragments; preserves `#/…` hash-routes
- [ ] SPA navigation (History API + `hashchange`) triggers canonical URL re-evaluation
- [ ] `LocalAdapter` passes CRUD smoke tests: save → retrieve → delete → list
- [ ] Badge shows annotation count for the current canonical URL; clears when count is 0
- [ ] When annotation mode is off, all clicks/scrolls/text selection pass through to the page unaffected

---

## Phase 2 (v1 track): SVG Canvas + Select Tool + Undo/Redo

**User stories**: US3 (Figma-style tool palette), US4 (single-key tool switching), US5 (scroll page while in annotation mode), US6 (undo/redo), US23 (annotations visible outside annotation mode), US24 (hide/show all toggle), US27 (full pointer-lock in annotation mode, scroll passes through)

### What to build

The SVG canvas layer renders over the page and supports placing, selecting, moving, and deleting annotation objects. The Select tool (`V`) handles click-to-select, drag-box multi-select, drag-to-move, resize handles, and Delete/Backspace to delete. The undo/redo stack (100 steps, in-memory) tracks all mutations. The Figma-style tool palette renders in annotation mode with keyboard bindings for each tool slot (even if most tools aren't wired yet). On page load, the content script loads annotations from `LocalAdapter` and renders them even when annotation mode is off. A hide/show toggle button controls overlay visibility without deleting data. Scroll events pass through the SVG in both modes.

### Acceptance criteria

- [ ] SVG overlay correctly spans full document width and height
- [ ] In annotation mode ON: page interaction is locked; scroll still works
- [ ] In annotation mode OFF: all pointer events pass through to the page
- [ ] Tool palette visible in annotation mode; `V`, `T`, `N`, `R`, `O`, `C` keys switch active tool; `Escape` deselects
- [ ] Select tool: click selects, drag-box multi-selects, drag moves, handles resize, Delete/Backspace deletes
- [ ] Undo (`Ctrl/Cmd+Z`) and redo (`Ctrl/Cmd+Shift+Z`) correctly reverse/replay all canvas mutations
- [ ] On page load of a previously annotated URL, stored annotations render automatically (outside annotation mode)
- [ ] Hide/show all toggle hides/restores the annotation overlay without affecting stored data

---

## Phase 3 (v1 track): Sticky Notes + Text Boxes + Shapes

**User stories**: US7 (place sticky by double-click), US8 (Markdown shortcuts in sticky notes), US9 (resize/drag sticky notes), US10 (sticky note color options), US11 (collapse sticky to title), US19 (rectangles and ellipses), US20 (free-floating text boxes)

### What to build

Three annotation tools wired end-to-end:

**Sticky Note** (`N`): double-click the canvas to place a note. Enters edit mode immediately with a text input supporting Markdown shortcuts on blur (bold, italic, bullet lists, inline code). Color picker with 6 palette options. Collapse/expand toggle. Drag and resize via the Phase 2 select tool.

**Text Box** (`T`): click to place a free-floating text box. Same Markdown-on-blur behavior. Auto-sizes to content; also manually resizable.

**Rect/Ellipse** (`R`/`O`): drag to draw a rectangle or ellipse. Shape fills with the active palette color. Selectable and resizable via Phase 2 handles.

All three types auto-save on every mutation and render correctly on page reload.

### Acceptance criteria

- [ ] Double-click in sticky note mode places a sticky note at that canvas position; immediately enters edit mode
- [ ] `Escape` exits edit mode; note remains on canvas
- [ ] Sticky note Markdown shortcuts (bold, italic, bullet list, inline code) apply on blur and persist through save/reload
- [ ] Color picker shows 6 palette options; selection persists
- [ ] Collapse button reduces note to title row; expand restores full note
- [ ] Text tool click places a free-floating text box; same Markdown-on-blur behavior
- [ ] Text box auto-sizes to content; manual resize via handles also works
- [ ] `R` and `O` tools draw rectangles and ellipses by drag; shape is selected after creation
- [ ] All three types persist via `LocalAdapter` and render correctly on page reload
- [ ] Deleting any object removes it from storage

---

## Phase 4 (v1 track): Connectors + Grouping

**User stories**: US21 (straight arrows connecting shapes, endpoints track when shapes move), US22 (group/ungroup annotation objects)

### What to build

**Connector tool** (`C`): hovering near a shape reveals 5 anchor points (center + 4 edge midpoints). Dragging from an anchor to another shape's anchor creates a straight-line connector stored as `{ sourceId, sourceAnchor, targetId, targetAnchor }`. Connector endpoints recalculate when either attached shape is moved or resized. Connectors can have an optional label. Deleting a shape removes its connectors.

**Grouping**: selecting multiple objects and pressing `Ctrl/Cmd+G` creates a group that moves and resizes as one unit. `Ctrl/Cmd+Shift+G` ungroups.

### Acceptance criteria

- [ ] Hovering near a shape in connector mode reveals anchor points (center + 4 edge midpoints)
- [ ] Dragging from one anchor to another creates a straight-line connector
- [ ] Moving either attached shape repositions the connector endpoints correctly
- [ ] Resizing either attached shape repositions the connector endpoints correctly
- [ ] Deleting a shape removes all connectors attached to it
- [ ] Connector persists via `LocalAdapter` and renders correctly on reload
- [ ] Multi-selecting objects and pressing `Ctrl/Cmd+G` groups them; group moves/resizes/deletes as one unit
- [ ] `Ctrl/Cmd+Shift+G` ungroups; individual objects return to independent selection

---

## Phase 5 (v2 track): Keyboard Shortcuts Settings + Help Overlay

**User stories**: US45 (`?` help overlay showing all shortcuts), US46 (remap any shortcut from extension settings page), US47 (keyboard navigation for all UI panels)

### What to build

The `?` key opens a help overlay rendering the live shortcut map from the Keyboard Manager (current bindings, including user overrides). An extension settings page lists all remappable shortcuts; recording a new key binding writes to `browser.storage.sync` and takes effect immediately. Tool palette, sticky note editor, and settings page are fully keyboard-navigable (Tab/arrow keys, Enter/Space to activate).

### Acceptance criteria

- [ ] `?` opens a help overlay listing all shortcuts with their current bindings
- [ ] Extension settings page lists all remappable shortcuts with their defaults
- [ ] User can record a new key binding; it persists across browser restarts and overrides the default
- [ ] Remapped shortcuts take effect immediately without reloading the extension
- [ ] Tool palette is navigable via keyboard; active tool changes without a mouse
- [ ] Sticky note editor and settings page are fully navigable via Tab/arrow keys

---

## Phase 6 (v2 track): Text Highlights

**User stories**: US12 (color highlight selected text), US13 (attach comment to highlight), US14 (multiple highlight colors), US15 (highlights resilient to minor DOM changes)

### What to build

The Highlight tool (`H`) serializes a text selection as an offset-based DOM anchor (via `@hypothesis/dom-anchor-text-position` or equivalent) and stores it in `LocalAdapter`. On page load, stored anchors are re-applied and rendered as a colored underlay via DOM range manipulation. Clicking a highlight opens a comment popover; the comment persists alongside the anchor. The anchoring algorithm tolerates minor DOM mutations (added/removed whitespace nodes, attribute changes). If re-anchoring fails: fuzzy text search first; tombstone indicator ("1 annotation couldn't be anchored") if fuzzy also fails; never silent drop.

### Acceptance criteria

- [ ] Selecting text and activating the highlight tool creates a colored underlay
- [ ] At least 5 highlight colors are selectable; color persists
- [ ] Clicking a highlight opens a comment popover; comment text saves and renders on reload
- [ ] Highlight re-anchors correctly after page reload
- [ ] Highlight survives minor DOM changes (e.g. class attribute change, whitespace node insertion)
- [ ] Failed re-anchor shows a tombstone indicator rather than silently dropping the annotation
- [ ] Deleting a highlight removes the underlay and comment from storage

---

## Phase 7 (v2 track): Freehand Drawing

**User stories**: US16 (freehand lines/shapes on canvas), US17 (pen color, stroke width, opacity), US18 (selective eraser)

### What to build

The Draw tool (`P`) captures pointer events as freehand strokes rendered on a `<canvas>` element composited inside the SVG. Each stroke is stored as a series of canvas coordinates with its style properties (color, width, opacity). A tool options panel exposes color, stroke width (at least 3 sizes), and opacity. The Eraser sub-tool removes entire strokes that the pointer intersects. All strokes persist via `LocalAdapter`.

### Acceptance criteria

- [ ] `P` tool captures a smooth freehand polyline on the canvas
- [ ] Tool options panel allows changing color, stroke width (at least 3 sizes), and opacity
- [ ] Eraser mode removes whole strokes that are touched; partial stroke erasure is not required
- [ ] Strokes persist via `LocalAdapter` and render correctly on page reload
- [ ] Freehand strokes work correctly alongside SVG annotation objects (correct z-order)

---

## Phase 8 (v2 track): Dashboard (Extension Page)

**User stories**: US36 (JSON export), US37 (URL library listing all annotated pages), US38 (search by URL/title/content), US39 (sort by last edited/created/count/domain), US40 (filter by tag/domain/type), US41 (annotation preview per URL), US42 (open annotated URL from dashboard), US43 (delete annotations for a URL), US44 (tag annotated pages)

### What to build

A React SPA shipped as `dashboard.html` inside the extension bundle (accessible from the extension popup or via `chrome-extension://[id]/dashboard.html`). Reads directly from `LocalAdapter` (same origin, full storage access). Displays a library of annotated URLs with search, sort, and filter controls. Each URL card shows a text preview of its annotations. Users can tag pages, open the annotated URL in a new tab, delete all annotations for a URL, and export all data as JSON.

### Acceptance criteria

- [ ] Dashboard accessible from the extension popup and as a standalone extension page
- [ ] Displays all annotated URLs from `LocalAdapter`
- [ ] Search across URL, page title, and annotation text content returns correct results
- [ ] Sort controls: last edited, date created, annotation count, domain
- [ ] Filter controls: by tag, by domain, by annotation type
- [ ] Each URL card shows a text preview of its annotations
- [ ] "Open" button opens the annotated URL in a new tab
- [ ] "Delete" removes all annotations for a URL from `LocalAdapter`
- [ ] JSON export downloads all annotation data as a `.json` file
- [ ] Tagging a URL persists the tag and makes it available in filter controls

---

## Phase 9: Cloud Sync + Monetization

**User stories**: US34 (optional account + cross-device sync), US35 (sync status indicator)

### What to build

A backend API (auth, annotation sync endpoints) and a `RemoteAdapter` satisfying the `StorageAdapter` interface. `RemoteAdapter` writes optimistically to `LocalAdapter` first, then queues a background sync to the remote API. Conflict resolution: last-write-wins per annotation field via `updatedAt` timestamps. The extension adds a sync status widget (synced / pending / offline). Account creation and a subscription paywall (Stripe or Paddle) gate the sync feature. Free tier: local-only (unchanged). Paid tier (~$5–8/month or ~$40/year): sync enabled.

### Acceptance criteria

- [ ] User can create an account and subscribe via the extension settings page
- [ ] Enabling sync activates `RemoteAdapter`; existing local annotations are uploaded on first sync
- [ ] Annotations created on device A appear on device B after sync
- [ ] Sync status widget shows "synced", "pending", or "offline" correctly
- [ ] Offline mutations queue and sync when connectivity is restored
- [ ] Conflict: later `updatedAt` wins per annotation field
- [ ] Disabling sync reverts to `LocalAdapter`; local data is preserved

---

## Phase 10: Export & Integrations

**User stories**: US48 (Markdown export), US49 (PDF overlay export), US50 (Notion/Obsidian push), US51 (read-only shareable link)

### What to build

Export actions available from the dashboard and extension popup. Markdown export serializes a page's annotations as a structured `.md` document. PDF export renders the page with its annotation overlay to a PDF. Notion and Obsidian integrations push annotations via their respective APIs/local vault paths. Read-only shareable links are hosted on the sync backend (Phase 9 required) and render the annotation layer in view-only mode.

### Acceptance criteria

- [ ] Markdown export produces a readable, structured `.md` file with annotation content and source URL
- [ ] PDF export produces a `.pdf` with the page content and annotation overlay rendered
- [ ] Notion integration pushes annotations to a user-specified Notion database (requires Notion API token)
- [ ] Obsidian integration writes a `.md` file to a user-specified vault path
- [ ] Shareable link renders the annotation overlay for a URL in read-only mode (requires Phase 9)
- [ ] Shareable link does not allow editing or adding annotations
