# Mobile SVG Editor

A mobile-first SVG editor built with React, TypeScript, Vite, Zustand, and Dexie.

This repo is **not** a starter template and **not** a finished product. It already contains a real editor core with document persistence, canvas interaction, drawing tools, selection and transforms, path editing, gradients, export, settings, snapshots, and a document home screen. It also contains some broader systems that are only partially wired or still scaffolded.

This README describes the **current state of the repo as it exists now**, including what is working, what is partial, and what still needs to be done next.

---

## Current state at a glance

### What is real today

The repo currently includes:

- a working multi-page app: **Editor**, **Home**, **Export**, and **Settings**
- Dexie-backed document persistence and snapshot persistence
- a functional SVG editing canvas with pan, zoom, selection, transforms, and overlays
- shape drawing, pen/path creation, text placement, image import, grouping, alignment, distribution, path conversion, and boolean ops
- layers and inspector surfaces that are actively used by the editor
- SVG export with gradient serialization
- document settings for title, size, metadata, and background
- a mobile-oriented app shell with top bar, bottom mode bar, context action strip, side sheets, and canvas overlays

### What is partial or uneven

The repo also contains several systems that are only partly wired:

- the Dexie **assets table** exists, but there is no real asset library flow using it
- the broader **resource model** exists, but only gradients are meaningfully wired end to end
- document thumbnails on the Home page only render a small subset of node types

### What this means in practice

This is a working editor with a genuine core, not fake scaffolding. But it still has some painted doors:

- some data models are ahead of the UI and behavior (resource types, asset library)

---

## Implemented app flow

### Boot behavior

The app always starts on the **Editor page** — the `NavigationContext` (`src/app/routing/NavigationContext.tsx`) defaults to `'editor'`. During app initialization, `AppProviders` (`src/app/providers/AppProviders.tsx`) calls `useBootstrapDocument` (`src/features/workspace/hooks/useBootstrapDocument.ts`), which loads the most recent Dexie document or creates a new untitled one. The user navigates to the Home page manually via the back arrow in the top bar.

### Home page

`src/pages/home/HomePage.tsx`

The Home page is live and working.

It currently supports:

- listing up to 50 recent documents from Dexie
- creating a new document
- opening an existing document
- deleting a document (also deletes associated snapshots via `deleteDocument` in `src/db/dexie/queries.ts`)
- showing a lightweight thumbnail preview

Current limitation:

- thumbnails only render `rect`, `ellipse`, and `circle` nodes from the top-level children (up to 6 nodes). Groups, paths, text, images, polygons, stars, and transforms are not rendered. Gradient fills fall back to a default blue color.

### Editor page

`src/pages/editor/EditorPage.tsx`

The Editor page is the main active surface of the repo.

It currently renders:

- top bar (`src/components/layout/EditorTopBar.tsx`)
- canvas viewport (`src/features/canvas/components/CanvasViewport.tsx`)
- context action strip (`src/components/layout/ContextActionStrip.tsx`)
- bottom mode bar (`src/components/layout/EditorBottomBar.tsx`)
- layers panel (`src/features/layers/components/LayersPanel.tsx`)
- inspector sheet (`src/features/inspector/components/InspectorSheet.tsx`)

It also preloads Paper.js during idle time (via `requestIdleCallback` or a 2-second timeout fallback) so the first boolean operation does not trigger a blocking network fetch.

Only one settings value is applied at editor mount: `outlineModeDefault` is read from `settingsStore` and used to initialize the editor's outline mode via a `useEffect`.

### Export page

`src/pages/export/ExportPage.tsx`

The Export page is live and working.

It currently supports:

- serializing the current document to SVG via `serializeDocumentToSvg` (`src/features/export/svgSerializer.ts`)
- rendering a live visual preview of the SVG
- displaying a truncated SVG source preview
- downloading the SVG file
- copying SVG source to clipboard

### Settings page

