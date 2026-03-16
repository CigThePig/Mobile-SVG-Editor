# Architectural Direction Contract

**Phase 0 deliverable.** This document locks the product direction for Mobile SVG Studio and prevents architectural drift across all subsequent implementation phases.

---

## Product Direction Declaration

Mobile SVG Studio is a **full SVG-native, round-trip-safe, mobile-first editor and importer**.

It is **not** a shape-first drawing tool with SVG import glued on. The architecture must reflect this at every layer: the document model, the import engine, the serializer, the renderer, and the UI.

The internal document representation is SVG. SVG is the native format, not a target export format.

---

## Core Product Guarantees

These five guarantees are non-negotiable and apply to every phase of implementation:

1. **Never silently destroy imported information.**
   - Unsupported elements must be preserved as passthrough content.
   - Unsupported attributes must be preserved on the element.
   - If content cannot be preserved, a diagnostic must be emitted; it must never be dropped silently.

2. **Treat SVG as the native document language.**
   - The internal model must represent real SVG document structure, not editor-native primitives.
   - The `<defs>` block, reference graph, and element tree are all first-class model citizens.

3. **Keep visual mode and source mode as equal citizens.**
   - Visual editing and source editing must both produce valid, consistent document state.
   - Neither mode is authoritative by default; the last applied edit wins.
   - See `source-visual-sync.md` for the full sync contract.

4. **Preserve references, defs, and unsupported content whenever possible.**
   - `url(#id)` references must survive import, editing, and export.
   - `<defs>` content must be preserved in correct document order.
   - Unrecognized elements that are referenced must not be pruned.

5. **Remain usable on mobile.**
   - Heavy lists must be virtualized.
   - Rendering must not block interaction.
   - Performance is a correctness concern, not an optional polish concern.

---

## Editability Level Policy

Each node in the document is assigned an editability level. The editor must communicate this level to the user and enforce the appropriate behavior.

| Level | Name | Meaning |
|---|---|---|
| 1 | **Full** | All visual and structural properties are editable through the inspector and canvas. Round-trip export is safe. |
| 2 | **Partial** | Most properties are editable, but some attributes or behaviors may not survive round-trip without loss. Inspector shows warnings where relevant. |
| 3 | **Preserved-raw** | The element is recognized but not editable in visual mode. It is stored as raw XML and written back verbatim on export. Source mode can edit it. |
| 4 | **Display-only** | The element renders but cannot be selected or edited. It is preserved in the serialized output. |

The editability level of a node must be:
- Computed at import time based on the element type, attributes, and children.
- Surfaced in the layers panel as a badge or indicator.
- Surfaced in the inspector with a clear explanation.
- Respected by all command handlers — a preserved-raw node must not be mutated by visual editing operations.

---

## Serialization Mode Definitions

Two serialization modes exist. The mode is chosen per document at import time and stored in document metadata.

### Mode A: Normalized export

Used for **editor-native documents** (created from scratch in the editor, not imported from external SVG).

- Produces clean, consistently formatted SVG.
- May reorder defs, reformat attributes, normalize transforms.
- Uses `prettier` + `prettier-plugin-xml` for formatting.
- `svgo` may be offered as an **opt-in cleanup step** in this mode only.

### Mode B: Round-trip export

Used for **imported documents** (SVG files or pastes loaded from external sources).

- Preserves the original document structure as closely as possible.
- Minimizes diff against the original source.
- Preserves defs order, ID values, raw attributes, passthrough elements.
- Uses `diff-match-patch` to produce minimal-change output where possible.
- `svgo` is **never** applied automatically in this mode.
- Uses `prettier` for formatting only if the user explicitly requests it.

The active serialization mode is displayed in the document metadata panel and can be changed by the user (with appropriate warnings).

---

## Implementation Wave Scope Summary

### Wave 1 — Architectural Truth Layer (Phases 0–4)
Establish the contracts, model, import engine, serializer, and reference graph. Nothing in Wave 2+ can be reliable without this foundation.

### Wave 2 — Real Usable Core (Phases 5–9, 17–18)
Build a working editor loop: render, import UX, source mode, inspector, layers, commands, persistence.

### Wave 3 — Full SVG Power Systems (Phases 10–16)
Unlock the full SVG feature set: resources, use/symbols, masks/clips/markers, text, path editing, style cascade, diagnostics.

### Wave 4 — Hardening and Polish (Phases 19–21)
Performance, testing, and UX completeness.

---

## Phase Implementation Status

| Phase | Title | Status |
|---|---|---|
| Phase 0 | Project reset and architectural contract | ✅ Done |
| Phase 1 | Replace the core SVG model with a complete document model | ✅ Done |
| Phase 2 | Build the loss-aware raw SVG DOM import engine | ✅ Done |
| Phase 3 | Build the round-trip-safe serialization engine | ✅ Done |

### Phase 3 Implementation Notes (2026-03-16)

The round-trip-safe serialization engine has been implemented in `src/features/export/`:

**New modules:**
- `svgSerializeUtils.ts` — shared XML helpers, paint/stroke serialization, `localFragRef()` for href restoration
- `svgSerializeTransforms.ts` — `TransformModel` → SVG transform attribute string
- `svgSerializeText.ts` — text/tspan/textPath serialization with preservation-aware attribute emission
- `svgSerializeStyles.ts` — CSS style block serialization using css-tree for Mode A normalization
- `svgSerializeResources.ts` — gradient/filter (always raw XML)/pattern/marker serialization
- `svgSerializeNormalized.ts` — Mode A serializer with optional prettier formatting and svgo opt-in
- `svgSerializeRoundTrip.ts` — Mode B serializer with Level-3 node reconstruction and diff-match-patch support
- `index.ts` — unified `serializeSvgDocument(doc, opts?)` entry point

**Key behaviors:**
- `SvgDocument.sourceSvg` is now populated by the import engine for all imported documents (enables diff support)
- Mode A respects `doc.serializationMode === 'normalized'`; Mode B respects `'roundtrip'`
- Level-3 (Preserved-raw) nodes are reconstructed from `preservation.sourceElementName + rawAttributes + rawChildren`
- Filter resources always emit their `rawXml` verbatim
- Pattern/marker resources prefer `rawXml` if present, otherwise serialize children
- Namespace declarations from `doc.namespaces` are preserved on the SVG root in Mode B
- `localFragRef()` helper restores the `#` prefix that the import engine strips from local fragment IDs
- `svgSerializer.ts` remains as a backward-compatible shim with `serializeDocumentToSvg` alias

**Added dependency:** `css-tree` (runtime) — used for CSS normalization in Mode A style blocks

---

## What This Contract Prevents

- Building a model that can only represent editor-native shapes
- Adding SVG import as an afterthought that normalizes away structure
- Using `svgo` as the default output path for imported files
- Treating source mode as a "developer feature" rather than a peer editing surface
- Silently dropping `<filter>`, `<mask>`, `<symbol>`, or custom namespace elements
- Renaming IDs without updating all references
- Making the layers panel show only visual layers instead of the true document tree
