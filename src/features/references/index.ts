// ── Phase 4: ID and Reference Graph Engine ────────────────────────────────────
//
// Public API for the reference graph subsystem.
// Consumers should import from this barrel rather than the internal modules.

// ── ID Registry ───────────────────────────────────────────────────────────────
export type { IdRegistryEntry, IdRegistry } from './idRegistry'
export { buildIdRegistry, rebuildDocIdRegistry, generateUniqueId } from './idRegistry'

// ── Reference Graph ───────────────────────────────────────────────────────────
export type { ReferenceSlot, ReferenceEdge, ReferenceGraph } from './referenceGraph'
export { buildReferenceGraph, stripFragmentPrefix } from './referenceGraph'

// ── Reference Queries ─────────────────────────────────────────────────────────
export type { DeletionSafety, CircularRefChain } from './referenceQueries'
export {
  findReferencesTo,
  findReferencesFrom,
  isReferenced,
  getBrokenReferences,
  getOrphanedResources,
  canSafelyDelete,
  detectCircularRefs,
  getReferenceCount,
  buildReferenceCountMap,
} from './referenceQueries'

// ── Rename (atomic id rename) ─────────────────────────────────────────────────
export type { RenameIdOptions, RenameIdResult } from './renameResourceCommand'
export { renameId } from './renameResourceCommand'

// ── Commands (undo-safe EditorCommand wrappers) ───────────────────────────────
export type { RelinkReferencePayload } from './referenceCommands'
export {
  renameIdCommand,
  relinkReferenceCommand,
  relinkDocumentSlot,
  removeOrphanedResourcesCommand,
} from './referenceCommands'

// ── Repair Utilities ──────────────────────────────────────────────────────────
export type { RepairResult, BulkRepairResult } from './repairReferences'
export {
  findBrokenReferences,
  repairBrokenRefByFuzzyMatch,
  repairAllBrokenReferences,
  repairAllBrokenReferencesCommand,
} from './repairReferences'
