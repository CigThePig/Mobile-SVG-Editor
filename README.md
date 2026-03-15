# Mobile SVG Editor

A mobile-first personal SVG editor built with React, TypeScript, Vite, Zustand, and Dexie.

This is an actively expanding personal workflow tool, not a minimal starter or a polished public product. The codebase includes a working editor core, document persistence, object selection and transforms, grouping, a layers drawer, an inspector drawer, path conversion and editing, boolean operations, a growing document model for resources and exports — and as of Phase 1, a complete set of functional drawing and editing modes.

## Philosophy

- **Personal workflow tool**: broad capability is prioritized over polish at every surface.
- **Finish what the UI signals**: if a mode button exists, it does something real.
- **Dependency-first**: most future upgrades should prefer wiring in already-declared libraries instead of adding more hand-written geometry, export, or storage logic.
- **Honest scaffolding**: unfinished areas are documented clearly rather than hidden or deleted.

## What is currently working

### App shell and persistence

- Multi-page app: Home page (document list) → Editor → Export
- Top bar, bottom mode bar, context action strip, layers drawer, inspector drawer
- Dexie-backed document storage
- Automatic bootstrap of the most recent document or a fresh document when none exists
- Manual save and new document actions
- GitHub Pages deployment workflow
- PWA plugin configured in Vite

### Home page

- Lists all saved documents with live SVG thumbnails
- Create new document, open existing, delete (also cleans up snapshots)
- Back button in the editor returns to the home page

### Export

- SVG serialization: all node types, transforms, gradient fills, background, text
- Download `.svg` file or copy SVG source to clipboard
- Gradient resources serialized into `<defs>` block
- Source preview in the export page

### Image import

- Import any image file from device (JPEG, PNG, GIF, WebP, SVG…)
- Auto-scales to fit within 80% of the canvas, centres the result
- Embedded as base64 data URL directly in the document
- Selectable, moveable, resizable like any other node

### Gradient editor

- Create linear and radial gradients from the Inspector → Gradients panel
- Edit stops: colour, offset (%), opacity
- Add or remove stops (minimum 2 retained)
- Apply gradient to fill of any selected node(s)
- Gradient renders live on canvas and exports correctly in SVG

### Document settings

- Tap the document title in the top bar to open Document Settings
- Rename document, resize canvas (width × height), set background (transparent or solid colour)
- Edit metadata: description and author

### Snapshots and history

- Save named snapshots at any time from the History panel (top bar clock icon)
- List snapshots most-recent first; restore any snapshot (replaces document and clears undo history)
- Delete individual snapshots
- Session history log shows the current undo stack labels
- Undo stack capped at 50 entries to bound memory use

### Canvas and navigation

- SVG canvas rendering through `CanvasArtworkLayer`
- ViewBox-driven zoom and pan
- Wheel zoom
- Button zoom controls
- Two-finger pinch zoom
- Navigate mode for panning
- Zoom percentage display in the canvas overlay (bottom-right)
- Grid overlay toggled from the canvas overlay (shows at the configured grid size)
- Snap toggle button in the canvas overlay with visual on/off state
- Snap candidate indicators (subtle dots at corners, edges, and centers of non-selected nodes when snap is enabled)

### Object selection and transforms

- Tap selection on canvas
- Additive multi-select toggle
- Selection from the layers panel
- Marquee selection on empty canvas in select mode
- Single-selection bounds box
- Multi-selection combined bounds box
- Drag selected objects
- Resize selected objects
- Rotate selected objects
- Aspect ratio lock toggle
- Rotation snapping to 15 degrees when shift is held

### Document editing commands

- Add rectangle
- Add ellipse
- Add line
- Add polygon
- Add star
- Add text
- Delete selected nodes
- Duplicate selected nodes
- Reorder selected node
- Toggle visibility
- Toggle locking
- Group selection
- Ungroup selection
- Align selected nodes
- Distribute selected nodes

### Shape draw mode

- Switch to Shape mode and drag on canvas to draw a shape directly
- Shape sub-type selector in context strip: Rect, Ellipse, Line, Polygon, Star
- Ghost preview during drag
- Auto-returns to select mode after commit so the shape can be moved or resized immediately