`src/pages/settings/SettingsPage.tsx`

The Settings page is live and reachable from the editor top bar.

It currently exposes:

- default grid size (saved to `settingsStore` and also applied immediately to `editorStore`)
- snap threshold (saved to `settingsStore`, but **not** used by snapping logic — see Known gaps)
- angle snap degrees (saved to `settingsStore` and also applied immediately to `editorStore`)
- outline mode default (saved to `settingsStore` and read at editor boot)
- show guides toggle (directly mutates current `editorStore` view state, **not** saved to `settingsStore`)
- show grid toggle (directly mutates current `editorStore` view state, **not** saved to `settingsStore`)
- default export scale (saved to `settingsStore`, but **not** used by export flow — see Known gaps)
- destructive clear-all-documents action (deletes both `documents` and `snapshots` tables)

`settingsStore` (`src/stores/settingsStore.ts`) uses `zustand/persist` backed by **localStorage**, not Dexie.

Important current limitation:

some of these controls are **not fully wired** to actual runtime behavior. Details are documented below in **Known gaps / unwired elements**.

### Inspect page

`src/pages/inspect/InspectPage.tsx`

The standalone Inspect page exists and works as a read-only node inspector.

It can display:

- selected node type and ID
- geometry values (type-specific: x/y/width/height for rects, cx/cy/rx/ry for ellipses, etc.)
- style values (fill kind, stroke color and width, opacity)
- transform values
- computed bounds via `getNodeBounds` (`src/features/selection/utils/nodeBounds.ts`)
- raw path data for path nodes with copy button

Important current limitation:

- the page is reachable by the router (`src/app/routing/AppRouter.tsx`), but no code in the app ever calls `navigate('inspect')`
- the bottom-bar "Inspect" mode pins the inspector sheet open inside the editor — it does not navigate to this page

---

## Core features that are working now

## 1) Document persistence and bootstrapping

Core files:

- `src/db/dexie/db.ts` — Dexie schema: `documents`, `snapshots`, `assets` tables
- `src/db/dexie/queries.ts` — CRUD operations for documents and snapshots
- `src/features/workspace/hooks/useBootstrapDocument.ts` — opens most recent doc or creates a new one on app start

Current behavior:

- documents are saved in Dexie (`documents` table)
- snapshots are saved in Dexie (`snapshots` table)
- guides are persisted per-document in Dexie via `doc.editorState.guides` (written on guide add/move/remove in `editorStore`)
- on app load, the most recent document is opened if one exists
- if no document exists, a new untitled document is created automatically
- manual save is available from the editor top bar
- new document creation is available from both Home and Editor

## 2) Canvas navigation and view state

The canvas is composed of five layers (`src/features/canvas/components/CanvasViewport.tsx`):

- `CanvasArtworkLayer` — renders the document and handles all pointer/gesture interaction
- `CanvasGridLayer` — draws the grid overlay
- `CanvasGuidesLayer` — draws guides and handles ruler-strip drag-to-create
- `CanvasOverlayLayer` — selection handles, marquee box, path edit overlay
- `CanvasUiOverlay` — bottom-right pill controls: zoom display, grid toggle, guides toggle, snap toggle, outline mode toggle, and add-guide (+H/+V) buttons

The canvas supports:

- panning
- zooming (buttons, wheel, pinch gesture)
- zoom reset
- camera state in the store
- grid overlay
- guide overlay (guides are draggable; dragging off-canvas removes them)
- ruler-strip drag to create guides (8px strips along the top and left edges)
- snap toggle
- outline mode toggle
- zoom display overlay

## 3) Selection and transforms

The current editor supports:

- single selection
- multi-selection
- marquee selection
- selection from the layers panel
- moving selected nodes
- resizing selected nodes
- rotating selected nodes
- aspect ratio lock
- nested/group-aware selection behaviors
- isolation mode for group editing

## 4) Drawing and editing modes

