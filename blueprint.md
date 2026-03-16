# blueprint.md

# Mobile SVG Studio: Full SVG-Native Editor and Importer Blueprint

## Purpose
This blueprint defines the complete path for evolving the current repository from a shape-first mobile drawing app into a **full SVG-native, round-trip-safe, mobile-first editor/importer**.

The completed system must be able to:
- import many different SVG files from many ecosystems
- preserve fidelity during import, editing, and export
- visually render complex SVG accurately
- structurally edit nodes, defs, resources, and references
- provide full source-code editing for raw SVG
- preserve unsupported or partially supported content without silent destruction
- remain usable and performant on mobile

This document is written against the **current dependency list actually present in the repo**.

---

# 1. Current dependency inventory

## Existing runtime dependencies already in the repo
These are already present and should be reused heavily before adding new packages:

- **UI / interaction**
  - `react`
  - `react-dom`
  - `framer-motion`
  - `lucide-react`
  - `@radix-ui/*`
  - `vaul`
  - `@use-gesture/react`
  - `@dnd-kit/*`
  - `cmdk`
  - `react-aria`
  - `react-stately`

- **State / data / persistence**
  - `zustand`
  - `jotai`
  - `valtio`
  - `immer`
  - `dexie`
  - `dexie-react-hooks`
  - `idb`
  - `localforage`
  - `use-undo`
  - `deepmerge`
  - `mitt`
  - `memoize-one`
  - `fast-deep-equal`

- **Geometry / path / transforms / spatial**
  - `gl-matrix`
  - `transformation-matrix`
  - `svg-path-commander`
  - `svg-pathdata`
  - `bezier-js`
  - `paper`
  - `earcut`
  - `flatten-js`
  - `martinez-polygon-clipping`
  - `polygon-clipping`
  - `point-in-polygon`
  - `robust-predicates`
  - `simplify-js`
  - `kdbush`
  - `rbush`

- **SVG / XML / export / rendering**
  - `fast-xml-parser`
  - `xml-formatter`
  - `svgo`
  - `canvg`
  - `@svgdotjs/svg.js`
  - `@resvg/resvg-wasm`
  - `downloadjs`
  - `file-saver`
  - `browser-fs-access`
  - `html-to-image`

- **Text / fonts / assets**
  - `fontkit`
  - `opentype.js`
  - `webfontloader`
  - `mime`

- **Search / diff / utilities**
  - `diff-match-patch`
  - `fuse.js`
  - `flexsearch`
  - `lodash-es`
  - `nanoid`
  - `zod`
  - `prettier`
  - `prettier-plugin-xml`
  - `chroma-js`
  - `culori`
  - `tinycolor2`

- **Collaboration / compression / packaging**
  - `comlink`
  - `jszip`
  - `pako`
  - `yjs`
  - `y-indexeddb`
  - `y-webrtc`
  - `y-websocket`

- **Misc currently available**
  - `pdf-lib`
  - `roughjs`
  - `date-fns`

## Existing dev dependencies already in the repo
- `typescript`
- `vite`
- `@vitejs/plugin-react`
- `vitest`
- `@testing-library/react`
- `@testing-library/user-event`
- `happy-dom`
- `jsdom`
- `playwright`
- `@playwright/test`
- `msw`
- `@types/node`
- `@types/react`
- `@types/react-dom`
- `@types/bezier-js`

---

# 2. New dependencies to add

These are the only additions I recommend as part of the blueprint. Everything else should be built using the packages already in the repo.

## Runtime dependencies to add

### `css-tree`
**Why:** The current repo has XML parsing, but no serious CSS parser for `<style>` blocks, selector parsing, and stable CSS serialization. Full SVG editing needs this.

**Use for:**
- Phase 2 import of `<style>` blocks and selector parsing
- Phase 15 cascade/inheritance engine
- Phase 3 serialization of style blocks
- diagnostics for invalid CSS rules

### `@tanstack/react-virtual`
**Why:** Large scene trees, defs trees, source diagnostics, and search panels will get heavy on mobile. Current repo has no dedicated virtualization layer.

**Use for:**
- Phase 9 tree virtualization
- Phase 10 resource lists
- Phase 16 diagnostics lists
- large node/resource search results

