# Mobile SVG Editor

A mobile-first personal SVG editor built with React, TypeScript, Vite, Zustand, and Dexie.

This repository is no longer just a tiny starter. It already contains a working editor shell, document persistence, object selection and transforms, grouping, a layers drawer, an inspector drawer, path conversion/editing, boolean operations, and a growing document model for resources and exports.

At the same time, it is still mid-build. Several tools are present in the UI or the data model before their workflows are fully wired. That is intentional for this repo.

This README describes the repo as it actually exists right now, not as a stripped-down public product. The goal is **not** to remove unfinished tools or dependencies. The goal is to **finish and upgrade them**, preferably by leaning on existing dependencies instead of adding unnecessary custom code.

## Current philosophy

- This is a **personal workflow tool**, not a polished general-purpose editor yet.
- Broad capability is allowed to exist before every part is production-ready.
- UI surfaces that look ahead of the implementation should generally be **completed**, not deleted.
- The dependency list is intentionally large. Most future upgrades should prefer **wiring in the libraries already present** instead of hand-rolling more geometry, export, storage, or UI systems.

## What is currently working

### App shell and persistence

- Single-page editor app rendered from `EditorPage`
- Top bar, bottom mode bar, context action strip, layers drawer, inspector drawer
- Dexie-backed document storage
- Automatic bootstrap of the most recent document or a fresh document when none exists
- Manual save and new document actions
- GitHub Pages deployment workflow
- PWA plugin configured in Vite

### Canvas and navigation

- SVG canvas rendering through `CanvasArtworkLayer`
- ViewBox-driven zoom and pan
- Wheel zoom
- Button zoom controls
- Two-finger pinch zoom
- Navigate mode for panning

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

### Tests

There are tests for:

- document grouping / ungrouping
- move / resize / rotate document mutations
- path conversion
- path parsing / serialization
- path operations
- node bounds

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

- `src/pages/export/ExportPage.tsx`
- `src/pages/home/HomePage.tsx`
- `src/pages/inspect/InspectPage.tsx`
- `src/pages/settings/SettingsPage.tsx`

These pages currently exist as placeholders and are not used by the router.

## Important reality check

The codebase is ahead of the README, but the implementation is still uneven.

There are three recurring patterns in the repo:

1. **Working features**: selection, transforms, grouping, inspector, persistence, path editing core
2. **Scaffolded features**: modes, pages, resource models, asset tables, export-related models
3. **Approximate math / temporary plumbing**: path bounds, transform folding, whole-document history, some root-only operations

That means the next work should focus on **finishing connections and replacing approximations**, not shrinking the project.

## Main issues that need addressing

## 1. README and product-state mismatch

The current README still presents the repo as a small foundation starter and understates what is already implemented.

Problems:

- it calls the repo a starter even though it already includes much more than that
- it lists text tool, richer inspector editing, code/inspect, and export as future work, while parts of those systems already exist in code
- it does not explain the current split between working tools, placeholder tools, and planned dependency-backed upgrades

Action:

- replace the current README with one that reflects the repo as a personal, actively expanding tool

## 2. Tool mode/UI mismatch

The bottom mode bar advertises more modes than the canvas interaction layer truly supports.

Current situation:

- `navigate` is functional
- `select` is functional
- `path` becomes active through path editing
- `shape` is shown as available, but shape creation is still primarily button-driven from the context strip rather than a true draw-on-canvas tool
- `pen` is shown as available, but there is no real pen drawing workflow wired into the canvas interactions yet
- `text`, `paint`, `structure`, and `inspect` are shown as unavailable even though some of their underlying pieces already exist elsewhere in the repo

Action:

- keep these tools visible if that suits the workflow
- turn them into real modes instead of cosmetic placeholders
- align bottom-bar status with actual editor capability

## 3. Text is partially implemented, not fully productized

Text support exists, but the full text-tool workflow does not.

What exists:

- `document.addText`
- text rendering on canvas
- text editing in inspector
- text font family and weight controls in inspector

What is missing or incomplete:

- dedicated text placement mode
- inline text editing on canvas
- richer typography controls
- text box resizing behavior
- alignment / baseline / multiline handling beyond a simple content field

Action:

- treat text as a real feature and finish the user flow around it

## 4. Pen/path editing plumbing is incomplete

Path editing exists, but some of the surrounding state and UI plumbing is unfinished.