Bottom-bar modes (`src/components/layout/EditorBottomBar.tsx`):

- Pan (`navigate`)
- Select (`select`)
- Shape (`shape`)
- Pen (`pen`)
- Text (`text`)
- Paint (`paint`)
- Structure (`structure`)
- Inspect (`inspect`)

There is also an internal **path** mode (`path`) used when editing path points directly. It is not a bottom-bar button; it activates when "Edit Path" is triggered and shows "Select" as active in the bottom bar. It is exited by clicking any other bottom-bar button.

These modes are not just cosmetic. The editor has working behavior behind them.

### Shape mode

Supports direct draw-on-canvas for:

- rectangle (`rect`)
- ellipse (`ellipse`)
- line (`line`)
- polygon (`polygon`)
- star (`star`)

Shape type is stored in `editorStore.ui.shapeType` (`src/stores/editorStore.ts`).

### Pen mode

Supports:

- placing anchors
- live preview while drawing
- closing a path by returning to the first anchor
- Done / Discard flow
- bezier handle dragging (drag at anchor placement to set control handles)
- snap support during handle work

In-progress pen paths are tracked in `editorStore.ui.penPathInProgress`. Leaving pen mode auto-discards any in-progress path.

### Text mode

Supports:

- placing text nodes directly on the canvas
- selecting existing text nodes in text mode
- jumping into typography editing flow

### Paint / Structure / Inspect modes

These modes open specific side surfaces rather than navigating to separate pages:

- **Paint**: pins the inspector open to the "appearance" section
- **Structure**: opens the layers panel
- **Inspect**: pins the inspector open to the "quick" section

## 5) Layers and inspector

The repo currently includes:

- recursive layers view (`src/features/layers/components/LayersPanel.tsx`)
- selection from layers
- lock control
- visibility control
- grouping and ungrouping support
- multi-selection batch editing
- appearance editing
- geometry editing for supported node types
- typography editing for text
- path-related editing tools
- gradient editing flow (`src/features/resources/components/GradientEditorSheet.tsx`)

Inspector sections are enumerated in `editorStore.ui.inspectorSection`: `quick`, `geometry`, `appearance`, `typography`, `path`, `arrange`, `svg`, `metadata`.

## 6) Path editing and boolean operations

The path system is one of the stronger parts of the repo.

Current capabilities include:

- converting supported shapes to paths (`src/features/path/utils/pathConversion.ts`)
- parsing and serializing path data (`src/features/path/utils/pathGeometry.ts`)
- path point editing (`src/features/path/components/PathEditOverlay.tsx`)
- segment point insertion
- point deletion
- point-type conversion
- open/closed path toggling
- snapping during path editing
- boolean union / subtract / intersect / exclude (`src/features/path/utils/booleanOps.ts`)

Boolean operations use **Paper.js** as the primary engine (curve-preserving, async dynamic import). If Paper.js fails or is unavailable, the fallback is **polygon-clipping**, which approximates curves as sampled polygons. The fallback produces correct topology but loses bezier curve fidelity.

## 7) Gradients

The resource system is only partly realized overall, but gradients are genuinely wired.

Current gradient support includes:

- creating linear and radial gradients
- editing stops (color, offset, opacity)
- applying gradients to selected nodes
- live canvas rendering
- correct SVG export through `<defs>` and `url(#id)` references (`src/features/export/svgSerializer.ts`)

Gradient definitions are stored in `doc.resources.gradients` (`src/model/resources/resourceTypes.ts`).

## 8) Images

Image import is accessible from the editor top bar (the image-plus icon).

Current behavior:

- select an image file from the device
- image is loaded as a data URL via `FileReader`
- image is auto-scaled to fit within 80% of the document dimensions
- image is centered and inserted into the canvas as an `ImageNode`
- image behaves as a selectable node

Important limitation:

- images are always embedded as base64 data URLs directly into the document; there is no asset library integration yet