## Dev dependencies to add

### `pixelmatch`
**Why:** Visual regression testing is essential for round-trip-safe SVG work. The repo already has Playwright and rendering tools, but needs pixel-level image comparison.

**Use for:**
- Phase 20 visual regression testing
- import → export render comparison
- renderer fidelity checks

### `fast-check`
**Why:** Property-based testing is very useful for transforms, ID/reference repair, serialization invariants, and parser edge cases.

**Use for:**
- Phase 20 parser/serializer invariants
- transform round-trip tests
- reference-graph safety tests

### `@types/diff-match-patch` *(only if TypeScript coverage is weak in current setup)*
**Why:** Optional convenience if current typing coverage is awkward in source-diff workflows.

**Use for:**
- Phase 7 source diff and review workflows

> Note: if the repo’s current TS setup already handles `diff-match-patch` acceptably, this can be skipped.

---

# 3. Dependency philosophy for this project

## Reuse first
The repo already has many powerful libraries. This blueprint intentionally avoids dependency sprawl.

## Add only for real gaps
New dependencies are only introduced where the current toolchain is genuinely missing a critical capability:
- CSS parsing
- virtualization
- visual regression testing
- property-based testing

## Avoid unnecessary overlap
Do **not** add alternate state managers, alternate XML parsers, alternate monaco wrappers, or alternate geometry stacks unless a later hard blocker proves they are needed.

---

# 4. Final product contract

The finished editor must guarantee:

1. **Never silently destroy imported information**
2. **Treat SVG as the native document language**
3. **Keep visual mode and source mode as equal citizens**
4. **Preserve references, defs, and unsupported content whenever possible**
5. **Remain usable on mobile**

---

# 5. Full phased blueprint with dependencies

---

## Phase 0. Project reset and architectural contract

### Goal
Lock the product direction as a full SVG-native editor, not a one-way drawing tool with import glued on.

### Deliverables
- architecture contract
- fidelity contract
- import/export preservation rules
- support matrix by feature depth
- visual/source sync rules
- serialization mode definitions
- editability-level policy

### Files to create
- `docs/architecture/svg-native-editor-blueprint.md`
- `docs/architecture/fidelity-contract.md`
- `docs/architecture/svg-support-matrix.md`
- `docs/architecture/source-visual-sync.md`

### Dependencies
**Use existing:**
- none required beyond repo toolchain

**New dependencies:**
- none

### Notes
This phase is documentation and design, but it is not optional. It prevents later architectural drift.

---

## Phase 1. Replace the core SVG model with a complete document model

### Goal
Upgrade the internal document schema so it can represent real imported SVG documents instead of only editor-native primitives.

### Existing files to refactor
- `src/model/nodes/nodeTypes.ts`
- `src/model/resources/resourceTypes.ts`
- `src/model/document/documentTypes.ts`
- `src/model/document/documentFactory.ts`
- related stores in `src/stores/*`

### Required node types
- `root`
- `defs`
- `group`
- `rect`
- `circle`
- `ellipse`
- `line`
- `polyline`
- `polygon`
- `path`
- `text`
- `tspan`
- `textPath`
- `image`
- `symbol`
- `use`
- `clipPath`
- `mask`
- `marker`
- `pattern`
- `foreignObject`
- `a`
- `switch`

### Required model upgrades
- full style model: specified, inherited, computed, raw
- full transform model: canonical list + matrix + editable decomposition
- text model for runs/tspans/textPath
- resource graph for gradients/patterns/filters/symbols/masks/clip paths/markers/style blocks
- document-level ID registry and reference graph metadata
- source-map and preservation metadata

### Dependencies
**Use existing:**
- `typescript`
- `zod` for schema validation of model payloads
- `immer` for immutable update ergonomics
- `zustand` and/or `jotai` depending on current store patterns
- `deepmerge`
- `nanoid`

**New dependencies:**
- none

### Notes
Current repo already has enough tooling for this. No new package is needed for the model layer.

---

## Phase 2. Build the loss-aware raw SVG DOM import engine

### Goal
Parse pasted or file-loaded SVG into the new document model while preserving unsupported content and references.

### New feature area
- `src/features/import/`

