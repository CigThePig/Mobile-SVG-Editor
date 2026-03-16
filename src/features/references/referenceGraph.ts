import type { SvgDocument } from '@/model/document/documentTypes'
import type { SvgNode, AppearanceModel, PaintModel } from '@/model/nodes/nodeTypes'
import { traverseNodes } from '@/model/utils/nodeTraversal'
import { buildIdRegistry, type IdRegistry } from './idRegistry'

// ── Reference slot types ──────────────────────────────────────────────────────

/**
 * The semantic slot that holds a reference.
 * Each slot corresponds to a specific field/attribute in the SVG model.
 */
export type ReferenceSlot =
  | 'use-href'          // UseNode.href → symbol or element
  | 'textPath-href'     // TextPathNode.href → path element
  | 'filter-ref'        // AppearanceModel.filterRef → FilterResource
  | 'mask-ref'          // AppearanceModel.maskRef → MaskNode
  | 'clipPath-ref'      // AppearanceModel.clipPathRef → ClipPathNode
  | 'marker-start-ref'  // AppearanceModel.markerStartRef → MarkerResource
  | 'marker-mid-ref'    // AppearanceModel.markerMidRef → MarkerResource
  | 'marker-end-ref'    // AppearanceModel.markerEndRef → MarkerResource
  | 'fill-paint-ref'    // PaintModel { kind: 'gradient'|'pattern' } → resource
  | 'stroke-paint-ref'  // StrokeModel → (rare, for future stroke gradients)
  | 'gradient-href'     // GradientResource.href → another gradient (inheritance)

// ── Reference edge ────────────────────────────────────────────────────────────

/**
 * A directed edge from one element to another via a specific reference slot.
 * - `sourceId`: the id of the node or resource that holds the reference
 * - `targetId`: the id being referenced (may not exist — see `brokenEdges`)
 * - `slot`:     which field in the source element holds this reference
 */
export interface ReferenceEdge {
  sourceId: string
  targetId: string
  slot: ReferenceSlot
}

// ── Reference graph ───────────────────────────────────────────────────────────

/**
 * A fully computed reference graph for a document.
 *
 * - `registry`:     All ids known to the document (nodes + resources)
 * - `forwardEdges`: sourceId → list of outgoing edges (what does this element reference?)
 * - `reverseEdges`: targetId → list of incoming edges (what references this element?)
 * - `brokenEdges`:  edges where targetId is not in the registry (unresolved references)
 *
 * Build with `buildReferenceGraph(doc)`. This is a pure derived value; recompute
 * after any mutation that changes ids or reference fields.
 */
export interface ReferenceGraph {
  registry: IdRegistry
  forwardEdges: Map<string, ReferenceEdge[]>
  reverseEdges: Map<string, ReferenceEdge[]>
  brokenEdges: ReferenceEdge[]
}

// ── Graph builder ─────────────────────────────────────────────────────────────

/**
 * Build a complete reference graph from a document.
 *
 * Performs:
 *   1. Build the id registry (nodes + resources)
 *   2. Walk the node tree and collect all outgoing edges
 *   3. Walk the resource store and collect gradient-href edges
 *   4. Build reverse index and classify broken edges
 *
 * Time complexity: O(n) where n = total nodes + resources.
 */
export function buildReferenceGraph(doc: SvgDocument): ReferenceGraph {
  const registry = buildIdRegistry(doc)
  const allEdges: ReferenceEdge[] = []

  // ── 1. Walk the node tree ──────────────────────────────────────────────────
  traverseNodes(doc.root, (node) => {
    const sourceId = node.id
    if (!sourceId) return

    // use-href
    if (node.type === 'use') {
      const targetId = stripFragmentPrefix(node.href)
      if (targetId) {
        allEdges.push({ sourceId, targetId, slot: 'use-href' })
      }
    }

    // textPath-href
    if (node.type === 'textPath') {
      const targetId = stripFragmentPrefix(node.href)
      if (targetId) {
        allEdges.push({ sourceId, targetId, slot: 'textPath-href' })
      }
    }

    // appearance refs
    const appearance = getAppearance(node)
    if (appearance) {
      collectAppearanceEdges(sourceId, appearance, allEdges)
    }
  })

  // ── 2. Walk the resource store ─────────────────────────────────────────────
  const resources = doc.resources

  // gradient-href (gradient inheritance)
  for (const g of resources.gradients) {
    if (g.href) {
      const targetId = stripFragmentPrefix(g.href)
      if (targetId) {
        allEdges.push({ sourceId: g.id, targetId, slot: 'gradient-href' })
      }
    }
  }

  // ── 3. Build forward/reverse maps ─────────────────────────────────────────
  const forwardEdges = new Map<string, ReferenceEdge[]>()
  const reverseEdges = new Map<string, ReferenceEdge[]>()
  const brokenEdges: ReferenceEdge[] = []

  for (const edge of allEdges) {
    // Forward index
    const fwd = forwardEdges.get(edge.sourceId) ?? []
    fwd.push(edge)
    forwardEdges.set(edge.sourceId, fwd)

    // Reverse index + broken classification
    if (registry.has(edge.targetId)) {
      const rev = reverseEdges.get(edge.targetId) ?? []
      rev.push(edge)
      reverseEdges.set(edge.targetId, rev)
    } else {
      brokenEdges.push(edge)
    }
  }

  return { registry, forwardEdges, reverseEdges, brokenEdges }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Strip the '#' fragment prefix from a local reference (e.g. '#myId' → 'myId').
 * Returns null for empty, external, or non-local values.
 */
export function stripFragmentPrefix(href: string | undefined): string | null {
  if (!href) return null
  if (href.startsWith('#')) return href.slice(1)
  // Some imported docs may have stored the id without '#' already
  // (the import engine normalises hrefs — trust it, don't strip external refs)
  return null
}

function getAppearance(node: SvgNode): AppearanceModel | undefined {
  if ('style' in node && node.style && typeof node.style === 'object') {
    return node.style as AppearanceModel
  }
  return undefined
}

function collectAppearanceEdges(
  sourceId: string,
  appearance: AppearanceModel,
  out: ReferenceEdge[]
): void {
  if (appearance.filterRef) {
    out.push({ sourceId, targetId: appearance.filterRef, slot: 'filter-ref' })
  }
  if (appearance.maskRef) {
    out.push({ sourceId, targetId: appearance.maskRef, slot: 'mask-ref' })
  }
  if (appearance.clipPathRef) {
    out.push({ sourceId, targetId: appearance.clipPathRef, slot: 'clipPath-ref' })
  }
  if (appearance.markerStartRef) {
    out.push({ sourceId, targetId: appearance.markerStartRef, slot: 'marker-start-ref' })
  }
  if (appearance.markerMidRef) {
    out.push({ sourceId, targetId: appearance.markerMidRef, slot: 'marker-mid-ref' })
  }
  if (appearance.markerEndRef) {
    out.push({ sourceId, targetId: appearance.markerEndRef, slot: 'marker-end-ref' })
  }

  collectPaintEdge(sourceId, appearance.fill, 'fill-paint-ref', out)
}

function collectPaintEdge(
  sourceId: string,
  paint: PaintModel | undefined,
  slot: ReferenceSlot,
  out: ReferenceEdge[]
): void {
  if (!paint) return
  if (paint.kind === 'gradient' || paint.kind === 'pattern') {
    out.push({ sourceId, targetId: paint.resourceId, slot })
  }
}
