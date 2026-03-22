# PRD: Marginalia — Web Annotation Extension

## Problem Statement

Browsing the web is a passive, read-only experience. Users who research, study, write, or simply want to remember their thoughts about a page have no built-in way to annotate it in place. Existing tools (Hypothesis, Diigo) are either too academic, require mandatory accounts, have poor UX, or feel disconnected from the page. There is no tool today that brings the fluid, canvas-based creativity of FigJam or Whimsical to the web browsing experience — while keeping data local-first and respecting user privacy.

## Solution

Marginalia is a Firefox and Chrome extension that overlays a canvas annotation layer on any web page. When annotation mode is activated, the page becomes a Whimsical/FigJam-like workspace — users can write, place objects, connect shapes with arrows, and annotate freely. Users toggle annotation mode with a toolbar button or keyboard shortcut. Annotations are stored locally by default (no account required). A companion dashboard (extension page) lets users browse, search, and manage all annotated pages. Optional cloud sync is available as a paid upgrade.

## User Stories

### Annotation Mode

1. As a user, I want to toggle annotation mode on/off with a toolbar button, so that my normal browsing experience is never disrupted.
2. As a user, I want to toggle annotation mode with a configurable keyboard shortcut, so that I can annotate without reaching for the mouse.
3. As a user, I want annotation mode to activate with a Figma-style tool palette (Select, Text, Sticky Note, Rect, Ellipse, Connector), so that I can switch tools quickly without menus.
4. As a user, I want each tool to be accessible via a single keyboard key (`V` = select, `T` = text, `N` = sticky note, `R` = rectangle, `O` = ellipse, `C` = connector, `Escape` = exit/deselect), so that I can annotate without lifting my hands from the keyboard.
5. As a user, I want to scroll the page normally while in annotation mode, so that I can annotate content anywhere on the page.
6. As a user, I want an undo/redo stack (`Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z`) for all annotation actions, so that I can experiment without fear.

### Sticky Notes

7. As a user, I want to place a sticky note anywhere on a page by double-clicking in sticky note mode, so that I can capture thoughts tied to a visual location.
8. As a user, I want sticky notes to support Markdown shortcuts (bold, italic, bullet lists, inline code), so that I can express structured thoughts without a toolbar.
9. As a user, I want to resize and drag sticky notes freely on the canvas, so that I can organize them spatially.
10. As a user, I want sticky notes to have multiple color options, so that I can visually categorize annotations.
11. As a user, I want to collapse a sticky note to just its title, so that I can reduce visual clutter.

### Text Highlights _(Phase 2)_

12. As a user, I want to select any text on a page and apply a color highlight to it, so that I can mark important content inline.
13. As a user, I want to attach a comment to a highlight, so that I can explain why I marked something.
14. As a user, I want to choose from multiple highlight colors, so that I can use color as a semantic signal (e.g. red = disagree, green = important).
15. As a user, I want highlights to be resilient to minor DOM changes on the page, so that they survive site updates.

### Freehand Drawing _(Phase 2)_

16. As a user, I want to draw freehand lines and shapes on the page canvas, so that I can sketch diagrams or circle things.
17. As a user, I want to choose pen color, stroke width, and opacity, so that I can customize my drawings.
18. As a user, I want to erase freehand strokes selectively, so that I can correct mistakes.

### Shapes & Connectors

19. As a user, I want to draw rectangles and ellipses on the canvas, so that I can annotate with structured visual elements.
20. As a user, I want to add free-floating text boxes anywhere on the page, so that I can write longer notes not tied to a sticky note.
21. As a user, I want to connect shapes with straight arrows that stay attached when I move the shapes, so that I can diagram ideas on top of the page.
22. As a user, I want to group annotation objects and move/resize them together, so that I can manage complex annotations efficiently.

### Visibility & Overlay

23. As a user, I want all annotations to be visible when I load a previously annotated page (even outside annotation mode), so that my notes are always present as context.
24. As a user, I want a button to hide/show all annotations at once, so that I can temporarily see the original page without losing my work.
25. As a user, I want the extension icon to display a visual indicator (badge/dot) when the current page has annotations, so that I know at a glance when notes exist.
26. As a user, I want annotations to not interfere with clicking, scrolling, or selecting text when annotation mode is off, so that the browsing experience is completely unaffected.
27. As a user, I want page interaction (clicking links, selecting text) to be locked while annotation mode is on, so that mouse events don't conflict with canvas operations. Scroll still works.

