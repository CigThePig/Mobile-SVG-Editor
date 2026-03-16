# Visual ↔ Source Mode Sync Contract

**Phase 0 deliverable.** This document defines the rules governing synchronization between the visual editor canvas and the raw SVG source editor. These rules apply to Phase 7 (source mode) implementation and all subsequent phases.

---

## Fundamental Principle

Visual mode and source mode are **equal citizens**. Neither is the canonical representation when both are active. The **last applied edit wins**, and the other mode is updated to reflect it.

There is no single truth store that is "the visual model" or "the source text". Both are views over the same underlying document model. The document model is the truth.

---

## Mode States

At any time, the editor is in one of the following sync states:

| State | Description |
|---|---|
| **Clean** | Visual and source are in sync. Document model, rendered canvas, and source text are all consistent. |
| **Visual-pending** | A visual edit has been applied to the document model but the source editor has not yet reflected it. |
| **Source-pending** | The source editor has unsaved changes that have not yet been applied to the document model. |
| **Conflict** | Both a visual edit and a source edit exist for the same node/region simultaneously. This should be prevented by UI design but must be handled if it occurs. |

The sync state must be displayed to the user (e.g., an indicator in the source editor toolbar).

---

## Sync Direction Rules

### When a visual edit is applied

1. The document model is updated immediately via a command.
2. The canvas re-renders from the updated model.
3. If source mode is open:
   - The source text is updated to reflect the change using a minimal diff (via `diff-match-patch`).
   - The source editor cursor position is preserved where possible.
   - The changed region is highlighted briefly in the source editor.
4. The sync state becomes **Clean**.
5. The history stack receives a command entry for the visual edit.

### When a source edit is applied (user clicks Apply or presses the apply shortcut)

1. The source text is parsed using the import engine (same pipeline as fresh import).
2. A full or partial document model update is computed from the parsed result.
3. Diagnostics are computed for the new content (broken references, unsupported elements, etc.).
4. The canvas re-renders from the updated model.
5. The sync state becomes **Clean**.
6. The history stack receives a command entry for the source apply operation.

### When a source edit is in progress (not yet applied)

1. The canvas is not updated.
2. The sync state is **Source-pending**.
3. A visual indicator shows that source has unapplied changes.
4. Visual editing operations are **blocked** while source is pending.
   - If the user attempts a visual edit while source is pending, they are prompted: "Apply or discard your source changes before editing visually."
5. The user may revert the source editor to the last applied model state without affecting the document model.

---

## Source Takes Precedence When

- The user explicitly applies source changes (Apply action).
- A source apply produces a document model that differs from what any in-progress visual edit would have produced.
- The source edit modifies structure that visual mode has no representation for (e.g., `<animate>` elements, custom namespace attributes, passthrough elements).

In all cases, after a source apply, the document model reflects the source output and the canvas re-renders accordingly. No visual-mode state is retained that contradicts the applied source.

---

## Visual Takes Precedence When

- A visual command is completed (transform applied, property changed, node added/deleted).
- The source editor is **Clean** (no unapplied changes).
- Source mode reflects the visual change via minimal diff update.

---

## Unsupported Content Passthrough Rule

This rule is critical and must be enforced:

> A visual edit to a node must never modify or destroy the `rawChildren` or `rawAttributes` of that node's preservation metadata, or of any sibling or ancestor node that the visual edit did not touch.

Specifically:
- Moving a node visually must not alter its preserved-raw children.
- Changing fill color of a node must not alter unsupported attributes on that node.
- Deleting a node through visual mode must still trigger the reference integrity check (see `fidelity-contract.md`).
- Source apply replaces the entire model subtree for affected nodes and recomputes preservation metadata from scratch.

---

## Conflict Detection and Resolution

A conflict occurs if a visual edit and a source edit exist for the same document region simultaneously. This should not happen under normal use because visual edits are blocked while source is pending. If it occurs despite this:

1. The source edit wins. Visual changes since the last clean sync are discarded.
2. The user is notified: "Your visual changes were discarded because source changes were applied. You can undo to recover them."
3. The history stack records the source apply as the canonical event.

This resolution is conservative in favor of the source editor because source edits may contain structural changes (reordered defs, new elements, removed elements) that visual-mode diffing cannot safely merge.

---

## Selection Synchronization

When source mode is open alongside visual mode:

- **Canvas → source**: Selecting a node on the canvas highlights its corresponding XML region in the source editor. The source editor scrolls to show the selected element.
- **Source → canvas**: Placing the cursor within an element's tag in the source editor selects that element on the canvas (if it is a selectable, non-passthrough element).
- **Preserved-raw nodes**: Can be selected in source only. Canvas selection does not extend to preserved-raw nodes. Clicking a preserved-raw node on the canvas (if rendered) opens source mode with the element focused.

The selection map between canvas node IDs and source character offsets is computed during import and updated after each source apply.

---

## Formatting Rules

- Source apply does **not** reformat the source on apply. The user's formatting is preserved.
- An explicit "Format" action (via `prettier` + `prettier-plugin-xml`) is available in the source editor toolbar. It formats the source text without applying it to the model.
- "Format and Apply" is a combined action available in the toolbar.
- Auto-format on apply is a user preference (default: off) to avoid unexpected reformatting of hand-authored SVG.

---

## History and Undo Behavior

- Visual edits and source applies both create entries in the command history.
- Undo of a visual edit reverts the model and updates source text via minimal diff.
- Undo of a source apply reverts the model to the pre-apply state and updates source text via minimal diff. It does **not** restore the in-progress source edit text that was discarded.
- Redo follows the same pattern as undo in reverse.

---

## Implementation Notes for Phase 7

- The sync state machine lives in `src/features/source/sourceState.ts`.
- Source apply uses the same import pipeline as the Phase 2 import engine. Do not write a separate parser.
- Minimal diff for canvas → source text updates uses `diff-match-patch` (already in the repo).
- The source editor uses Monaco (`@monaco-editor/react`, already in the repo). Do not add a different editor.
- Selection mapping data structure is defined in `src/features/source/sourceSelectionMap.ts`.
- The "block visual edits while source pending" enforcement lives in the command middleware layer, not in individual command handlers.
