# Mobile SVG Editor

A mobile-first SVG editor built with React, TypeScript, Vite, Zustand, and Dexie.

This repo is **not** a starter template and **not** a finished product. It already contains a real editor core with document persistence, canvas interaction, drawing tools, selection and transforms, path editing, gradients, export, settings, snapshots, and a document home screen. It also contains some broader systems that are only partially wired or still scaffolded.

This README describes the **current state of the repo as it exists now**, including what is working, what is partial, and what still needs to be done next.

---

## Current state at a glance

### What is real today

The repo currently includes:

- a working multi-page app flow: **Home → Editor → Export → Settings**
- Dexie-backed document persistence and snapshot persistence
- a functional SVG editing canvas with pan, zoom, selection, transforms, and overlays
- shape drawing, pen/path creation, text placement, image import, grouping, alignment, distribution, path conversion, and boolean ops
- layers and inspector surfaces that are actively used by the editor
- SVG export with gradient serialization
- document settings for title, size, metadata, and background
- a mobile-oriented app shell with top bar, bottom mode bar, context action strip, side sheets, and canvas overlays

### What is partial or uneven

The repo also contains several systems that are only partly wired:

- the standalone **Inspect page** exists, but the editor never navigates to it
- the **Settings page** persists some preferences that do not yet fully drive runtime behavior
- the Dexie **assets table** exists, but there is no real asset library flow using it
- the broader **resource model** exists, but only gradients are meaningfully wired end to end
- document thumbnails on the Home page only render a small subset of node types

### What this means in practice

This is a working editor with a genuine core, not fake scaffolding. But it still has some painted doors:

- some settings save without fully affecting the editor
- some data models are ahead of the UI and behavior
- some supporting pages exist without being part of the main user flow

---

## Implemented app flow

### Home page

`src/pages/home/HomePage.tsx`

The Home page is live and working.

It currently supports:

- listing recent documents from Dexie
- creating a new document
- opening an existing document
- deleting a document
- deleting associated snapshots when a document is deleted
- showing a lightweight thumbnail preview

Current limitation:

- thumbnails only render a few basic node types and do **not** faithfully preview the full document

### Editor page

`src/pages/editor/EditorPage.tsx`

The Editor page is the main active surface of the repo.

It currently renders:

- top bar
- canvas viewport
- context action strip
- bottom mode bar
- layers panel
- inspector sheet

It also preloads Paper.js during idle time so the first boolean operation is less likely to stall.

### Export page

`src/pages/export/ExportPage.tsx`

The Export page is live and working.

It currently supports:

- serializing the current document to SVG
- downloading the SVG file
- copying SVG source to clipboard
- previewing the generated source

### Settings page

`src/pages/settings/SettingsPage.tsx`

The Settings page is live and reachable from the editor top bar.

It currently exposes:

- default grid size
- snap threshold
- angle snap
- outline mode default
- show guides toggle
- show grid toggle
- default export scale
- destructive clear-all-documents action

Important current limitation:

some of these controls are **not fully wired** to actual runtime behavior yet. Details are documented below in **Known gaps / unwired elements**.

### Inspect page

`src/pages/inspect/InspectPage.tsx`

The standalone Inspect page exists and works as a read-only node inspector.

It can display:

- selected node type and ID
- geometry values
- style values
- transform values
- computed bounds
- raw path data with copy button

Important current limitation:

- the page is reachable by the router, but the main editor flow never navigates to it
- the bottom-bar “Inspect” mode does **not** open this page; it opens the regular inspector workflow instead

---

## Core features that are working now

## 1) Document persistence and bootstrapping

Core files:

- `src/db/dexie/db.ts`
- `src/db/dexie/queries.ts`
- `src/features/workspace/hooks/useBootstrapDocument.ts`

Current behavior:

- documents are saved in Dexie
- snapshots are saved in Dexie
- on app load, the most recent document is opened if one exists
- if no document exists, a new untitled document is created automatically
- manual save is available from the editor top bar
- new document creation is available from both Home and Editor