### URL & Page Matching

28. As a user, I want annotations to appear on the correct page regardless of tracking query parameters (utm_*, fbclid, etc.), so that link sources don't fragment my notes.
29. As a user, I want annotations to persist correctly on single-page applications as I navigate between views, so that SPA routing doesn't cause notes to disappear or bleed between pages.
30. As a user, I want hash-route fragments (`#/dashboard`) to be treated as distinct pages, so that SPA sub-pages each have their own annotation layer.
31. As a user, I want standard anchor fragments (`#section-3`) to be stripped from the canonical URL, so that jumping to different sections of the same page shares one annotation layer.

### Storage & Sync

32. As a user, I want all my annotations to be saved automatically as I annotate, so that I never lose work due to forgetting to save.
33. As a user, I want annotations to be stored locally in my browser by default, with no account required, so that I can use the tool with full privacy.
34. As a user, I want to optionally create an account and enable cloud sync, so that my annotations are available across multiple devices.
35. As a user, I want a clear indication of sync status (synced, pending, offline), so that I know whether my data is safely backed up.
36. As a user, I want to export all my annotations as JSON, so that I own my data and can back it up independently.

### Dashboard _(Phase 2)_

37. As a user, I want a dashboard page (accessible from the extension) that lists all URLs I have annotated, so that I can see my full annotation history at a glance.
38. As a user, I want to search across all annotated pages by URL, page title, or annotation content, so that I can find notes I wrote weeks ago.
39. As a user, I want to sort annotated pages by last edited, date created, number of annotations, or domain, so that I can organize my library.
40. As a user, I want to filter annotated pages by tag, domain, or annotation type, so that I can narrow to relevant notes.
41. As a user, I want to see a preview of annotations for each URL in the dashboard, so that I can identify the right page quickly.
42. As a user, I want to open any annotated URL directly from the dashboard, so that I can jump back into context with one click.
43. As a user, I want to delete annotations for a given URL from the dashboard, so that I can clean up outdated notes.
44. As a user, I want to tag annotated pages with custom labels, so that I can build a personal taxonomy of my annotations.

### Keyboard Shortcuts & Configurability

45. As a user, I want to view all available keyboard shortcuts in a help overlay (`?` key), so that I can learn the tool quickly.
46. As a user, I want to remap any keyboard shortcut from an extension settings page, so that I can adapt the tool to my existing habits.
47. As a user, I want keyboard navigation for all UI panels (tool palette, sticky note editor, dashboard), so that I can operate entirely without a mouse.

### Export & Integrations _(Phase 4)_

48. As a user, I want to export annotations for a page as Markdown, so that I can paste them into my notes app.
49. As a user, I want to export a page's annotations as a PDF overlay, so that I can share annotated pages with others.
50. As a user, I want to push annotations to Notion or Obsidian, so that my web research flows into my knowledge base automatically.
51. As a user, I want to share a read-only link to my annotations on a page, so that I can collaborate asynchronously without real-time co-editing.

---

## Implementation Decisions

### Architecture Decisions (resolved)

| Decision | Resolution | Rationale |
|---|---|---|
| Canvas coordinate space | Document-absolute pixels (`position: absolute`, `top: 0, left: 0`) | Simpler than viewport-fixed; survives scroll naturally |
| Infinite canvas (beyond document) | Deferred to v2 | Browser scroll can't reach out-of-document space; v1 canvas = document bounds |
| Space+drag | Native browser scroll | Canvas IS document space in v1; no custom pan offset needed |
| Canvas rendering | SVG for all structured objects (sticky, text, shapes, connectors) | Zero bundle cost, free DOM hit-testing, scales without pixelation |
| Freehand drawing | Deferred to v2 | Phase 1 focus on Whimsical-style diagramming |
| Highlight tool | Deferred to v2 | Separate DOM-anchored pipeline; high technical risk |
| Dashboard | Phase 2, shipped as extension page (`chrome-extension://[id]/dashboard.html`) | No cross-origin messaging needed; GitHub Pages = marketing/landing only |
| SPA navigation detection | `MutationObserver` watching `location.href` changes | Catches all SPA frameworks without MAIN-world injection; ~50ms lag acceptable |
| Undo/redo | In-memory command pattern, 100 steps, not persisted across reloads | Consistent with all other tools; per-reload scope is expected |
| Annotation mode interaction | Full pointer lock — page interaction disabled in annotation mode; scroll events pass through | Simplest mental model; no click conflicts |
| Sticky note text | Markdown shortcuts on blur, no rich text toolbar | Keyboard-centric; zero bundle cost |
| Arrow connectors | Straight-line connectors in v1 (sourceId + sourceAnchor + targetId + targetAnchor); orthogonal elbow routing in v2 | Core Whimsical-style value prop; straight lines are sufficient for v1 |
| Color palette | 6-color fixed palette, defined as a named config object (extensible for v2 custom colors) | Fast to use; opinionated |
| Content script injection | Eager (declarative in manifest); dormant if no annotations and mode is off | Required for user story 23 (annotations visible on page load) |
| Service worker role | Badge updates + message routing only; stateless | MV3 service workers are killed after ~30s; no persistent state |
| SVG z-index | `position: fixed`, `z-index: 2147483647`, direct child of `<body>` | Sits above all page UI including fixed headers and modals |