## 9) Export

`src/features/export/svgSerializer.ts`

SVG export currently supports:

- document background (solid color)
- transforms (translate, rotate, scale, skew, pivot-based rotation)
- gradients (serialized to `<defs>`)
- text (font-family, font-size, font-weight)
- all drawable node types: rect, circle, ellipse, line, polyline, polygon, star (as polygon), path, image, group
- download flow
- copy-source flow

## 10) Snapshots and undo/redo history

Core files:

- `src/stores/historyStore.ts` — session undo/redo stack (capped at 50 entries)
- `src/features/snapshots/components/SnapshotsSheet.tsx` — named snapshot UI
- `src/db/dexie/queries.ts` — `saveSnapshot`, `listSnapshots`, `deleteSnapshot`

Current state:

- named snapshots can be saved with optional labels
- snapshots can be listed and restored
- snapshots can be deleted
- session undo/redo exists (both undo and redo write the restored document back to Dexie)
- the undo stack is capped at 50 entries to limit memory growth
- history labels are visible in the snapshot/history UI

---

## Known gaps / unwired elements

This section is the most important reality check in the repo.

## 1) Dexie `assets` table exists but is unused

File: `src/db/dexie/db.ts`

Current state:

- the schema defines an `assets` table with `kind: 'font' | 'image' | 'template' | 'library'`
- no active app flow reads from or writes to it
- image import embeds data URLs directly into the document (`href` field of `ImageNode`) rather than going through the asset table

Practical result:

- the repo has no true asset library despite the database scaffold

## 2) Broader resource model is ahead of implementation

File: `src/model/resources/resourceTypes.ts`

Current state:

- the model defines: `SwatchResource`, `GradientResource`, `PatternResource`, `FilterResource`, `MarkerResource`, `SymbolResource`, `ComponentResource`, `TextStyleResource`, `ExportSliceResource`
- only `GradientResource` is meaningfully wired end to end
- all other resource types are defined in the model but have no live UI or behavior

Practical result:

- the architecture suggests a bigger editor than the current product surface actually delivers

## 3) Home thumbnails are incomplete previews

File: `src/pages/home/HomePage.tsx`

Current state:

- thumbnails render only `rect`, `ellipse`, and `circle` at the top level (up to 6 nodes)
- paths, polygons, stars, lines, text, images, groups, and nested nodes all return `null`
- gradient fills fall back to a default blue (`#4f8ef7`)
- transforms are not applied
- the full SVG serializer (`src/features/export/svgSerializer.ts`) is not used here

Practical result:

- Home page previews are often blank or misleadingly simple for complex documents

---

## Testing status

The repo already contains meaningful tests, mostly around model, geometry, document operations, snapping, and history.

Current test files:

- `src/features/documents/services/documentCommands.test.ts`
- `src/features/documents/utils/documentMutations.test.ts`
- `src/features/path/utils/pathConversion.test.ts`
- `src/features/path/utils/pathGeometry.test.ts`
- `src/features/path/utils/pathOperations.test.ts`
- `src/features/path/utils/snapUtils.test.ts`
- `src/features/selection/utils/nodeBounds.test.ts`
- `src/stores/historyStore.test.ts`

What this means:

- core document/path math has better coverage than the UI layer
- store and geometry logic are in better shape than user-flow integration tests
- end-to-end and interaction coverage are still relatively light

---

## Repo structure overview

This is not a full file-by-file map, but it reflects the active architecture.

### App shell and routing

- `src/main.tsx`
- `src/app/App.tsx`
- `src/app/providers/AppProviders.tsx`
- `src/app/routing/AppRouter.tsx` — simple conditional render, not a URL-based router
- `src/app/routing/NavigationContext.tsx` — in-memory React state, default page: `'editor'`

### Pages

- `src/pages/home`
- `src/pages/editor`
- `src/pages/export`
- `src/pages/settings`
- `src/pages/inspect` — exists but is not navigated to from any active flow

