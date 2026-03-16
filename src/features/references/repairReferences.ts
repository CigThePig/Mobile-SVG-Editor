import type { SvgDocument } from '@/model/document/documentTypes'
import type { EditorCommand } from '@/features/documents/services/commands'
import { buildReferenceGraph, type ReferenceEdge } from './referenceGraph'
import { getBrokenReferences } from './referenceQueries'
import { relinkDocumentSlot } from './referenceCommands'

// ── Broken reference detection ────────────────────────────────────────────────

/**
 * Find all broken references in a document.
 * Shorthand for `getBrokenReferences(buildReferenceGraph(doc))`.
 *
 * A broken reference is a reference slot (e.g. `use href="#foo"`) whose
 * target id does not exist anywhere in the document.
 */
export function findBrokenReferences(doc: SvgDocument): ReferenceEdge[] {
  const graph = buildReferenceGraph(doc)
  return getBrokenReferences(graph)
}

// ── Fuzzy match repair ────────────────────────────────────────────────────────

/**
 * Result of a fuzzy-match repair attempt.
 */
export interface RepairResult {
  doc: SvgDocument
  repaired: boolean
  newTargetId?: string
}

/**
 * Try to repair a single broken reference by finding the closest existing id.
 *
 * Strategy:
 *   1. Compute Levenshtein distance between the broken `targetId` and every
 *      id in the registry
 *   2. If the best candidate is within a configurable threshold (default: 50%
 *      of the longer id's length), relink the slot to that candidate
 *   3. Otherwise, leave the reference broken
 *
 * This is best-effort: it will not repair references where no candidate is
 * close enough, to avoid silently linking to the wrong element.
 */
export function repairBrokenRefByFuzzyMatch(
  doc: SvgDocument,
  edge: ReferenceEdge,
  options: { maxDistanceRatio?: number } = {}
): RepairResult {
  const { maxDistanceRatio = 0.5 } = options
  const graph = buildReferenceGraph(doc)
  const allIds = Array.from(graph.registry.keys())

  if (allIds.length === 0) {
    return { doc, repaired: false }
  }

  let bestId: string | null = null
  let bestDist = Infinity

  for (const candidateId of allIds) {
    const dist = levenshtein(edge.targetId, candidateId)
    if (dist < bestDist) {
      bestDist = dist
      bestId = candidateId
    }
  }

  if (bestId === null) return { doc, repaired: false }

  const maxAllowed = Math.floor(
    Math.max(edge.targetId.length, bestId.length) * maxDistanceRatio
  )

  if (bestDist > maxAllowed) {
    return { doc, repaired: false }
  }

  // Relink the slot using the pure utility (no side effects)
  const relinked = relinkDocumentSlot(doc, edge.sourceId, edge.slot, bestId)

  return { doc: relinked, repaired: true, newTargetId: bestId }
}

// ── Bulk repair ───────────────────────────────────────────────────────────────

export interface BulkRepairResult {
  doc: SvgDocument
  repairedCount: number
  unrepairedEdges: ReferenceEdge[]
}

/**
 * Attempt to repair all broken references in a document in a single pass.
 *
 * For each broken edge, tries `repairBrokenRefByFuzzyMatch`. Repairs are
 * applied sequentially (each repair may change the document, which could
 * affect subsequent repairs).
 *
 * Returns the fully repaired document (or the best partial repair if some
 * edges could not be resolved), plus counts of repaired vs unrepaired edges.
 */
export function repairAllBrokenReferences(doc: SvgDocument): BulkRepairResult {
  let current = doc
  let repairedCount = 0
  const unrepairedEdges: ReferenceEdge[] = []

  // Re-scan after each repair so the registry stays current
  const broken = findBrokenReferences(current)

  for (const edge of broken) {
    const { doc: next, repaired } = repairBrokenRefByFuzzyMatch(current, edge)
    if (repaired) {
      current = next
      repairedCount++
    } else {
      unrepairedEdges.push(edge)
    }
  }

  return { doc: current, repairedCount, unrepairedEdges }
}

// ── EditorCommand wrapper ─────────────────────────────────────────────────────

/**
 * Command: repair all broken references in the document (best-effort).
 * Integrates with the command/history system for undo support.
 */
export const repairAllBrokenReferencesCommand: EditorCommand<Record<string, never>> = {
  id: 'references.repairAllBrokenReferences',
  label: 'Repair Broken References',
  run: ({ document }) => {
    const { doc, repairedCount, unrepairedEdges } = repairAllBrokenReferences(document)
    const label =
      repairedCount === 0
        ? 'Repair Broken References (none found)'
        : unrepairedEdges.length > 0
          ? `Repair Broken References (${repairedCount} repaired, ${unrepairedEdges.length} unresolved)`
          : `Repair Broken References (${repairedCount} repaired)`
    return { label, document: doc }
  },
}

// ── Levenshtein distance ──────────────────────────────────────────────────────

/**
 * Compute the Levenshtein edit distance between two strings.
 * Implemented inline to avoid adding a new dependency.
 *
 * Time: O(m*n), Space: O(min(m,n)) — adequate for id strings.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Use the shorter string as the "column" dimension to minimize memory
  if (a.length > b.length) { const tmp = a; a = b; b = tmp }

  const m = a.length
  const n = b.length
  let prev = Array.from({ length: m + 1 }, (_, i) => i)
  let curr = new Array<number>(m + 1)

  for (let j = 1; j <= n; j++) {
    curr[0] = j
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[i] = Math.min(
        curr[i - 1] + 1,        // insertion
        prev[i] + 1,             // deletion
        prev[i - 1] + cost       // substitution
      )
    }
    const tmp = prev; prev = curr; curr = tmp
  }

  return prev[m]
}