## 2) Canvas navigation and view state

The canvas supports:

- panning
- zooming
- zoom reset
- wheel zoom
- pinch zoom
- camera state in the store
- grid overlay
- guide overlay
- snap toggle
- outline mode toggle
- zoom display overlay
- ruler-strip drag to create guides

The editor has a meaningful view-state system already in place.

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

Bottom-bar modes currently present:

- Pan
- Select
- Shape
- Pen
- Text
- Paint
- Structure
- Inspect

These modes are not just cosmetic. The editor has working behavior behind them.

### Shape mode

Supports direct draw-on-canvas for:

- rectangle
- ellipse
- line
- polygon
- star

### Pen mode

Supports:

- placing anchors
- live preview while drawing
- closing a path by returning to the first anchor
- Done / Discard flow
- bezier handle dragging
- snap support during handle work

### Text mode

Supports:

- placing text nodes directly on the canvas
- selecting existing text nodes in text mode
- jumping into typography editing flow

### Paint / Structure / Inspect modes

These are wired into the current editor workflow, primarily by opening or pinning the related side surfaces rather than sending the user to separate pages.

## 5) Layers and inspector

The repo currently includes:

- recursive layers view
- selection from layers
- lock control
- visibility control
- grouping and ungrouping support
- multi-selection batch editing
- appearance editing
- geometry editing for supported node types
- typography editing for text
- path-related editing tools
- gradient editing flow

## 6) Path editing and boolean operations

The path system is one of the stronger parts of the repo.

Current capabilities include:

- converting supported shapes to paths
- parsing and serializing path data
- path point editing
- segment point insertion
- point deletion
- point-type conversion
- open/closed path toggling
- snapping during path editing
- boolean union / subtract / intersect / exclude

Boolean operations use Paper.js as the primary engine, with fallback behavior retained when needed.

## 7) Gradients

The resource system is only partly realized overall, but gradients are genuinely wired.

Current gradient support includes:

- creating linear and radial gradients
- editing stops
- changing stop color, offset, and opacity
- applying gradients to selected nodes
- live canvas rendering
- correct SVG export through `<defs>` and `url(#id)` references

## 8) Images

Image import is working in the editor top bar.

Current behavior:

- select an image file from the device
- image is loaded as a data URL
- image is auto-scaled to fit roughly within the document
- image is centered and inserted into the canvas
- image behaves as a selectable node

Important limitation:

- this is document insertion, not a true reusable asset library flow

## 9) Export

SVG export currently supports:

- document background
- transforms
- gradients
- text
- multiple node types
- download flow
- copy-source flow

## 10) Snapshots and undo/redo history

Current state:

- named snapshots can be saved
- snapshots can be listed
- snapshots can be restored
- snapshots can be deleted
- session undo/redo exists
- the undo stack is capped to reduce runaway memory growth
- history labels are visible in the snapshot/history UI

---

## Known gaps / unwired elements

This section is the most important reality check in the repo.

## 1) The standalone Inspect page is not part of the real editing flow

Files:

- `src/pages/inspect/InspectPage.tsx`
- `src/app/routing/AppRouter.tsx`
- `src/app/routing/NavigationContext.tsx`

Current state:

- the router supports `inspect`
- the page itself works
- there are no actual `navigate('inspect')` calls in the app

Practical result:

- the standalone Inspect page is effectively dormant
- the bottom-bar Inspect mode is a different workflow from the standalone page

## 2) `snapThresholdPx` is persisted but not actually used by snapping logic

Files involved:

- `src/pages/settings/SettingsPage.tsx`
- `src/stores/settingsStore.ts`
- snapping logic in canvas/path features

Current state:

- the setting can be changed and saved
- snapping logic still uses hardcoded screen-space thresholds in the editor

Practical result:

- the UI suggests configurable snapping tolerance
- the real snapping behavior does not yet honor that value

## 3) `defaultExportScale` is saved but not used by export flow