### Pen mode

- Switch to Pen mode and click to place corner anchor points
- Live preview line from last anchor to cursor
- Green ring on the first anchor signals that clicking it will close the path
- Click near the first anchor to close and commit the path
- Done button commits an open path; Discard button discards it
- Committed paths are added to the undo history in a single step
- Switching to another mode while pen is active discards the in-progress path

### Text placement mode

- Switch to Text mode and tap the canvas to place a text node at that position
- Auto-selects the new node and opens the Typography inspector section
- Tapping an existing text node in text mode selects it and opens Typography
- Auto-returns to select mode after placement

### Path features

- Convert supported shapes to path
- Path parsing and serialization
- Path edit overlay with anchor and handle dragging
- Add point on segment
- Delete point
- Convert point type
- Toggle open/closed subpath
- Boolean union / subtract / intersect / exclude
- Snapping support during path editing

### Inspector and layers

- Recursive layers drawer for nested groups
- Selection from layers drawer
- Lock and visibility controls from layers drawer
- Inspector for single selection
- Inspector for multi-selection batch style changes
- Basic style editing for fill, stroke, opacity
- Node-specific editing for rect, ellipse, star, and text

### Mode bar — all modes are now wired

The bottom mode bar has eight modes. As of Phase 1, all are functional:

| Mode | What it does |
|---|---|
| Pan | Two-finger and drag panning |
| Select | Click/marquee selection, drag, resize, rotate |
| Shape | Draw-on-canvas with sub-type selector |
| Pen | Click to place path points, Done/Discard in context strip |
| Text | Click canvas to place a text node |
| Paint | Opens appearance inspector, canvas selection still works |
| Structure | Opens layers panel, canvas selection still works |
| Inspect | Pins inspector open, canvas selection still works |

### Tests

There are tests for:

- document grouping / ungrouping
- move / resize / rotate document mutations
- path conversion
- path parsing / serialization
- path operations
- node bounds
- snap utilities (snapPoint, snapAngle, boundsToSnapCandidates, screenThresholdToDocSpace)
- history store (push/undo/redo, canUndo/canRedo, clear, 50-entry stack cap)

The repo has more test coverage in utility math and document operations than in UI integration.

## High-level architecture

### Actual active app path

- `src/main.tsx`
- `src/app/App.tsx`
- `src/app/providers/AppProviders.tsx`
- `src/app/routing/AppRouter.tsx`
- `src/pages/editor/EditorPage.tsx`

Right now the router always renders the editor page directly.

### Main active feature areas

- `src/features/canvas`
- `src/features/documents`
- `src/features/inspector`
- `src/features/layers`
- `src/features/path`
- `src/features/selection`
- `src/features/workspace`
- `src/stores`
- `src/db`

### Existing but mostly not wired into the active app flow

- `src/pages/inspect/InspectPage.tsx`
- `src/pages/settings/SettingsPage.tsx`

These pages currently exist as placeholders and are not used by the router.

`HomePage` and `ExportPage` are now fully implemented (see Phase 5).

## Important reality check

The codebase is ahead of the earlier README description, but the implementation is still uneven.

There are three recurring patterns in the repo:

1. **Working features**: selection, transforms, grouping, inspector, persistence, path editing core, shape draw, pen, text placement, all mode wiring, recursive marquee selection, store-backed path point selection, isolation-aware group selection
2. **Scaffolded features**: pages, resource models, asset tables, export-related models, structure/inspect/paint deeper workflows
3. **Approximate math / temporary plumbing**: path bounds, transform folding, whole-document history

## Remaining issues and future phases

### Phase 2: fix selection and path plumbing ✓ COMPLETE

Goal: eliminate root-only and hardcoded editing behavior.