### Color Palette

```ts
export const PALETTE = [
  { id: 'yellow',  label: 'Yellow',  value: '#FFD93D' }, // default sticky
  { id: 'pink',    label: 'Pink',    value: '#FF6B9D' },
  { id: 'green',   label: 'Green',   value: '#6BCB77' },
  { id: 'blue',    label: 'Blue',    value: '#4D96FF' }, // default shape fill
  { id: 'orange',  label: 'Orange',  value: '#FF9F43' },
  { id: 'purple',  label: 'Purple',  value: '#A29BFE' },
] as const
```

Shapes default to Blue fill with stroke one shade darker. Sticky notes default to Yellow. Palette is a config object — custom colors and themes are a v2+ concern.

### Module Architecture

**Content Script (extension)**
- Injected eagerly into every page on load; checks IndexedDB for existing annotations
- Mounts SVG overlay if annotations exist or annotation mode is activated; otherwise dormant
- Detects SPA navigation via `MutationObserver` watching `location.href`; re-evaluates annotation layer on URL change
- Owns all annotation state and storage operations (IndexedDB reads/writes happen here, not in the service worker)
- Passes messages to service worker for badge updates

**SVG Canvas Layer**
- Single `<svg>` element, `position: absolute`, `top: 0`, `left: 0`, spans full document width and height
- In annotation mode OFF: `pointer-events: none` — all clicks pass through to page
- In annotation mode ON: `pointer-events: all` — page interaction fully locked; scroll events pass through
- SVG z-index: `position: fixed` overlay at `z-index: 2147483647`, direct child of `<body>`
- Renders all annotation objects: sticky notes (foreignObject), text boxes, rects, ellipses, connectors
- Supports select, multi-select, drag, resize (handles), grouping, and undo/redo

**Annotation Tools**
- Each tool is a discrete module: `SelectTool`, `StickyNoteTool`, `TextBoxTool`, `RectTool`, `EllipseTool`, `ConnectorTool`
- `ConnectorTool`: on hover near a shape, shows anchor points (center + 4 edge midpoints); drag from anchor to another shape's anchor creates a connector storing `{ sourceId, sourceAnchor, targetId, targetAnchor }`; connector endpoints recalculate on source/target shape move/resize
- Phase 2 additions: `HighlightTool` (DOM-anchored, separate pipeline), `DrawTool` (freehand, `<canvas>` composited inside SVG)

**Highlight Tool (Phase 2)**
- Uses `@hypothesis/dom-anchor-text-position` or equivalent for robust text anchoring
- Failure strategy: fuzzy text search in current DOM first; tombstone ("1 annotation couldn't be anchored") if fuzzy fails; never silent drop

**URL Normalizer**
- Converts any browser URL to a canonical key used as the annotation storage key
- Strips known tracking params (utm_*, fbclid, gclid, ref, source, etc.)
- Strips simple `#anchor` fragments (not hash-routes)
- Preserves `#/...` and `#!/...` fragments (hash-router SPA detection heuristic)
- Configurable per-domain overrides in extension settings

**Storage Adapter**
- Abstract interface: `getAnnotations(canonicalUrl)`, `saveAnnotation(...)`, `deleteAnnotation(...)`, `listAnnotatedUrls()`
- `LocalAdapter`: IndexedDB-backed via `idb` wrapper, no auth required, v1 default
- `RemoteAdapter` (v3): REST API calls with JWT auth, optimistic local writes, background sync queue, conflict resolution via last-write-wins with per-field timestamps
- Extension and Dashboard both import the same adapter interface