Files involved:

- `src/pages/settings/SettingsPage.tsx`
- `src/stores/settingsStore.ts`

Current state:

- the setting is stored
- the export pipeline does not consume it

Practical result:

- this preference currently behaves like unfinished plumbing

## 4) Grid and guide “defaults” are not true persisted defaults

Files involved:

- `src/pages/settings/SettingsPage.tsx`
- `src/stores/editorStore.ts`
- `src/stores/settingsStore.ts`

Current state:

- Settings exposes “Show guides by default” and “Show grid by default”
- those toggles directly mutate the current editor view state
- they are not persisted in `settingsStore`
- editor boot still uses hardcoded defaults in `editorStore`

Practical result:

- these controls behave as current-session view toggles, not real defaults

## 5) Only `outlineModeDefault` is actually initialized from settings at editor boot

Files involved:

- `src/pages/editor/EditorPage.tsx`
- `src/stores/settingsStore.ts`
- `src/stores/editorStore.ts`

Current state:

- outline mode is initialized from settings on editor mount
- grid size and angle snap are still effectively hardcoded as editor boot defaults unless changed during the session

Practical result:

- settings support is uneven across different view preferences

## 6) Dexie `assets` table exists but is unused

Files:

- `src/db/dexie/db.ts`

Current state:

- the schema defines `assets`
- no active app flow reads from or writes to it

Practical result:

- the repo has no true asset library yet, despite the database scaffold

## 7) Broader resource model is ahead of implementation

Current state:

- the repo has a richer concept of resources than the live UI currently exposes
- gradients are wired
- other resource categories are not meaningfully completed end to end

Practical result:

- the architecture suggests a bigger editor than the current product surface actually delivers

## 8) Home thumbnails are incomplete previews

File:

- `src/pages/home/HomePage.tsx`

Current state:

- thumbnails only render a few simple node types
- they do not reuse the true document-to-SVG serializer or an equivalent preview pipeline

Practical result:

- Home page previews can be misleading for more complex documents

---

## Testing status

The repo already contains meaningful tests, mostly around model, geometry, document operations, snapping, and history.

Current test files include:

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
- `src/app/routing/AppRouter.tsx`
- `src/app/routing/NavigationContext.tsx`

### Pages

- `src/pages/home`
- `src/pages/editor`
- `src/pages/export`
- `src/pages/settings`
- `src/pages/inspect`

### Core editor areas

- `src/features/canvas`
- `src/features/documents`
- `src/features/inspector`
- `src/features/layers`
- `src/features/path`
- `src/features/selection`
- `src/features/workspace`
- `src/features/export`
- `src/features/snapshots`

### State and persistence

- `src/stores`
- `src/db`

### Data model

- `src/model`

### Layout and shared UI

- `src/components`

---

## Running the project

```bash
npm install
npm run dev
npm run test
npm run build
```

Build output uses Vite, and the build script also runs the GitHub Pages copy step from `scripts/copy-pages-404.mjs`.

---

## Deployment

The repo includes GitHub Pages deployment workflow files in `.github/workflows`.

This repo also appears to include phone-oriented zip extraction workflow support for repo management.

---

## Phased work plan from the current state

This phased list is intentionally written from **where the repo is now**, not from an earlier roadmap.

## Phase 1 — fix misleading or half-wired settings

Goal: make the Settings page tell the truth.

Work to do:

- wire `snapThresholdPx` into actual snap calculations used by the canvas and path editing flows
- wire `defaultExportScale` into the export flow or remove it until real export scaling exists
- decide whether “Show grid by default” and “Show guides by default” are real persisted settings or current-session toggles
- if they are real defaults, move them into `settingsStore` and initialize editor state from them on boot
- initialize grid size and angle snap from settings consistently rather than leaving boot defaults hardcoded in `editorStore`

Why this phase matters:

right now the Settings page overpromises. Fixing that removes confusion and makes the repo easier to trust.

## Phase 2 — resolve the inspect split

