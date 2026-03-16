import type { ReferenceEdge, ReferenceGraph } from './referenceGraph'

// ── Basic queries ─────────────────────────────────────────────────────────────

/**
 * All edges pointing TO `targetId` — i.e., every element that references this id.
 * Returns an empty array if nothing references it.
 */
export function findReferencesTo(graph: ReferenceGraph, targetId: string): ReferenceEdge[] {
  return graph.reverseEdges.get(targetId) ?? []
}

/**
 * All edges going FROM `sourceId` — i.e., every id that this element references.
 * Returns an empty array if this element references nothing.
 */
export function findReferencesFrom(graph: ReferenceGraph, sourceId: string): ReferenceEdge[] {
  return graph.forwardEdges.get(sourceId) ?? []
}

/**
 * Returns true if any element in the document references `id`.
 */
export function isReferenced(graph: ReferenceGraph, id: string): boolean {
  const edges = graph.reverseEdges.get(id)
  return edges !== undefined && edges.length > 0
}

// ── Broken reference queries ──────────────────────────────────────────────────

/**
 * All edges where the target id does not exist in the document.
 * These represent broken references that would produce invalid SVG output.
 */
export function getBrokenReferences(graph: ReferenceGraph): ReferenceEdge[] {
  return graph.brokenEdges
}

// ── Orphan queries ────────────────────────────────────────────────────────────

/**
 * Resource ids that exist in the document but are never referenced by any node
 * or other resource.
 *
 * Note: Only checks resource ids (kind='resource'), not node ids.
 * A node without inbound refs is not necessarily "orphaned" — it may be a
 * top-level element in the visual tree.
 */
export function getOrphanedResources(graph: ReferenceGraph): string[] {
  const orphans: string[] = []
  for (const [id, entry] of graph.registry) {
    if (entry.kind !== 'resource') continue
    if (!isReferenced(graph, id)) {
      orphans.push(id)
    }
  }
  return orphans
}

// ── Deletion safety ───────────────────────────────────────────────────────────

/** Result of a deletion-safety check. */
export interface DeletionSafety {
  /** True if the element can be safely deleted without breaking any references. */
  safe: boolean
  /** The inbound edges that would become broken if this id were removed. */
  blockers: ReferenceEdge[]
}

/**
 * Check whether it is safe to delete the element with the given id.
 *
 * An element is safe to delete if nothing in the document references it.
 * If there are inbound references, those references would become broken
 * references after deletion — they are returned as `blockers`.
 */
export function canSafelyDelete(graph: ReferenceGraph, id: string): DeletionSafety {
  const blockers = findReferencesTo(graph, id)
  return { safe: blockers.length === 0, blockers }
}

// ── Circular reference detection ──────────────────────────────────────────────

/** A chain of ids that form a cycle in the reference graph. */
export interface CircularRefChain {
  /** The ids forming the cycle, in order. The last id references the first. */
  ids: string[]
}

/**
 * Detect circular reference chains in the graph.
 *
 * A cycle occurs when following reference edges from a node eventually leads
 * back to the same node. The most common real-world case is:
 *   <use href="#symbol"> → symbol contains <use href="#symbol">  (infinite recursion)
 *
 * Uses iterative DFS with a recursion stack to detect back-edges.
 * Only traverses forward edges (source → target direction).
 */
export function detectCircularRefs(graph: ReferenceGraph): CircularRefChain[] {
  const visited = new Set<string>()
  const cycles: CircularRefChain[] = []

  for (const startId of graph.registry.keys()) {
    if (visited.has(startId)) continue
    detectCyclesFrom(startId, graph, visited, [], new Set(), cycles)
  }

  return cycles
}

function detectCyclesFrom(
  nodeId: string,
  graph: ReferenceGraph,
  visited: Set<string>,
  path: string[],
  pathSet: Set<string>,
  cycles: CircularRefChain[]
): void {
  visited.add(nodeId)
  path.push(nodeId)
  pathSet.add(nodeId)

  const edges = graph.forwardEdges.get(nodeId) ?? []
  for (const edge of edges) {
    const { targetId } = edge
    if (pathSet.has(targetId)) {
      // Found a cycle — extract the cycle portion from path
      const cycleStart = path.indexOf(targetId)
      cycles.push({ ids: path.slice(cycleStart) })
    } else if (!visited.has(targetId)) {
      detectCyclesFrom(targetId, graph, visited, path, pathSet, cycles)
    }
  }

  path.pop()
  pathSet.delete(nodeId)
}

// ── Reference count helpers ───────────────────────────────────────────────────

/**
 * Count of inbound references to `id`. Useful for displaying "used by N elements"
 * in the Inspector (Phase 8) and Layers panel (Phase 9).
 */
export function getReferenceCount(graph: ReferenceGraph, id: string): number {
  return findReferencesTo(graph, id).length
}

/**
 * Returns a summary map of all ids and their inbound reference counts.
 * Convenient for bulk rendering of "used by" badges.
 */
export function buildReferenceCountMap(graph: ReferenceGraph): Map<string, number> {
  const counts = new Map<string, number>()
  for (const [targetId, edges] of graph.reverseEdges) {
    counts.set(targetId, edges.length)
  }
  return counts
}