### Required files
- `svgParseDocument.ts`
- `svgParseNodes.ts`
- `svgParseResources.ts`
- `svgParseStyles.ts`
- `svgParseTransforms.ts`
- `svgParseText.ts`
- `svgParseFilters.ts`
- `svgParsePatterns.ts`
- `svgParseReferences.ts`
- `svgParseMetadata.ts`
- `svgImportDiagnostics.ts`
- `svgImportNormalize.ts`
- `svgImportPreservation.ts`
- `svgImportTypes.ts`
- `svgImportCommands.ts`
- `svgImport.test.ts`

### Import responsibilities
- XML parsing
- defs-first resource collection
- style parsing
- transform parsing
- element parsing
- reference resolution
- duplicate ID handling
- unsupported element preservation
- diagnostic generation
- source-span/source-map metadata where practical

### Dependencies
**Use existing:**
- `fast-xml-parser` for robust XML tokenization/parsing utilities where DOMParser alone is insufficient
- browser `DOMParser` for native XML DOM parsing in-app
- `zod` for parsed payload validation
- `gl-matrix` and `transformation-matrix` for transform handling
- `svg-pathdata` and `svg-path-commander` for path parsing/normalization
- `fontkit` and `opentype.js` later for advanced text/font metadata if needed during import
- `lodash-es` for parser utilities

**New dependencies:**
- `css-tree` for `<style>` block parsing, selector parsing, CSS validation, and serialization-friendly AST handling

### Notes
This is the first major place where the repo’s current dependency list has a true gap. XML is covered. CSS is not.

---

## Phase 3. Build the round-trip-safe serialization engine

### Goal
Serialize imported and edited SVG back to XML without wrecking structure, references, or unsupported content.

### Existing file to split/refactor
- `src/features/export/svgSerializer.ts`

### New serializer modules
- `svgSerializeNormalized.ts`
- `svgSerializeRoundTrip.ts`
- `svgSerializeResources.ts`
- `svgSerializeStyles.ts`
- `svgSerializeTransforms.ts`
- `svgSerializeText.ts`
- `svgSerializeUtils.ts`

### Responsibilities
- normalized export for editor-native docs
- minimal-diff round-trip export for imported docs
- preserve IDs and defs order where possible
- preserve raw unsupported elements/attributes when possible
- stable formatting and pretty print
- style block serialization

### Dependencies
**Use existing:**
- `prettier`
- `prettier-plugin-xml`
- `xml-formatter`
- `diff-match-patch` for minimal-diff and source review workflows
- `svgo` for optional cleanup mode only, not as default round-trip serializer
- `deepmerge`

**New dependencies:**
- `css-tree` for serializing/parsing structured style blocks safely

**Optional dev helper:**
- `@types/diff-match-patch` if TS coverage is poor

### Notes
Use `svgo` only as an explicit cleanup/optimization tool, not as the default output path for imported docs.

---

## Phase 4. Build the ID and reference graph engine

### Goal
Make references first-class and safe to manipulate.

### New subsystem
- `src/features/references/`

### Required files
- `idRegistry.ts`
- `referenceGraph.ts`
- `referenceQueries.ts`
- `referenceCommands.ts`
- `renameResourceCommand.ts`
- `repairReferences.ts`
- `referenceGraph.test.ts`

### Responsibilities
- unique ID registry
- reverse reference map
- safe rename operations
- duplicate ID repair metadata
- broken reference repair tools
- find usages and navigate usages

### Dependencies
**Use existing:**
- `nanoid`
- `zod`
- `immer`
- `fast-deep-equal`
- `lodash-es`

**New dependencies:**
- none

### Notes
No new dependency is needed here. This is primarily graph logic on top of the new model.

---

## Phase 5. Upgrade the renderer into a real SVG scene renderer

### Goal
Render complex imported SVG accurately enough that users can trust what they’re editing.

### Existing file to heavily refactor
- `src/features/canvas/components/CanvasArtworkLayer.tsx`

### New render modules
- `src/features/canvas/render/renderNode.ts`
- `renderStyle.ts`
- `renderText.ts`
- `renderResources.ts`
- `renderUse.ts`
- `renderMaskClip.ts`
- `renderFilters.ts`
- `renderPatterns.ts`
- `renderSelectionHandles.ts`