Problems:

- path edit overlay manages selected points locally with `selectedPointIds`
- store-level `activePathPointIds` exists but is not meaningfully wired into the overlay workflow
- context-strip path actions use hardcoded `subpathIndex: 0` and `anchorIndex: 0`
- this means the strip actions are not truly acting on the currently selected point

Action:

- move point selection to shared editor state
- make path actions target the active selected anchor instead of a hardcoded first anchor
- finish multi-point and path-subpath aware editing behavior

## 5. Marquee and some selection logic only see root-level nodes

The editor can click-select nested nodes because rendering is recursive, but not every selection-related utility is recursive.

Problems:

- `collectSelectableNodes` only returns direct children of root
- marquee selection therefore ignores nested descendants inside groups
- path snapping candidate collection in `PathEditOverlay` also only iterates root children

Action:

- make selection and snap-candidate collection fully recursive
- ensure grouped/nested content behaves consistently across click, marquee, snapping, and future isolate mode

## 6. Structure operations are inconsistent across nesting levels

Some structure operations are recursive. Some still assume root-level nodes.

Most obvious issue:

- `duplicateNodesCommand` duplicates only nodes found directly in `root.children`
- nested nodes are not duplicated through the same general tree-aware approach used elsewhere

Other structure gaps:

- no explicit isolation / group-enter mode yet
- no drag-and-drop reordering in layers panel yet
- no stronger structure editing surface despite `structure` being part of the mode model

Action:

- make duplicate and other node operations tree-aware
- add isolation mode
- improve nested editing workflow

## 7. Transform math is still partly approximate

This is one of the biggest technical debt areas.

Current issues:

- ungroup transform folding explicitly notes that its general-case transform composition is approximate
- path bounds are approximate, especially for relative commands and arcs
- path translation/scaling is implemented by manual token parsing rather than a fuller transform-aware geometry pipeline
- resizing rotated shapes is still mostly axis-aligned box logic
- boolean operations flatten curves to sampled polygons and ignore stroke geometry

Action:

- replace approximation-heavy geometry where practical with dependency-backed math and parsing
- consider using existing libraries already in the repo for transform composition, bounds, or path normalization instead of extending custom token logic further

## 8. History is whole-document snapshot based

Current history behavior works, but it is not efficient for a larger editor.

Problems:

- commands clone full documents before and after
- change detection uses `JSON.stringify`
- undo/redo stores whole documents in memory
- move/resize/rotate operations also snapshot full documents

This is okay for a small personal editor, but it becomes expensive as documents, resources, and assets grow.

Action:

- keep the current system for now if it helps velocity
- eventually move toward patch-based or command-based history
- consider Dexie-backed snapshot persistence if history size starts becoming a real mobile issue

## 9. Many models and Dexie tables exist without UI workflows yet

The data model is ahead of the visible app.

Already modeled but not truly surfaced:

- snapshots table
- assets table
- gradients
- patterns
- filters
- markers
- symbols
- components
- text styles
- export slices
- document background and metadata fields
- per-document editor state beyond the basics

Action:

- do not remove these
- treat them as the next wave of editor capability
- add UI flows that progressively expose them instead of leaving them dormant

## 10. Several pages are placeholders only

These page files currently return simple placeholder content:

- home
- settings
- inspect
- export

At the same time, the router always sends the app straight to the editor page.

Action:

- either wire the router into a multi-page flow
- or keep these pages as parked placeholders but document that clearly

## 11. Some UI surfaces are still clearly placeholder quality

Examples:

- `CanvasUiOverlay` currently just displays a tiny “Canvas” badge
- top bar back button has no actual behavior attached
- no grid or guide overlay despite state fields existing for them
- no visible snap/grid controls beyond a simple snap toggle
- no export UI despite export-related models/pages existing
- no inspect/code panel despite that direction being implied by page names and mode names

Action:

- fill in the shell around the existing editor engine
- build real utility overlays, not just labels and placeholders

## 12. Shape/tool coverage is incomplete compared to the data model

The node model supports more than the current creation commands expose.

Examples:

- circle exists in the node model and render/bounds logic, but there is no add-circle command in the active UI
- polyline exists in the model but no active creation flow is exposed
- image exists in the model and renderer, but there is no asset/image import workflow yet
- symbol/use/clipPath/mask/marker appear in the broader node type list, but they are not part of the concrete `SvgNode` union that the active editor operates on