**Keyboard Manager**
- Central registry of all shortcuts with default bindings
- Persisted overrides in `chrome.storage.sync` / Firefox `browser.storage.sync`
- Dispatches typed events to the SVG Canvas and UI components
- Help overlay renders the live shortcut map

**Badge Manager (service worker)**
- Wakes on messages from content script reporting annotation count for the active tab
- Updates `chrome.action.setBadgeText`; clears badge if count is 0
- Stateless — no persistent state in service worker

**Dashboard App (Phase 2 — extension page)**
- Shipped as `dashboard.html` inside the extension bundle
- Reads directly from `LocalAdapter` (same origin, full storage access)
- In v3: reads from Remote API when sync is enabled
- Components: `UrlLibrary`, `AnnotationPreview`, `SearchBar`, `FilterPanel`, `SortControls`, `TagManager`, `ExportMenu`

### Data Model (v1 — LocalAdapter)

```
AnnotationStore {
  pages: {
    [canonicalUrl: string]: PageRecord
  }
}

PageRecord {
  canonicalUrl: string
  pageTitle:    string
  lastVisited:  ISO8601
  tags:         string[]
  annotations:  Annotation[]
}

Annotation {
  id:        UUID
  type:      'sticky' | 'text' | 'rect' | 'ellipse' | 'connector'
             // Phase 2: 'highlight' | 'draw'
  createdAt: ISO8601
  updatedAt: ISO8601
  content:   AnnotationContent   // type-specific payload (see below)
}

// Canvas objects (sticky, text, rect, ellipse)
CanvasContent {
  x:       number   // document-absolute pixels from top-left
  y:       number
  width:   number
  height:  number
  color:   PaletteId
  text?:   string   // markdown source for sticky/text
}

// Connector
ConnectorContent {
  sourceId:     UUID
  sourceAnchor: 'top' | 'right' | 'bottom' | 'left' | 'center'
  targetId:     UUID
  targetAnchor: 'top' | 'right' | 'bottom' | 'left' | 'center'
  label?:       string
  color:        PaletteId
}
```

**Coordinate note**: positions are document-absolute pixels. Annotations do not reflow on page layout changes (window resize, font size change, dynamic content injection). Canvas objects are "pinned to position, not content" — only the Highlight tool (Phase 2) is content-anchored.

### URL Matching Strategy

- Canonical URL computed on every page load and on every SPA navigation event (detected via MutationObserver)
- Tracking param strip list maintained as an extension-updatable config
- Hash-route heuristic: if `#` is followed by `/` or `!`, treat as route-significant; otherwise strip

### Keyboard Shortcut Defaults

| Key | Action |
|-----|--------|
| `V` | Select tool |
| `T` | Text box tool |
| `N` | Sticky note tool |
| `R` | Rectangle tool |
| `O` | Ellipse tool |
| `C` | Connector tool |
| `Escape` | Deselect / exit tool |
| `Ctrl/Cmd+Z` | Undo (100 steps, in-memory) |
| `Ctrl/Cmd+Shift+Z` | Redo |
| `Ctrl/Cmd+G` | Group selected |
| `Delete/Backspace` | Delete selected |
| `?` | Show shortcut help |
| Configurable | Toggle annotation mode |

### Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Extension | Web Extensions API (MV3) | Cross-browser Firefox + Chrome compatibility |
| Canvas rendering | SVG (structured objects) | Zero bundle cost, free hit-testing, infinite scale |
| Freehand drawing (v2) | `<canvas>` composited inside SVG | Isolates performance-sensitive path rendering |
| Text highlighting (v2) | `@hypothesis/dom-anchor-text-position` or equivalent | Battle-tested DOM anchoring |
| Extension UI | React + Vite | Familiarity, fast dev loop |
| Dashboard (v2) | React + Vite, extension page | Full storage access, no cross-origin issues |
| Local storage | IndexedDB via `idb` wrapper | Quota, performance, structured queries |
| Backend (v3) | Node.js / Fastify or similar | To be decided at sync phase |

---

## Publication Plan

### Phase 1 — Local MVP (Extension only)

**Goal**: Working Whimsical-style annotation experience with local storage. No dashboard, no sync, no highlights, no freehand.

