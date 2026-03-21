# PRD: Marginalia — Web Annotation Extension

## Problem Statement

Browsing the web is a passive, read-only experience. Users who research, study, write, or simply want to remember their thoughts about a page have no built-in way to annotate it in place. Existing tools (Hypothesis, Diigo) are either too academic, require mandatory accounts, have poor UX, or feel disconnected from the page. There is no tool today that brings the fluid, canvas-based creativity of FigJam or Whimsical to the web browsing experience — while keeping data local-first and respecting user privacy.

## Solution

Marginalia is a Firefox and Chrome extension that overlays a rich, infinite canvas annotation layer on any web page. When annotation mode is activated, the page becomes a boundless FigJam-like workspace — users can write, draw, and place objects not just on top of page content, but freely in the margins, below the fold, or anywhere in the infinite surrounding space. Users toggle annotation mode with a toolbar button or keyboard shortcut, then annotate freely using sticky notes, text boxes, highlights, freehand drawings, and shapes — all in a Figma/Whimsical-inspired UI that is keyboard-centric and feels fast. Annotations are stored locally by default (no account required). A companion dashboard (hosted web app) lets users browse, search, and manage all annotated pages. Optional cloud sync is available as a paid upgrade.

## User Stories

### Annotation Mode

1. As a user, I want to toggle annotation mode on/off with a toolbar button, so that my normal browsing experience is never disrupted.
2. As a user, I want to toggle annotation mode with a configurable keyboard shortcut, so that I can annotate without reaching for the mouse.
3. As a user, I want annotation mode to activate with a Figma-style tool palette (Select, Text, Sticky Note, Highlight, Draw, Shape), so that I can switch tools quickly without menus.
4. As a user, I want each tool to be accessible via a single keyboard key (e.g. `V` = select, `T` = text, `N` = sticky note, `H` = highlight, `P` = pen/draw, `R` = rectangle, `Escape` = exit/deselect), so that I can annotate without lifting my hands from the keyboard.
5. As a user, I want the annotation canvas to be infinite in all directions (like Figma), so that I have unlimited room to write, draw, and think beyond the boundaries of the page content.
6. As a user, I want to pan the infinite canvas while in annotation mode by holding `Space` and dragging, so that I can navigate to any part of my annotation workspace.
7. As a user, I want to zoom in/out the annotation canvas with `Ctrl/Cmd +/-` or pinch gesture, so that I can work with precision or see my full annotation layout at a glance.
8. As a user, I want a "fit to annotations" shortcut (`Ctrl/Cmd+Shift+H`) that zooms the canvas to show all my annotations at once, so that I can get an overview without manually panning and zooming.
9. As a user, I want an undo/redo stack (`Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z`) for all annotation actions, so that I can experiment without fear.

### Sticky Notes

8. As a user, I want to place a sticky note anywhere on a page by double-clicking in sticky note mode, so that I can capture thoughts tied to a visual location.
9. As a user, I want sticky notes to support rich text (bold, italic, bullet lists, inline code), so that I can express structured thoughts.
10. As a user, I want to resize and drag sticky notes freely on the canvas, so that I can organize them spatially.
11. As a user, I want sticky notes to have multiple color options, so that I can visually categorize annotations.
12. As a user, I want to collapse a sticky note to just its title, so that I can reduce visual clutter.

### Text Highlights

13. As a user, I want to select any text on a page and apply a color highlight to it, so that I can mark important content inline.
14. As a user, I want to attach a comment to a highlight, so that I can explain why I marked something.
15. As a user, I want to choose from multiple highlight colors, so that I can use color as a semantic signal (e.g. red = disagree, green = important).
16. As a user, I want highlights to be resilient to minor DOM changes on the page, so that they survive site updates.

### Freehand Drawing

17. As a user, I want to draw freehand lines and shapes on the page canvas, so that I can sketch diagrams or circle things.
18. As a user, I want to choose pen color, stroke width, and opacity, so that I can customize my drawings.
19. As a user, I want to erase freehand strokes selectively, so that I can correct mistakes.

### Shapes & Text Boxes