- ✓ Recursive marquee selection — `collectSelectableNodes` now accepts an optional `isolationRootId` and returns children of the isolation root when in isolation mode
- ✓ Recursive snap candidate collection in path edit overlay — snap candidates now traverse the full document tree
- ✓ Store-backed path point selection — `activePathPointIds` in the store replaces the local `useState` in `PathEditOverlay`
- ✓ Remove hardcoded path action targeting — `ContextActionStrip` path-mode buttons now use the selected anchor's actual `subpathIndex`/`anchorIndex` and are disabled when no point is selected
- ✓ Isolation-aware selection behavior — double-tapping a group enters isolation mode (`isolationRootId`); marquee selection and tap-outside exit isolation mode

### Phase 3: harden structure editing ✓ COMPLETE

Goal: make grouping and nesting reliable.

- ✓ Recursive duplicate support — `duplicateNodesCommand` now uses `getParentInfo` to find nodes at any depth and inserts the clone in the correct parent
- ✓ Better nested reorder operations — `reorderInTree` already traverses the full tree; isolation breadcrumb in context strip makes the current editing scope clear
- ✓ Isolation mode visual indicator — non-isolated nodes dim to 20% opacity on canvas; "Exit Group" button appears in the context action strip while in isolation
- ✓ Explicit move-in/out controls in layers panel — "⬅" button on each nested node pops it out of its parent group; "⬇" button on group rows moves selected nodes into that group

### Phase 4: replace approximation-heavy geometry ✓ COMPLETE

Goal: reduce fragile hand-written transform and path math.

- ✓ Improved transform composition — `foldTransformIntoChild` now computes the correct world-space delta when ungrouping rotated/scaled groups, instead of naively adding the group's translation to the child's translation
- ✓ Exact path bounds — `approxPathBounds` arc handling replaced with `svg-path-commander`'s `getPathBBox()`, which correctly computes arc extrema and bezier extrema; `approxPathBounds` kept as fallback
- ✓ Rotated resize pivot sync — `resizeNode` now updates `pivotX/Y` to the node's new local centre after resize, preventing rotation drift when the shape is later rotated again
- ✓ Adaptive boolean sampling — bezier segments in `booleanOps` are now sampled proportionally to arc length via `bezier-js` (8–64 steps, ~1 per 4px), replacing the previous fixed 20-step approximation

### Phase 5: expose the dormant systems ✓ COMPLETE

Goal: bring the broader editor model into the actual app.

- ✓ Export flows — `serializeDocumentToSvg` serializes any document to a clean SVG string; ExportPage lets you download the file or copy the source; gradient resources are emitted as `<defs>`
- ✓ Image/asset import — `document.addImage` command inserts an `ImageNode`; top bar "Import Image" button reads a file, converts it to a base64 data URL, auto-scales to fit the canvas, and places it centred
- ✓ Resource editing for gradients — `GradientEditorSheet` lets you create linear/radial gradients, edit stops (colour, offset, opacity), and apply them to selected nodes; canvas and SVG export both render gradient fills via `url(#id)`
- ✓ Document metadata and background editing — `DocumentSettingsSheet` (tap the document title in the top bar) lets you rename the document, resize the canvas, change background (transparent or solid colour), and edit description/author metadata
- ✓ Snapshots and history UI — `SnapshotsSheet` (History button in top bar) lets you save named snapshots to Dexie, restore any snapshot, delete snapshots, and view the current session's undo history log
- ✓ Home page — `HomePage` lists all documents with live thumbnails, lets you open, delete, or create a new document; the Back button in the editor navigates home

### Phase 6: strengthen reliability for mobile use ✓ COMPLETE

Goal: keep the editor usable as complexity rises.

- ✓ History efficiency — undo stack now capped at 50 entries, preventing unbounded memory growth from whole-document snapshots
- ✓ Integration tests for snap utilities — `snapUtils.test.ts` covers snapPoint (grid, bbox, threshold, axis independence), snapAngle, boundsToSnapCandidates, and screenThresholdToDocSpace
- ✓ Integration tests for history store — `historyStore.test.ts` covers push/undo/redo, canUndo/canRedo, clear, and the 50-entry cap
- ✓ Grid overlay — `CanvasGridLayer` renders grid lines at configurable intervals when grid is enabled; toggled via the Grid button in the canvas overlay
- ✓ Snap candidate indicators — subtle dots at corners, edges, and centers of non-selected nodes are shown on canvas whenever snap is enabled in select/shape mode
- ✓ Canvas UI overlay — bottom-right overlay now shows live zoom %, a grid toggle button, and a snap toggle button with visual on/off states