### Responsibilities
- full node rendering
- inherited/computed style resolution
- defs-aware rendering
- use/symbol rendering
- masks, clips, patterns, markers, filters
- text/tspan/textPath rendering
- fidelity-aware fallbacks for partially supported nodes
- cached bounds and cached computed style paths

### Dependencies
**Use existing:**
- `react`
- `gl-matrix`
- `transformation-matrix`
- `svg-path-commander`
- `svg-pathdata`
- `paper`
- `bezier-js`
- `flatten-js`
- `earcut`
- `canvg` for SVG raster/preview/fallback rendering workflows where useful
- `@resvg/resvg-wasm` for high-fidelity preview/render comparison workflows
- `memoize-one`
- `rbush` and `kdbush` for spatial indexing and selection acceleration
- `point-in-polygon`
- `robust-predicates`

**New dependencies:**
- none

### Notes
The current repo already has a strong rendering/geometry stack. The work here is architectural, not dependency-driven.

---

## Phase 6. Build complete import UX

### Goal
Make paste/import a first-class workflow.

### New UI files
- `src/features/import/components/ImportSvgSheet.tsx`
- `ImportDiagnosticsPanel.tsx`
- `ImportPreview.tsx`
- `ImportSummaryCard.tsx`

### Responsibilities
- paste SVG code
- open file from device
- import from clipboard
- preview before commit
- show diagnostics and editability summary
- import options for preservation vs normalization behaviors

### Dependencies
**Use existing:**
- `browser-fs-access`
- `file-saver`
- `downloadjs`
- `@radix-ui/react-dialog`
- `@radix-ui/react-tabs`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-tooltip`
- `vaul`
- `framer-motion`
- `lucide-react`
- `cmdk` for search/jump tooling if desired

**New dependencies:**
- none

### Notes
All required import UX primitives are already in the repo.

---

## Phase 7. Build source mode as a first-class editor

### Goal
Allow full raw SVG editing alongside the visual editor.

### New subsystem
- `src/features/source/`

### Required files
- `SourceEditorSheet.tsx`
- `sourceState.ts`
- `sourceCommands.ts`
- `sourceSync.ts`
- `sourceDiagnostics.ts`
- `sourceFormatting.ts`
- `sourceSelectionMap.ts`

### Responsibilities
- monaco-based SVG/XML editor
- syntax highlighting
- apply/revert/format
- diagnostics display
- source ↔ canvas selection sync
- source diff and change review helpers

### Dependencies
**Use existing:**
- `@monaco-editor/react`
- `monaco-editor`
- `prettier`
- `prettier-plugin-xml`
- `xml-formatter`
- `diff-match-patch`
- `@radix-ui/react-dialog`
- `@radix-ui/react-tabs`
- `@radix-ui/react-scroll-area`
- `zustand` or current store layer

**New dependencies:**
- none required

**Optional dev helper:**
- `@types/diff-match-patch` if needed

### Notes
The repo already has Monaco, so do not add another editor library.

---

## Phase 8. Rebuild the inspector into a complete structural editor

### Goal
Make the inspector the main control surface for editing imported SVG structure.

### Existing file to refactor
- `src/features/inspector/components/InspectorSheet.tsx`

### Inspector sections required
- Geometry
- Appearance
- Stroke
- Fill
- Transform
- Text
- References
- Effects
- Resource links
- Accessibility/metadata
- Advanced attributes
- Raw attributes
- Jump to source

### Dependencies
**Use existing:**
- `react`
- `@radix-ui/react-accordion`
- `@radix-ui/react-collapsible`
- `@radix-ui/react-separator`
- `@radix-ui/react-slider`
- `@radix-ui/react-switch`
- `@radix-ui/react-tabs`
- `@radix-ui/react-popover`
- `@radix-ui/react-tooltip`
- `lucide-react`
- `framer-motion`
- `chroma-js`
- `culori`
- `tinycolor2`
- current store layer

**New dependencies:**
- none

### Notes
No new inspector dependency is necessary. The repo already has the UI components it needs.

---

## Phase 9. Rebuild the layers panel into a document tree plus defs tree

### Goal
Expose the true SVG structure, not only visual layers.

### Existing file to refactor
- `src/features/layers/components/LayersPanel.tsx`

### Responsibilities
- scene tree
- defs/resources tree
- combined tree option
- node badges for warnings and support levels
- selection, rename, reorder, reveal, isolate, detach, jump-to-source
- search/filter for large docs

### Dependencies
**Use existing:**
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-context-menu`
- `cmdk`
- `framer-motion`
- `lucide-react`