20. As a user, I want to draw rectangles, ellipses, and arrows on the canvas, so that I can annotate with structured visual elements.
21. As a user, I want to add free-floating text boxes anywhere on the page, so that I can write longer notes not tied to a sticky note.
22. As a user, I want to connect shapes with arrows to show relationships, so that I can diagram ideas on top of the page.
23. As a user, I want to group annotation objects and move/resize them together, so that I can manage complex annotations efficiently.

### Visibility & Overlay

24. As a user, I want all annotations to be visible when I load a previously annotated page (even outside annotation mode), so that my notes are always present as context.
25. As a user, I want a button to hide/show all annotations at once, so that I can temporarily see the original page without losing my work.
26. As a user, I want the extension icon to display a visual indicator (badge/dot) when the current page has annotations, so that I know at a glance when notes exist.
27. As a user, I want annotations to not interfere with clicking, scrolling, or selecting text when annotation mode is off, so that the browsing experience is completely unaffected.

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

### Dashboard

37. As a user, I want a dashboard page that lists all URLs I have annotated, so that I can see my full annotation history at a glance.
38. As a user, I want the dashboard accessible as a browser new tab override (opt-in) or as a standalone web app, so that I can access it in the way that suits my workflow.
39. As a user, I want to search across all annotated pages by URL, page title, or annotation content, so that I can find notes I wrote weeks ago.
40. As a user, I want to sort annotated pages by last edited, date created, number of annotations, or domain, so that I can organize my library.
41. As a user, I want to filter annotated pages by tag, domain, or annotation type, so that I can narrow to relevant notes.
42. As a user, I want to see a preview of annotations for each URL in the dashboard, so that I can identify the right page quickly.
43. As a user, I want to open any annotated URL directly from the dashboard, so that I can jump back into context with one click.
44. As a user, I want to delete annotations for a given URL from the dashboard, so that I can clean up outdated notes.
45. As a user, I want to tag annotated pages with custom labels, so that I can build a personal taxonomy of my annotations.

### Keyboard Shortcuts & Configurability

46. As a user, I want to view all available keyboard shortcuts in a help overlay (`?` key), so that I can learn the tool quickly.
47. As a user, I want to remap any keyboard shortcut from an extension settings page, so that I can adapt the tool to my existing habits.
48. As a user, I want keyboard navigation for all UI panels (tool palette, sticky note editor, dashboard), so that I can operate entirely without a mouse.

### Export & Integrations (post-v1)

49. As a user, I want to export annotations for a page as Markdown, so that I can paste them into my notes app.
50. As a user, I want to export a page's annotations as a PDF overlay, so that I can share annotated pages with others.
51. As a user, I want to push annotations to Notion or Obsidian, so that my web research flows into my knowledge base automatically.
52. As a user, I want to share a read-only link to my annotations on a page, so that I can collaborate asynchronously without real-time co-editing.

---

## Implementation Decisions

### Module Architecture

**Content Script (extension)**
- Injected into every page on load; responsible for mounting the annotation canvas overlay on top of the page DOM
- Listens for URL changes (including SPA navigation via History API and `hashchange` events) and re-evaluates which annotation layer to display
- Passes messages between the Canvas Engine and the Storage Adapter via a typed internal message bus

**Canvas Engine**
- Renders all annotation objects (sticky notes, text boxes, shapes, drawings, highlights) using an HTML Canvas or SVG hybrid layer that sits above the page content
- The canvas is infinite in all directions: annotation objects can be placed at any coordinate, including far outside the page's natural dimensions, in the margins, or below the fold
- The viewport into the infinite canvas is controlled by a pan offset and zoom level; the underlying page content scrolls independently, while the canvas tracks it
- Supports pan, zoom, selection, multi-select, grouping, drag, resize, and an undo/redo stack
- "Fit to annotations" computes the bounding box of all objects and adjusts viewport accordingly
- Inspired by Figma/Whimsical interaction patterns: tool modes toggled via keyboard, object manipulation via handles, `Escape` to deselect
- In annotation mode OFF: canvas is pointer-events:none so all clicks pass through to the page

**Annotation Tools**
- Each tool is a discrete module: `HighlightTool`, `StickyNoteTool`, `DrawTool`, `TextBoxTool`, `ShapeTool`
- `HighlightTool` is the only DOM-anchored tool — it uses a robust text anchoring algorithm (similar to `@hypothesis/dom-anchor-text-position`) that serializes selection as offset-based anchors, resilient to minor DOM changes
- All other tools operate in canvas coordinate space (absolute position relative to scrollable page)