### Core editor areas

- `src/features/canvas` — viewport layers: ArtworkLayer, GridLayer, GuidesLayer, OverlayLayer, UiOverlay
- `src/features/documents` — commands, mutations, document settings sheet
- `src/features/inspector` — inspector sheet and section panels
- `src/features/layers` — layers panel
- `src/features/path` — path edit overlay, boolean ops, snap utilities, path geometry/conversion
- `src/features/resources` — gradient editor sheet
- `src/features/selection` — node bounds utilities
- `src/features/workspace` — bootstrap hook
- `src/features/export` — SVG serializer
- `src/features/snapshots` — named snapshot sheet

### State and persistence

- `src/stores` — `editorStore` (Zustand + Immer), `historyStore`, `settingsStore` (persisted to localStorage)
- `src/db` — Dexie setup and query functions

### Data model

- `src/model/document` — `SvgDocument`, `documentTypes`, `documentFactory`
- `src/model/nodes` — `nodeTypes` (all SVG node shapes and appearance models)
- `src/model/resources` — `resourceTypes` (gradients, swatches, patterns, symbols, etc.)
- `src/model/view` — `viewTypes` (ViewState, SnapConfig, Guide)
- `src/model/history` — `historyTypes`
- `src/model/selection` — `selectionTypes`

### Layout and shared UI

- `src/components/layout` — EditorTopBar, EditorBottomBar, ContextActionStrip

---

## Running the project

```bash
npm install
npm run dev
npm run test
npm run build
```

The test runner is Vitest (`npm run test` runs `vitest run`). Build output uses Vite; the build script also runs `scripts/copy-pages-404.mjs` to support GitHub Pages SPA routing.

---

## Deployment

The repo includes GitHub Pages deployment workflow files in `.github/workflows/deploy-pages.yml`.

There is also a `.github/workflows/unzip-repo-final.yml` workflow for phone-oriented zip extraction for repo management.

---

## Phased work plan from the current state

This phased list is intentionally written from **where the repo is now**, not from an earlier roadmap.

## Phase 1 — fix misleading or half-wired settings ✓ COMPLETE

Goal: make the Settings page tell the truth.

Changes made:

- wired `snapThresholdPx` into snap calculations: `CanvasArtworkLayer.tsx` and `PathEditOverlay.tsx` now read `useSettingsStore.getState().snapThresholdPx` instead of a hardcoded `8`
- removed the "Default export scale" UI control from Settings (the store value is kept for Phase 5 when real scaled export lands)
- added `showGuidesByDefault` and `showGridByDefault` to `settingsStore` as true persisted settings
- Settings "Show guides by default" and "Show grid by default" toggles now persist to `settingsStore` and apply to the live editor
- editor boot now initializes grid size, angle snap, guide visibility, and grid visibility from `settingsStore` alongside the existing outline mode initialization
- removed the dormant `InspectPage` and its route; `AppPage` type no longer includes `'inspect'`

## Phase 2 — make previews honest ✓ COMPLETE

Goal: make Home page thumbnails reflect real documents.

Changes made:

- replaced the minimal thumbnail renderer in `src/pages/home/HomePage.tsx` with a `DocumentThumbnail` component
- `DocumentThumbnail` calls `serializeDocumentToSvg` from `src/features/export/svgSerializer.ts` with a shallow copy of the document truncated to the first 30 root children
- the XML declaration is stripped and the `<svg>` opening tag is rewritten to `width="40" height="40"` with `preserveAspectRatio="xMidYMid meet"` before injecting via `dangerouslySetInnerHTML`
- `useMemo` wraps the serialization so each document's SVG string is only recomputed when `doc` changes
- all node types (paths, groups, polygons, stars, text, images, lines) and transforms and gradients now render correctly in thumbnails
- `resources.gradients` is passed through unchanged so gradient `<defs>` resolve correctly for gradient-filled shapes