Goal: stop having two different inspect concepts drifting apart.

Work to do:

- decide whether the standalone `InspectPage` should be part of the real navigation flow
- if yes, add real navigation to it from the editor
- if no, remove it and fold any useful functionality back into the normal inspector sheet
- make sure bottom-bar “Inspect” means exactly one thing

Why this phase matters:

this is currently duplicated UX with only one version actually in the main flow.

## Phase 3 — make previews honest

Goal: make Home page thumbnails reflect real documents.

Work to do:

- replace the current minimal thumbnail renderer with a true preview pipeline
- ideally reuse the SVG serializer or a lightweight equivalent
- support more node types, gradients, transforms, text, images, and nested content
- verify that document previews still perform acceptably on mobile

Why this phase matters:

opening a document should not feel like opening a loot box with a fake cover image.

## Phase 4 — turn the asset system into a real system

Goal: either finish the asset pipeline or trim the unused scaffold.

Work to do:

- decide whether the Dexie `assets` table is staying
- if staying, implement real CRUD and UI for reusable assets such as images, templates, fonts, or libraries
- connect image import to the asset pipeline where appropriate instead of always embedding ad hoc data URLs directly into the document
- define how assets relate to persistence, export, and document portability
- if the asset system is not near-term, remove or clearly quarantine the unused table and model concepts

Why this phase matters:

the architecture currently hints at a reusable asset library that does not exist yet.

## Phase 5 — narrow or complete the broader resource model

Goal: make resource architecture match the product surface.

Work to do:

- audit every resource type currently defined in the model
- decide which are near-term features versus long-term architecture
- complete a small number properly or trim the rest back for now
- likely candidates after gradients: swatches, text styles, symbols/components, patterns, export slices

Why this phase matters:

right now the repo has “bigger editor” bones but not all the connective tissue.

## Phase 6 — strengthen UI integration testing

Goal: test real editing flows, not just the math engine under the hood.

Work to do:

- add integration tests for the editor’s top bar, bottom bar, mode changes, and panels
- add interaction tests for shape draw, pen mode, text placement, layers selection, and inspector edits
- add tests for settings-driven behavior once Phase 1 is complete
- add tests around save/load/restore flows and snapshot restoration

Why this phase matters:

the current test suite protects core behavior fairly well, but user-flow regressions can still slip through the cracks.

## Phase 7 — improve export fidelity and production readiness

Goal: reduce the gap between editing fidelity and final output confidence.

Work to do:

- verify export fidelity across all supported node types and transforms
- decide whether raster export, scaled export, or PDF export belong in scope soon
- improve naming, metadata, and export ergonomics where needed
- audit performance and memory behavior on larger documents, especially mobile-heavy sessions

Why this phase matters:

an editor becomes much more believable once creation and export feel equally solid.

## Phase 8 — product polish and cleanup pass

Goal: reduce architectural noise and sharpen the repo for ongoing development.

Work to do:

- remove dead code and stale comments that no longer match reality
- review old roadmap text and repo docs for drift
- standardize wording between modes, sheets, pages, and route names
- tighten visual consistency across top bar, bottom bar, overlays, drawers, and secondary pages
- document what is intentionally local-only versus document-persisted versus future-synced

Why this phase matters:

this repo has a strong skeleton now. A cleanup pass will make it much easier to build on without accidental confusion.

---

## Recommended near-term priority order

If development resumes immediately, the best order is:

1. Phase 1 — fix settings truthfulness
2. Phase 2 — resolve inspect duplication
3. Phase 3 — improve Home previews
4. Phase 4 — decide the fate of the asset system
5. Phase 6 — add more integration tests in parallel as the above work lands

That sequence fixes the biggest “UI says one thing, code does another” problems first.

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

- settings consistency
- dormant standalone inspect flow
- asset-library completion
- broader resource-system completion
- honest thumbnail previews

In plain English: the engine runs, the steering works, the dashboard mostly works, and a few buttons still light up without being connected to anything important.