**URL Normalizer**
- Converts any browser URL to a canonical key used as the annotation storage key
- Strips known tracking params (utm_*, fbclid, gclid, ref, source, etc.) from query strings
- Strips simple `#anchor` fragments (not matching hash-route patterns)
- Preserves `#/...` and `#!/...` fragments (hash-router SPA detection)
- Configurable per-domain overrides in extension settings (power users)

**Storage Adapter**
- Abstract interface: `getAnnotations(canonicalUrl)`, `saveAnnotation(...)`, `deleteAnnotation(...)`, `listAnnotatedUrls()`
- `LocalAdapter`: IndexedDB-backed, no auth required, v1 default
- `RemoteAdapter` (future): REST API calls with JWT auth, optimistic local writes, background sync queue, conflict resolution via last-write-wins with per-field timestamps
- Extension and Dashboard both import the same adapter interface — swapping from local to remote requires no changes to consumers

**Keyboard Manager**
- Central registry of all shortcuts with default bindings
- Persisted overrides in `chrome.storage.sync` / Firefox `browser.storage.sync`
- Dispatches typed events to the Canvas Engine and UI components
- Help overlay renders the live shortcut map

**Badge Manager**
- Listens to Storage Adapter for annotation count changes on the active tab URL
- Updates `chrome.action.setBadgeText` / Firefox equivalent
- Shows count if >0, clears badge otherwise

**Dashboard App (React, GitHub Pages)**
- Static React SPA deployed to GitHub Pages
- In v1: reads directly from `LocalAdapter` via an extension messaging bridge (content script exposes a read API to the dashboard page)
- In v2: reads from Remote API when sync is enabled
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
  pageTitle: string
  lastVisited: ISO8601
  tags: string[]
  annotations: Annotation[]
}

Annotation {
  id: UUID
  type: 'highlight' | 'sticky' | 'text' | 'draw' | 'shape'
  createdAt: ISO8601
  updatedAt: ISO8601
  position: { x: number, y: number }   // canvas coords (null for highlight)
  content: AnnotationContent            // type-specific payload
}
```

### URL Matching Strategy

- Canonical URL computed on every page load and on every navigation event
- Tracking param strip list maintained as an extension-updatable config (no code release needed to add new params)
- Hash-route heuristic: if `#` is followed by `/` or `!`, treat as route-significant; otherwise strip

### Keyboard Shortcut Defaults (Figma-inspired)

