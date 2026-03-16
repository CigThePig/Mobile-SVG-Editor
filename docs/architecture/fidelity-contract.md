# Fidelity and Preservation Contract

**Phase 0 deliverable.** This document defines the rules governing what must be preserved, what may be transformed, and what requires user-facing diagnostics during import and export.

---

## Preservation Requirements

### What must never be silently dropped

The following content must always survive import → edit → export unless the user explicitly requests removal:

- All element IDs (`id` attributes)
- All `xlink:href` and `href` references
- All `url(#...)` references in presentation attributes and style properties
- The `<defs>` block and its children (gradients, filters, masks, clip paths, symbols, patterns, markers, style blocks)
- All `<style>` elements and their text content
- Unsupported elements (e.g. `<animate>`, `<set>`, `<cursor>`, custom namespace elements)
- Unknown attributes on otherwise supported elements
- `xml:space`, `xml:lang`, `xml:base` and other `xml:` namespace attributes
- `xmlns:*` namespace declarations
- Processing instructions
- Comments (best-effort; must be preserved unless formatting explicitly discards them)
- `data-*` attributes
- `aria-*` attributes and `role` attributes

### What may be normalized during import (with diagnostics)

These transformations are permitted at import time but must emit a diagnostic entry:

- Duplicate ID repair: one element keeps its original ID; others are assigned new unique IDs. All references to the renamed IDs are updated.
- Relative URL normalization when a base URL is known
- Whitespace normalization within attribute values where SVG spec permits

### What may be normalized during normalized export (Mode A only)

When operating in Mode A (editor-native documents, see `svg-native-editor-blueprint.md`):

- Attribute order may change
- Defs order may change
- Redundant `style` attribute decomposition into presentation attributes (or vice versa, based on user setting)
- Pretty-printing via `prettier`

**None of these normalizations are permitted in round-trip export Mode B without explicit user opt-in.**

---

## Round-Trip Fidelity Tiers

Every import operation assigns the document a fidelity tier based on what was found during parsing:

### Tier 1 — Lossless round-trip

The document contains only fully supported elements and attributes. Export in Mode B will produce output that is semantically equivalent to the input with only whitespace/formatting differences.

Conditions for Tier 1:
- No unsupported elements
- No unsupported attributes on supported elements
- No duplicate IDs found (or all were successfully repaired)
- No broken references found (or all were successfully repaired)
- No CSS `<style>` blocks with selectors targeting unsupported pseudo-classes

### Tier 2 — Minimal-loss round-trip

The document contains some partially supported content. Export in Mode B will preserve all raw content but some editing operations may not fully reflect the preserved content in the visual view.

Conditions for Tier 2:
- One or more elements are at editability level Partial or Preserved-raw
- One or more `<filter>` primitives are rendered via fallback
- One or more CSS features are parsed and preserved but not reflected in the visual inspector

### Tier 3 — Partial-loss round-trip

The document contains content that cannot be preserved through the full edit cycle without potential structural degradation. The user must be warned before editing operations that could affect this content.

Conditions for Tier 3:
- Elements with editability level Display-only that are used as reference targets
- Deeply nested custom namespace elements with unknown semantics
- SVG documents with embedded foreign object content

---

## Diagnostic Requirements

A diagnostic entry must be emitted (and stored in document metadata) for each of the following events:

| Event | Diagnostic level |
|---|---|
| Duplicate ID found and repaired | Warning |
| ID renamed to avoid collision | Warning |
| Unsupported element encountered and preserved as raw | Info |
| Unsupported attribute preserved on known element | Info |
| Broken reference found (target ID not found in document) | Error |
| Broken reference repaired by finding closest match | Warning |
| `<filter>` primitive not supported for visual editing | Info |
| CSS selector not resolvable at import time | Warning |
| Round-trip fidelity tier downgraded | Warning |
| Content would be lost if exported in Mode A | Warning (shown before export) |

Diagnostics must be:
- Persisted with the document in storage
- Surfaced in the import summary UI
- Accessible in the diagnostics panel at any time post-import
- Never silently cleared without user action

---

## SVGO Policy

`svgo` is available in the repo but its use is tightly restricted:

- **Never** apply `svgo` automatically during import or round-trip export.
- **Never** apply `svgo` as part of the default save or autosave path for imported documents.
- `svgo` may be offered as an **explicit opt-in action** (e.g., "Optimize SVG" button in export settings) for editor-native Mode A documents.
- If `svgo` is applied, it must be treated as a **destructive operation** that clears the round-trip fidelity status and resets the document to Mode A (normalized export).
- The user must be shown a warning that includes: what will be changed, that the operation cannot be undone via undo history, and that round-trip safety will be lost.

---

## Preservation Metadata

Each document model node must carry import-time metadata that supports fidelity tracking:

```typescript
// Preservation metadata attached to each imported node
type PreservationMeta = {
  sourceElementName: string;       // Original SVG element tag
  editabilityLevel: 1 | 2 | 3 | 4; // See svg-native-editor-blueprint.md
  rawAttributes?: Record<string, string>; // Unknown attributes verbatim
  rawChildren?: string;            // Raw XML of unrecognized children
  sourceOffset?: number;           // Byte offset in source for source-map linking
  importDiagnosticIds?: string[];  // References to diagnostics emitted at import
};
```

This metadata must be:
- Stored in the document model alongside the node
- Serialized and persisted with the document
- Used by the serializer to reconstruct raw content during export
- Available to the inspector to show editability badges
- Never stripped by editing operations unless the user explicitly requests full normalization

---

## Reference Integrity Rules

The reference graph must enforce these invariants at all times:

1. An ID may not be deleted if any other node holds a `url(#id)` or `href="#id"` reference to it, unless the user is shown a warning and confirms the operation.
2. An ID rename operation must atomically update all reference holders.
3. A node with broken references must be flagged in the layers panel and inspector.
4. The reference graph must be recomputed after every import, paste, and source-mode apply.
5. Broken references must be reported in diagnostics and must never be silently deleted.
