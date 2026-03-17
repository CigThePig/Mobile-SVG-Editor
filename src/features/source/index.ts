/**
 * src/features/source/index.ts
 *
 * Public barrel export for the source editor feature (Phase 7).
 */

export { SourceEditorSheet } from './SourceEditorSheet'
export { useSourceStore } from './sourceState'
export type { SyncState } from './sourceState'
export { buildSelectionMap, findRangeForNodeId, findNodeIdAtOffset } from './sourceSelectionMap'
export type { SourceRange, SelectionMap } from './sourceSelectionMap'
export { updateSourceFromDocument, applySourceToDocument } from './sourceSync'
export { formatSvgSource } from './sourceFormatting'
export {
  applySourceCommand,
  revertSourceCommand,
  formatSourceCommand,
  formatAndApplySourceCommand,
} from './sourceCommands'
export { SourceDiagnosticsPanel } from './sourceDiagnostics'