### Phase 7: further polish and capability expansion ✓ COMPLETE

Goal: close remaining gaps in editing fidelity and export quality.

- ✓ Pen mode bezier handle drag — click-drag after placing an anchor sets symmetric bezier handles (h1/h2); tap-only still produces a corner anchor. Handle drag preview shown in orange on the canvas overlay.
- ✓ Curve-preserving boolean operations — Paper.js (dynamic import) replaces the polygon-clipping fallback as the primary boolean op engine; output now contains C (cubic bezier) segments rather than L-only polygons. Polygon-clipping is kept as an automatic fallback if Paper.js throws.
- ✓ Guides — horizontal and vertical draggable guide lines stored in view state; rendered via a new `CanvasGuidesLayer` (orange lines); draggable to reposition, drag off-canvas to delete; `+H`/`+V` add-guide buttons and a Guides visibility toggle added to the canvas UI overlay; snap-to-guide integrated into `snapUtils.snapPoint` (axis-restricted).
- ✓ Performance memoization — `selectedNodes`, `selectionBounds`, and `individualBounds` in `CanvasOverlayLayer` are now memoized with `useMemo`; grid line arrays in `CanvasGridLayer` are also memoized, preventing recomputation during drags that do not change selection or viewport.
- ✓ Settings page — real settings UI with snap/grid configuration, view toggles, export scale, and a destructive "clear all documents" action; backed by a persisted `settingsStore` (Zustand + localStorage). Accessible via the ⚙ button in the editor top bar.
- ✓ Inspect page — read-only property viewer showing the selected node's type, geometry, transform, computed bounds, and (for path nodes) the raw `d` string with a copy button. Accessible via router navigation.

### Phase 8: open issues and future work

- **Paper.js bundle size** — the lazy-loaded Paper.js chunk is ~360 KB (gzipped ~123 KB). The first boolean operation triggers a network fetch. Phase 8 should evaluate a WASM-based alternative (e.g. `@jscad/csg`) or offload Paper.js to a Web Worker to avoid blocking the main thread.
- **Pen handle drag + snap** — bezier handles set during pen anchor drag are not yet snapped to grid or guide positions. Phase 8 should thread `snapPoint` into the pen drag move handler so handles land on exact grid/guide coordinates.
- **Guide persistence** — guides live in `ViewState` (in-memory only) and are lost on page reload. Phase 8 should decide whether guides persist per-document (stored in `SvgDocument.editorState`) or globally (in `settingsStore`).
- **Ruler drag-to-create guides** — the current approach uses `+H`/`+V` buttons. A drag-from-ruler strip (8 px margin at the top/left of the canvas) would be more ergonomic on desktop and match Figma/Sketch convention. Phase 8 should add ruler strips to `CanvasViewport`.
- **Paper.js subtract chain semantics** — for 3+ nodes, subtract is implemented as a left-associative chain (`((A − B) − C)`). In some cases "first minus union-of-rest" is more intuitive. Phase 8 should let the user choose or standardize the behavior.
- **Settings not synced to IndexedDB** — `settingsStore` persists to `localStorage` (device-local). Phase 8 should decide whether settings should live alongside documents in Dexie for cross-browser sync.
- **Outline mode not wired to canvas** — `ViewState.outlineMode` is stored and toggled in settings but has no effect on `CanvasArtworkLayer` rendering. Phase 8 should wire it: when `outlineMode` is true, render all shapes as stroke-only with no fill.
- **Dead code in CanvasArtworkLayer** — `void points` at line ~562 (polygon command handler) is unreachable dead code. Phase 8 should clean it up.

## Current run commands

```bash
npm install
npm run dev
npm run test
npm run build
```

## Deployment

GitHub Pages workflow already exists in `.github/workflows/deploy-pages.yml`.

There is also a separate unzip workflow in `.github/workflows/unzip-repo-final.yml` used for the phone-based zip extraction workflow.
