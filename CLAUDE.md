# CLAUDE.md — Mobile SVG Studio

This file gives Claude Code context for working in this repository.

---

## Project Purpose

Transform Mobile SVG Editor from a shape-first drawing app into a **full SVG-native, round-trip-safe, mobile-first editor/importer**. The full specification lives in [`blueprint.md`](./blueprint.md).

---

## Development Commands

```bash
npm run dev        # Start development server (Vite)
npm run build      # TypeScript compile + Vite build + copy pages 404
npm run preview    # Preview production build
npm run test       # Run Vitest tests
```

---

## Architecture Contracts (Phase 0 outputs)

| Contract | File |
|---|---|
| Architectural direction | [`docs/architecture/svg-native-editor-blueprint.md`](./docs/architecture/svg-native-editor-blueprint.md) |
| Fidelity and preservation rules | [`docs/architecture/fidelity-contract.md`](./docs/architecture/fidelity-contract.md) |
| SVG feature support matrix | [`docs/architecture/svg-support-matrix.md`](./docs/architecture/svg-support-matrix.md) |
| Visual ↔ source sync rules | [`docs/architecture/source-visual-sync.md`](./docs/architecture/source-visual-sync.md) |

---

## Implementation Phase Tracker

Wave 1 — Architectural Truth Layer

| Phase | Title | Status |
|---|---|---|
| 0 | Project reset and architectural contract | ✅ Done |
| 1 | Replace the core SVG model with a complete document model | ⬜ Pending |
| 2 | Build the loss-aware raw SVG DOM import engine | ⬜ Pending |
| 3 | Build the round-trip-safe serialization engine | ⬜ Pending |
| 4 | Build the ID and reference graph engine | ⬜ Pending |

Wave 2 — Real Usable Core

| Phase | Title | Status |
|---|---|---|
| 5 | Upgrade the renderer into a real SVG scene renderer | ⬜ Pending |
| 6 | Build complete import UX | ⬜ Pending |
| 7 | Build source mode as a first-class editor | ⬜ Pending |
| 8 | Rebuild the inspector into a complete structural editor | ⬜ Pending |
| 9 | Rebuild the layers panel into a document tree plus defs tree | ⬜ Pending |
| 17 | Expand the command system and history for all new SVG operations | ⬜ Pending |
| 18 | Rework persistence and storage for full SVG documents | ⬜ Pending |

Wave 3 — Full SVG Power Systems

| Phase | Title | Status |
|---|---|---|
| 10 | Build a real resources and defs workspace | ⬜ Pending |
| 11 | Build full `<use>` and symbol workflows | ⬜ Pending |
| 12 | Build mask, clip path, and marker systems | ⬜ Pending |
| 13 | Build advanced text support | ⬜ Pending |
| 14 | Build full path and geometry editing for imported shapes | ⬜ Pending |
| 15 | Build the computed style and inheritance engine | ⬜ Pending |
| 16 | Build diagnostics, repair tools, and trust features | ⬜ Pending |

Wave 4 — Hardening and Polish

| Phase | Title | Status |
|---|---|---|
| 19 | Performance and scalability pass | ⬜ Pending |
| 20 | Full testing matrix | ⬜ Pending |
| 21 | Final UX polish and workflow completion | ⬜ Pending |

---

## Key Architectural Rules

These rules apply to every phase. Do not violate them.

1. **Never silently destroy imported information.** Unsupported elements and attributes must be preserved as raw content, not dropped.
2. **SVG is the native document language.** The internal model must represent real SVG, not editor-native primitives with SVG export bolted on.
3. **Visual mode and source mode are equal citizens.** Neither is the canonical representation when both are active.
4. **Reuse before adding.** The repo has a strong existing dependency set. Only add packages where a genuine gap exists (see `blueprint.md` section 2).
5. **`svgo` is an opt-in cleanup tool only.** Never use it as the default round-trip serialization path.
6. **All operations must be undoable.** Commands must integrate with the history/undo layer.
7. **Mobile usability is non-negotiable.** Virtualize heavy lists; avoid rendering bottlenecks.

---

## New Dependencies to Add (per blueprint)

These are not yet installed. Add them when the relevant phase begins.

| Package | Type | First needed |
|---|---|---|
| `css-tree` | runtime | Phase 2 |
| `@tanstack/react-virtual` | runtime | Phase 9 |
| `pixelmatch` | dev | Phase 20 |
| `fast-check` | dev | Phase 20 |
| `@types/diff-match-patch` | dev (optional) | Phase 7 |

---

## Source Layout

```
src/
  app/          Application setup (providers, routing, theme)
  components/   Shared UI components
  db/           Dexie-based persistence
  features/     Feature modules (canvas, documents, export, inspector, layers, path, resources, selection, snapshots, workspace)
  model/        Core data model (document, nodes, resources, history, selection, view)
  pages/        Page-level components (editor, export, home, settings)
  stores/       Zustand/Jotai/Valtio state stores
docs/
  architecture/ Phase 0 contract documents
```