**New dependencies:**
- `@tanstack/react-virtual` for virtualized rendering of large layer trees and defs trees

### Notes
This is a real performance gap in the current dependency list. Large imported SVG trees will need virtualization.

---

## Phase 10. Build a real resources and defs workspace

### Goal
Make defs/resources first-class, inspectable, editable entities.

### Existing seed to expand
- `src/features/resources/components/GradientEditorSheet.tsx`

### New editors
- `ResourcesPanel.tsx`
- `GradientEditorSheet.tsx`
- `FilterEditorSheet.tsx`
- `PatternEditorSheet.tsx`
- `MarkerEditorSheet.tsx`
- `MaskEditorSheet.tsx`
- `ClipPathEditorSheet.tsx`
- `SymbolEditorSheet.tsx`

### Responsibilities
- browse gradients, patterns, filters, symbols, markers, masks, clip paths, style blocks
- edit resource internals
- show usage counts and reverse links
- create, duplicate, rename, delete resources safely

### Dependencies
**Use existing:**
- `@radix-ui/react-tabs`
- `@radix-ui/react-accordion`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-slider`
- `@radix-ui/react-dialog`
- `lucide-react`
- `framer-motion`
- `chroma-js`
- `culori`
- `tinycolor2`
- `zustand` or current store layer

**New dependencies:**
- `@tanstack/react-virtual` for large resource lists and usage lists

### Notes
Use the same virtualization package from Phase 9 rather than introducing another list library.

---

## Phase 11. Build full `<use>` and symbol workflows

### Goal
Support one of the most important real-world SVG reuse systems properly.

### Responsibilities
- true `<use>` node model
- symbol editing
- instance editing
- jump between instance and definition
- detach instance to local geometry
- reference-safe overrides

### Dependencies
**Use existing:**
- `gl-matrix`
- `transformation-matrix`
- `immer`
- current reference graph subsystem

**New dependencies:**
- none

### Notes
This is mostly a model/reference/rendering workflow phase.

---

## Phase 12. Build mask, clip path, and marker systems

### Goal
Support common structural SVG features safely and editably.

### Responsibilities
- proper mask model/render/edit support
- proper clip-path model/render/edit support
- marker model/render/edit support
- reference-safe linking and editing

### Dependencies
**Use existing:**
- `gl-matrix`
- `transformation-matrix`
- `svg-path-commander`
- `svg-pathdata`
- `paper`
- `bezier-js`
- `point-in-polygon`
- `flatten-js`

**New dependencies:**
- none

### Notes
Existing geometry stack is sufficient.

---

## Phase 13. Build advanced text support

### Goal
Preserve and edit real SVG text instead of forcing outline conversion.

### Responsibilities
- text and tspan structure
- textPath support
- font-family / weight / baseline controls
- multi-run editing
- spacing and positioning controls
- source-aware fallbacks for edge cases

### Dependencies
**Use existing:**
- `fontkit`
- `opentype.js`
- `webfontloader`
- `react`
- current inspector/source systems

**New dependencies:**
- none

### Notes
The current repo already has strong font-related packages. Reuse them.

---

## Phase 14. Build full path and geometry editing for imported shapes

### Goal
Make imported geometry genuinely editable instead of just renderable.

### Existing strength area
- `src/features/path/*`

### Responsibilities
- anchor editing
- bezier handle editing
- primitive shape editing
- convert shape ↔ path workflows
- boolean tools
- simplify/smooth operations
- snapping and bounds improvements

### Dependencies
**Use existing:**
- `svg-path-commander`
- `svg-pathdata`
- `bezier-js`
- `paper`
- `flatten-js`
- `martinez-polygon-clipping`
- `polygon-clipping`
- `simplify-js`
- `earcut`
- `robust-predicates`
- `point-in-polygon`

**New dependencies:**
- none

### Notes
The repo is already well equipped for this phase.

---

## Phase 15. Build the computed style and inheritance engine

### Goal
Handle grouped, inherited, and stylesheet-driven SVG appearance correctly.

### New subsystem
- `src/features/styles/`

### Files
- `styleCascade.ts`
- `styleInheritance.ts`
- `computedStyleCache.ts`
- `styleCommands.ts`
- `styleParsing.ts`
- `styleSerialization.ts`

### Responsibilities
- specified vs inherited vs computed styles
- group inheritance behavior
- stylesheet parsing and selector matching
- style block preservation and editing
- inspector display of local/inherited/computed values

### Dependencies
**Use existing:**
- `memoize-one`
- `fast-deep-equal`
- `deepmerge`
- `lodash-es`
- `zod`

**New dependencies:**
- `css-tree` for CSS parsing, selector handling, validation, and serialization

### Notes
This is the second major place where `css-tree` earns its keep.

---

## Phase 16. Build diagnostics, repair tools, and trust features

### Goal
Make the editor safe, debuggable, and confidence-building.

### New subsystem
- `src/features/diagnostics/`

### Responsibilities
- parse errors and warnings
- unsupported feature inventory
- duplicate ID reporting
- broken reference detection
- repair actions
- trust badges such as “round-trip safe” or “preserved-only content present”

### Dependencies
**Use existing:**
- `zod`
- `fuse.js` or `flexsearch` for searchable diagnostics and docs
- `@radix-ui/react-dialog`
- `@radix-ui/react-tabs`
- `@radix-ui/react-scroll-area`
- `lucide-react`

**New dependencies:**
- `@tanstack/react-virtual` for large diagnostics lists in big documents

### Notes
This uses the same virtualization dependency already introduced in earlier UI-heavy phases.

---

## Phase 17. Expand the command system and history for all new SVG operations

### Goal
Everything must be undoable, reversible, and coherent.

### Existing area to expand
- `src/features/documents/services/*`
- history-related model/store files

### Responsibilities
- commands for import
- source apply/revert
- rename resource with ref updates
- relink refs
- detach use
- edit defs and filters
- repair operations
- raw attribute edits
- transform list edits
- stable undo/redo snapshots

### Dependencies
**Use existing:**
- `immer`
- `use-undo`
- `zustand` and/or current store layer
- `deepmerge`
- `fast-deep-equal`

**New dependencies:**
- none

### Notes
No new dependency is necessary if command boundaries are well designed.

---

## Phase 18. Rework persistence and storage for full SVG documents

### Goal
Persist large, complex SVG-native documents safely.

### Existing area to expand
- `src/db/dexie/*`

### Responsibilities
- store full model
- store raw imported source
- store diagnostics
- store source maps and import provenance
- store history snapshots
- schema migration support
- thumbnail/preview caching

### Dependencies
**Use existing:**
- `dexie`
- `dexie-react-hooks`
- `idb`
- `localforage`
- `jszip`
- `pako`
- `nanoid`

**New dependencies:**
- none

### Notes
The repo already has more than enough persistence tooling. Do not add another DB layer.

---

## Phase 19. Performance and scalability pass

### Goal
Keep the full editor usable on mobile with large and complex SVGs.

### Responsibilities
- computed-style caching
- bounds caching
- virtualized trees/lists
- memoized reference resolution
- selection acceleration
- throttled expensive previews
- worker offload where helpful
- reduced unnecessary panel re-renders

### Dependencies
**Use existing:**
- `memoize-one`
- `fast-deep-equal`
- `rbush`
- `kdbush`
- `comlink`
- `zustand` / current store layer
- `gl-matrix`
- `@resvg/resvg-wasm` where off-thread render comparison is useful

**New dependencies:**
- `@tanstack/react-virtual` reused for UI virtualization

### Notes
Leverage `comlink` before inventing a custom worker abstraction.

---

## Phase 20. Full testing matrix

### Goal
Make round-trip editing trustworthy.

### Required testing layers
- unit tests for parser/serializer/transforms/references/styles
- integration tests for import → edit → export
- source mode sync tests
- real SVG fixture corpus tests
- visual regression tests
- property-based tests for invariants

### Dependencies
**Use existing:**
- `vitest`
- `@testing-library/react`
- `@testing-library/user-event`
- `playwright`
- `@playwright/test`
- `happy-dom`
- `jsdom`
- `msw`
- `@resvg/resvg-wasm` for deterministic render baselines where useful

**New dependencies:**
- `pixelmatch` for image diff based visual regression testing
- `fast-check` for property-based tests around parser/serializer/transform/reference invariants

### Notes
This is a critical phase. Visual regression and invariant testing are not optional for a project like this.

---

## Phase 21. Final UX polish and workflow completion

### Goal
Make the finished editor feel streamlined and powerful rather than merely feature-complete.

### Responsibilities
- mobile gestures
- panel ergonomics
- better search and reveal flows
- breadcrumb navigation
- node/resource/source cross-jumps
- import summaries and trust affordances
- dense but readable information architecture
- keyboard handling for source mode on mobile

### Dependencies
**Use existing:**
- `framer-motion`
- `lucide-react`
- `cmdk`
- `@use-gesture/react`
- `@radix-ui/*`
- `vaul`
- `@tanstack/react-virtual` reused where long lists exist

**New dependencies:**
- none beyond what was already added earlier

### Notes
This phase should consume the tooling already introduced in prior phases rather than adding fresh packages late.

---

# 6. Dependency summary by status

## New runtime dependencies to add
```json
{
  "css-tree": "latest",
  "@tanstack/react-virtual": "latest"
}
```

## New dev dependencies to add
```json
{
  "pixelmatch": "latest",
  "fast-check": "latest"
}
```

## Optional dev dependency
```json
{
  "@types/diff-match-patch": "latest"
}
```

---

# 7. Why these additions are enough

## Why no new XML parser?
Because the repo already has:
- native browser `DOMParser`
- `fast-xml-parser`

That is enough.

## Why no new code editor dependency?
Because the repo already has:
- `@monaco-editor/react`
- `monaco-editor`

That is enough.

## Why no new geometry/path stack?
Because the repo already has an unusually strong one:
- `gl-matrix`
- `transformation-matrix`
- `svg-path-commander`
- `svg-pathdata`
- `paper`
- `bezier-js`
- `flatten-js`
- clipping libraries

That is enough.

## Why add `css-tree`?
Because full SVG editing without serious CSS handling becomes unreliable the moment imported files contain `<style>` blocks and selector-based styling.

## Why add `@tanstack/react-virtual`?
Because large SVG document trees and diagnostics lists will absolutely need virtualization on mobile.

## Why add `pixelmatch`?
Because visual regressions are one of the only reliable ways to verify renderer/serializer fidelity.

## Why add `fast-check`?
Because parser/serializer/reference/transform systems benefit massively from invariant testing.

---

# 8. Suggested implementation order

## Wave 1. Architectural truth layer
1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4

## Wave 2. Real usable core
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8
10. Phase 9
11. Phase 17
12. Phase 18

## Wave 3. Full SVG power systems
13. Phase 10
14. Phase 11
15. Phase 12
16. Phase 13
17. Phase 14
18. Phase 15
19. Phase 16

## Wave 4. Hardening and polish
20. Phase 19
21. Phase 20
22. Phase 21

---

# 9. Completion checklist

The blueprint is only complete when the editor can:

- import pasted or file-based SVG from many ecosystems
- preserve unsupported content rather than silently dropping it
- render imported docs with high fidelity
- edit shapes, paths, groups, text, gradients, defs, references, masks, clip paths, markers, filters, and symbols
- expose a usable source mode with diagnostics and formatting
- support safe undo/redo across advanced operations
- round-trip imported files with minimal destructive change
- persist complex documents locally
- perform acceptably on mobile
- pass parser, serializer, reference, and visual-regression test suites

---

# 10. Final note

This repository already has a strong toolkit. The challenge is not that the repo lacks raw horsepower. The challenge is that its current architecture is still biased toward **editor-native drawing with SVG export**, while the true product requires **SVG-native round-trip editing**.

This blueprint closes that gap without dependency bloat.