## Phase 3 — turn the asset and resource systems into real systems

Goal: either finish the asset pipeline and key resource types, or trim the unused scaffold.

Work to do:

**Asset system:**

- decide whether the Dexie `assets` table is staying (it currently defines `kind: 'font' | 'image' | 'template' | 'library'`)
- if staying, implement real CRUD and UI for reusable assets
- connect image import to the asset pipeline where appropriate instead of always embedding ad hoc data URLs directly into the document
- define how assets relate to persistence, export, and document portability
- if not near-term, remove or quarantine the unused table

**Resource model:**

- audit every resource type in `src/model/resources/resourceTypes.ts`: swatches, patterns, filters, markers, symbols, components, text styles, export slices
- decide which are near-term features versus long-term architecture
- complete a small number properly or trim the rest back for now
- likely next candidates after gradients: swatches, text styles, export slices

Why this phase matters:

the repo currently hints at a full-featured asset and resource library that does not yet exist. Either deliver it or trim the hint so the architecture matches the product.

## Phase 4 — strengthen UI integration testing

Goal: test real editing flows, not just the math engine under the hood.

Work to do:

- add integration tests for the editor's top bar, bottom bar, mode changes, and panels
- add interaction tests for shape draw, pen mode, text placement, layers selection, and inspector edits
- add tests for settings-driven behavior once Phase 1 is complete
- add tests around save/load/restore flows and snapshot restoration

Why this phase matters:

the current test suite protects core math fairly well, but user-flow regressions can still slip through the cracks.

## Phase 5 — improve export fidelity and production readiness

Goal: reduce the gap between editing fidelity and final output confidence.

Work to do:

- verify export fidelity across all supported node types and transforms
- decide whether raster export (via `@resvg/resvg-wasm` or `html-to-image`, both already in dependencies), scaled export, or PDF export (via `pdf-lib`, also in dependencies) belong in scope soon
- wire `defaultExportScale` if scaled export is added
- improve naming, metadata, and export ergonomics where needed
- audit performance and memory behavior on larger documents, especially mobile-heavy sessions

Why this phase matters:

an editor becomes much more believable once creation and export feel equally solid.

## Phase 6 — product polish and cleanup pass

Goal: reduce architectural noise and sharpen the repo for ongoing development.

Work to do:

- remove dead code and stale comments that no longer match reality
- review old roadmap text and repo docs for drift
- standardize wording between modes, sheets, pages, and route names
- tighten visual consistency across top bar, bottom bar, overlays, drawers, and secondary pages
- document what is intentionally local-only (localStorage) versus document-persisted (Dexie) versus future-synced
- confirm whether the `yjs` / `y-indexeddb` / `y-webrtc` / `y-websocket` dependencies in `package.json` are intended for a future collaboration feature and document accordingly

Why this phase matters:

this repo has a strong skeleton now. A cleanup pass will make it much easier to build on without accidental confusion.

---

## Recommended near-term priority order

If development resumes immediately, the best order is:

1. ~~Phase 1 — fix settings truthfulness and resolve the dormant Inspect page~~ ✓ Done
2. Phase 2 — improve Home previews
3. Phase 4 — add more integration tests in parallel as the above work lands
4. Phase 3 — decide the fate of the asset and resource systems
5. Phase 5 — export fidelity improvements

That sequence fixes the biggest "UI says one thing, code does another" problems first, then strengthens confidence before expanding the feature surface.

---

## Summary

This repo is already a substantial mobile SVG editor with a real editing core.

It is strongest today in:

- document persistence
- canvas interaction
- selection and transforms
- path editing
- gradients
- export
- snapshots/history

It is weakest today in:

- asset-library completion
- broader resource-system completion
- honest thumbnail previews

In plain English: the engine runs, the steering works, the dashboard works, and the remaining gaps are in the asset library and broader resource systems rather than the core editing experience.