| Key | Action |
|-----|--------|
| `V` | Select tool |
| `T` | Text box tool |
| `N` | Sticky note tool |
| `H` | Highlight tool |
| `P` | Pen/draw tool |
| `R` | Rectangle tool |
| `O` | Ellipse tool |
| `A` | Arrow tool |
| `Space+drag` | Pan canvas |
| `Escape` | Deselect / exit tool |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Shift+Z` | Redo |
| `Ctrl/Cmd+G` | Group selected |
| `Delete/Backspace` | Delete selected |
| `?` | Show shortcut help |
| Configurable | Toggle annotation mode |

### Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Extension | Web Extensions API (MV3) | Cross-browser Firefox + Chrome compatibility |
| Canvas rendering | Konva.js or custom SVG | Mature canvas interaction library; fallback to raw SVG if bundle size is a concern |
| Text highlighting | `@hypothesis/dom-anchor-text-position` or equivalent | Battle-tested DOM anchoring |
| Extension UI | React + Vite | Familiarity, fast dev loop |
| Dashboard | React + Vite, deployed to GitHub Pages | Static hosting, no server cost in v1 |
| Local storage | IndexedDB via `idb` wrapper | Quota, performance, structured queries |
| Backend (v2) | Node.js / Fastify or similar | To be decided at sync phase |

---

## Publication Plan

### Phase 1 — Local MVP (Extension only)

**Goal**: Working annotation experience with local storage. No dashboard, no sync.

**Deliverables**:
- Firefox + Chrome extension with canvas overlay
- All annotation tools (highlight, sticky, text, draw, shapes)
- Keyboard-centric UX + configurable shortcuts
- Badge indicator for annotated pages
- LocalAdapter (IndexedDB)
- URL normalization

**Publication**:
- Submit to [Firefox Add-ons (AMO)](https://addons.mozilla.org) — review typically 1-2 weeks
- Submit to [Chrome Web Store](https://chrome.google.com/webstore) — review typically 2-3 business days
- List as "Beta" / "Early Access" to set expectations
- Set up a minimal landing page (GitHub Pages) explaining what Marginalia is

**What to validate**: Do people install and use it? Do annotations survive page reloads? Is the annotation UX delightful enough?

---

### Phase 2 — Dashboard

**Goal**: Users can manage all their annotated pages in one place.

**Deliverables**:
- React dashboard deployed to GitHub Pages
- Full URL library: search, sort, filter, tag
- Annotation preview per URL
- Delete / export (JSON) from dashboard
- Opt-in new tab override

**Publication**:
- Update extension to point to dashboard URL
- Update Chrome Web Store and AMO listings with screenshots of dashboard
- Post on Hacker News "Show HN", Product Hunt, and relevant Reddit communities (r/firefox, r/productivity, r/PKMS)

---

### Phase 3 — Cloud Sync (Monetization unlock)

**Goal**: Annotations sync across devices. Introduction of paid tier.

**Deliverables**:
- Backend API (auth, annotation sync, conflict resolution)
- RemoteAdapter in extension
- Sync status UI in extension
- Account creation + subscription (Stripe or Paddle)
- Free tier: local-only (unchanged)
- Paid tier (~$5-8/month or ~$40/year): sync, future sharing features

**Publication**:
- Announce sync as a new feature via in-extension notification (first sync prompt)
- Update store listings and landing page
- Consider Product Hunt relaunch for the sync release

---

### Phase 4 — Integrations & Growth (post-monetization)

**Deliverables**:
- Export to Markdown, Notion, Obsidian, PDF
- Read-only shareable annotation links
- Safari extension (significant effort — evaluate based on demand)
- API for power users / developers

**Publication**:
- Each integration announced separately (Notion integration = Notion community post, etc.)
- Evaluate open-sourcing the extension layer to grow community contributions

---

## Testing Decisions

**Philosophy**: Test external behavior only — what the user observes — not internal implementation details. Tests should be robust to refactors of internal structure.

**Modules to test:**

| Module | Test type | What to assert |
|--------|-----------|----------------|
| URL Normalizer | Unit | Given input URL → expected canonical URL output; tracking param stripping; hash-route detection edge cases |
| Storage Adapter | Integration | CRUD operations persist and retrieve correctly; LocalAdapter and RemoteAdapter satisfy the same interface contract |
| Canvas Engine | Integration (headless browser) | Placing, moving, resizing, deleting objects; undo/redo stack correctness; multi-select behavior |
| Keyboard Manager | Unit | Shortcut dispatch fires correct events; remapped shortcuts override defaults |
| Dashboard search/filter | Integration | Querying annotated URLs returns correct, sorted, filtered results |

**What not to test**: Internal canvas rendering details, React component internals, exact pixel positions. Test that "a sticky note placed at position X can be retrieved from storage at position X", not how it is rendered.

---

## Out of Scope

- Real-time collaboration / multiplayer annotations
- Mobile browser support (iOS/Android)
- Safari extension (v1)
- Annotation of PDF files (browser-rendered or native)
- AI-powered annotation suggestions or summarization
- Auto-disabling on sensitive/banking domains
- Per-domain annotation visibility controls
- Public annotation feeds / social features
- Video / media timestamped annotations

---

## Further Notes

- **Privacy first**: In v1, zero data leaves the user's machine. This should be a core brand value and clearly communicated at install time.
- **Performance**: The canvas overlay must not degrade page performance. The content script should be as lazy as possible — mount the canvas only when annotation mode is activated or when an annotated page is loaded.
- **Extension size**: MV3 has stricter constraints. Keep the bundle lean; avoid heavy dependencies in the content script.
- **Accessibility**: Keyboard-first design helps, but full WCAG 2.1 AA compliance for the annotation UI is a stretch goal post-v1.
- **Naming inspiration**: "Marginalia" historically refers to notes, scribbles, and illuminations made in the margins of manuscripts. The brand should evoke that sense of thoughtful, personal annotation layered over shared knowledge.