Action:

- decide which node types are truly active in the near term
- wire creation/import/editing flows for them
- keep future-facing types documented as scaffolding, not finished support

## 13. Dependency strategy is broader than actual usage

The dependency list is intentionally large, but only a small subset is currently used by the active code.

That is fine for this project, but it should be documented honestly.

Current reality:

- core runtime currently uses a small set of libraries heavily
- many declared packages are not yet imported anywhere in the active code
- package.json uses `latest` for a very large number of dependencies, while `package-lock.json` acts as the real current version freeze

Risks:

- reproducibility depends heavily on keeping the lockfile authoritative
- future lockfile refreshes could cause large upgrade jumps
- the dependency list looks more finished than the actual feature wiring

Action:

- keep the dependency-first strategy
- use the already-declared libraries to replace hand-written editor logic where they genuinely help
- be cautious with lockfile churn
- eventually pin critical packages more intentionally once the implementation stabilizes

## 14. Tests exist, but integration coverage is still thin

The test coverage is strongest in utility and document transformation layers.

Missing or light coverage areas:

- canvas gesture interactions
- layers drawer behavior
- inspector behavior
- mode switching
- path edit UI state
- Dexie bootstrapping flows
- GitHub Pages / PWA integration behavior

Action:

- keep the current low-level tests
- add integration tests around the editor flows that are most likely to regress on mobile

## 15. Some stored/editor state is defined but barely used

Examples:

- `inspectorSection`
- `activePathPointIds`
- `isolationRootId`
- `showGrid`
- `showGuides`
- `outlineMode`

This is not bad. It is a sign of a broader plan. But right now those states are ahead of their UI behavior.

Action:

- either wire them properly in the near term
- or explicitly treat them as staged scaffolding in documentation

## Practical next work order

## Phase 1: finish the tool truth layer

Goal: make the visible editor modes honest and functional.

Priority tasks:

- add real shape draw mode
- add real pen mode
- add real text placement/editing mode
- keep structure / inspect / paint in place, but begin wiring them instead of treating them as decorative future buttons

## Phase 2: fix selection and path plumbing

Goal: eliminate root-only and hardcoded editing behavior.

Priority tasks:

- recursive marquee selection
- recursive snap candidate collection
- store-backed path point selection
- remove hardcoded path action targeting
- add isolation-aware selection behavior for groups

## Phase 3: harden structure editing

Goal: make grouping and nesting reliable.

Priority tasks:

- recursive duplicate support
- better nested reorder operations
- isolation mode
- drag/drop or explicit move-in/out controls in layers panel

## Phase 4: replace approximation-heavy geometry

Goal: reduce the amount of fragile hand-written transform and path math.

Priority tasks:

- improve transform composition
- improve path bounds
- improve rotated resize behavior
- improve boolean fidelity where feasible
- evaluate existing declared dependencies before writing more custom math

## Phase 5: expose the dormant systems

Goal: bring the broader editor model into the actual app.

Priority tasks:

- export flows
- image/asset import
- resource editing for gradients/patterns/filters/text styles
- document metadata/background editing
- snapshots / history UI
- real inspect/code surfaces if still wanted

## Phase 6: strengthen reliability for mobile use

Goal: keep the editor usable as complexity rises.

Priority tasks:

- improve history efficiency
- add integration tests for gestures and transforms
- add more visible snapping/grid/guide feedback
- monitor performance on larger documents and path-heavy scenes

## Known strengths worth preserving

Even with the unfinished areas, the repo already has several strong foundations:

- clean command registry pattern
- persistent document bootstrapping
- good separation between document math and UI layers
- path editing architecture that is already genuinely useful
- grouped transform support that is beyond toy level
- a dependency-first direction that can speed up future upgrades if used carefully

## Summary

This repo is **not** a minimal starter anymore.
It is a **partially upgraded, partially scaffolded personal SVG editor** with a real working core and a lot of future capability already mapped into the codebase.

The right next move is **not** to simplify it by removing visible tools or reducing the dependency surface.
The right next move is to:

- finish the tool workflows that are already being signaled in the UI
- make selection/structure logic fully recursive and consistent
- reduce approximation-heavy math where it will become a maintenance trap
- gradually expose the broader resource/export/asset systems that the document model already anticipates

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