**Deliverables**:
- Firefox + Chrome extension with SVG canvas overlay
- Annotation tools: Sticky Note (Markdown), Text Box, Rect, Ellipse, Straight Connector
- Whimsical-style connectors with shape anchoring (sourceId/targetId)
- Keyboard-centric UX + configurable shortcuts
- Badge indicator for annotated pages
- LocalAdapter (IndexedDB)
- URL normalization + SPA navigation detection
- Annotation mode full-lock UX

**Publication**:
- Submit to Firefox Add-ons (AMO) — review typically 1-2 weeks
- Submit to Chrome Web Store — review typically 2-3 business days
- List as "Beta" / "Early Access"
- GitHub Pages = marketing/landing page only

**What to validate**: Do people install and use it? Do annotations survive page reloads? Is the diagramming UX (connectors) compelling?

---

### Phase 2 — Highlights + Dashboard

**Goal**: Complete the annotation toolkit with text highlights; add annotation library management.

**Deliverables**:
- Text Highlight tool (DOM-anchored, fuzzy fallback, tombstone on failure)
- Dashboard as extension page: URL library, search, sort, filter, tag, preview, delete, JSON export
- Freehand Draw tool (`<canvas>` composited)

**Publication**:
- Update extension with new tools
- Update store listings with dashboard screenshots
- Post on Hacker News "Show HN", Product Hunt, r/firefox, r/productivity, r/PKMS

---

### Phase 3 — Cloud Sync (Monetization unlock)

**Goal**: Annotations sync across devices. Introduction of paid tier.

**Deliverables**:
- Backend API (auth, annotation sync, conflict resolution via last-write-wins + per-field timestamps)
- RemoteAdapter in extension
- Sync status UI in extension
- Account creation + subscription (Stripe or Paddle)
- Free tier: local-only (unchanged)
- Paid tier (~$5-8/month or ~$40/year): sync, future sharing features

**Publication**:
- Announce sync via in-extension notification
- Update store listings and landing page
- Consider Product Hunt relaunch

---

### Phase 4 — Integrations & Growth

**Deliverables**:
- Export to Markdown, Notion, Obsidian, PDF
- Read-only shareable annotation links
- Orthogonal/elbow connector routing
- True infinite canvas (beyond document bounds)
- Safari extension (evaluate based on demand)
- API for power users / developers

---

## Testing Decisions

**Philosophy**: Test external behavior only — what the user observes — not internal implementation details.

| Module | Test type | What to assert |
|--------|-----------|----------------|
| URL Normalizer | Unit | Input URL → expected canonical output; tracking param stripping; hash-route detection edge cases |
| Storage Adapter | Integration | CRUD operations persist and retrieve correctly; LocalAdapter and RemoteAdapter satisfy the same interface contract |
| SVG Canvas Engine | Integration (headless browser) | Placing, moving, resizing, deleting objects; undo/redo stack correctness; multi-select; connector endpoint recalculation on shape move |
| Connector Tool | Integration | Moving source shape updates connector; moving target shape updates connector; deleting a shape removes its connectors |
| Keyboard Manager | Unit | Shortcut dispatch fires correct events; remapped shortcuts override defaults |
| Dashboard search/filter (v2) | Integration | Querying annotated URLs returns correct, sorted, filtered results |

**What not to test**: SVG rendering details, React component internals, exact pixel positions.

---

## Out of Scope

- Real-time collaboration / multiplayer annotations
- Mobile browser support (iOS/Android)
- Safari extension (v1-v3)
- Annotation of PDF files
- AI-powered annotation suggestions or summarization
- Auto-disabling on sensitive/banking domains
- Per-domain annotation visibility controls
- Public annotation feeds / social features
- Video / media timestamped annotations
- Infinite canvas beyond document bounds (v1-v3)
- Orthogonal/elbow connector routing (v1-v2)
- Custom color picker (v1)

---

## Further Notes

- **Privacy first**: In v1, zero data leaves the user's machine. Core brand value, communicated at install time.
- **Performance**: Content script is dormant on pages with no annotations and mode off. SVG layer degrades gracefully up to ~150 annotations per page.
- **Extension size**: MV3 constraints apply. SVG rendering has zero bundle cost. React is lazy-loaded for UI panels only.
- **Accessibility**: Keyboard-first design helps, but full WCAG 2.1 AA compliance is a stretch goal post-v1.
- **Naming**: "Marginalia" historically refers to notes and illuminations in manuscript margins — thoughtful, personal annotation layered over shared knowledge.
