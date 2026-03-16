import type { SvgDocument } from '@/model/document/documentTypes'
import type { SvgNode, AppearanceModel, PaintModel } from '@/model/nodes/nodeTypes'
import type { GradientResource } from '@/model/resources/resourceTypes'
import { mapNodeTree } from '@/model/utils/nodeTraversal'
import { buildReferenceGraph, type ReferenceEdge } from './referenceGraph'
import { rebuildDocIdRegistry } from './idRegistry'

// ── Options and result ────────────────────────────────────────────────────────

export interface RenameIdOptions {
  oldId: string
  newId: string
  /**
   * If false (default), the rename is rejected when `newId` already exists
   * in the document. Set to true to force the rename anyway (use with care:
   * this can create duplicate ids).
   */
  force?: boolean
}

export interface RenameIdResult {
  /** The updated document with all references rewritten. */
  document: SvgDocument
  /** All edges that were rewritten during this rename. */
  affectedEdges: ReferenceEdge[]
  /**
   * Populated when `newId` already existed and `force` was not set.
   * When non-empty, `document` is the ORIGINAL document (no change was made).
   */
  conflicts: string[]
}

// ── Main rename function ──────────────────────────────────────────────────────

/**
 * Atomically rename an id across the entire document:
 *   1. Update the target element's own `id` field
 *   2. Update every reference slot that points to `oldId`
 *   3. Rebuild `doc.idRegistry` to keep it in sync
 *
 * This is a pure function — the input document is not mutated.
 *
 * Returns the updated document and the list of affected reference edges.
 * If `newId` already exists and `force` is false, returns the original
 * document unchanged with the conflict listed.
 */
export function renameId(doc: SvgDocument, options: RenameIdOptions): RenameIdResult {
  const { oldId, newId, force = false } = options

  if (oldId === newId) {
    return { document: doc, affectedEdges: [], conflicts: [] }
  }

  // Conflict check
  if (!force) {
    const existing = doc.idRegistry ?? {}
    if (existing[newId] !== undefined) {
      return { document: doc, affectedEdges: [], conflicts: [newId] }
    }
  }

  // Collect which edges will be affected (for the result metadata)
  const graph = buildReferenceGraph(doc)
  const inboundEdges = graph.reverseEdges.get(oldId) ?? []
  // The target node's own "id" is not an edge in the graph, but we record it
  const affectedEdges: ReferenceEdge[] = [...inboundEdges]

  // ── Rewrite the node tree ──────────────────────────────────────────────────
  const newRoot = mapNodeTree(doc.root, (node): SvgNode => {
    let updated = node

    // Rename the node's own id
    if (updated.id === oldId) {
      updated = { ...updated, id: newId }
    }

    // Rewrite use-href
    if (updated.type === 'use' && stripAndCheck(updated.href, oldId)) {
      updated = { ...updated, href: `#${newId}` }
    }

    // Rewrite textPath-href
    if (updated.type === 'textPath' && stripAndCheck(updated.href, oldId)) {
      updated = { ...updated, href: `#${newId}` }
    }

    // Rewrite appearance refs
    const appearance = getAppearance(updated)
    if (appearance) {
      const newAppearance = rewriteAppearance(appearance, oldId, newId)
      if (newAppearance !== appearance) {
        updated = { ...updated, style: newAppearance } as SvgNode
      }
    }

    return updated
  }) as typeof doc.root

  // ── Rewrite the resource store ─────────────────────────────────────────────
  const resources = doc.resources

  const newGradients = resources.gradients.map((g) => {
    let updated = g
    if (updated.id === oldId) updated = { ...updated, id: newId }
    if (updated.href && stripAndCheck(updated.href, oldId)) {
      updated = { ...updated, href: `#${newId}` }
    }
    return updated
  })

  const newPatterns = resources.patterns.map((p) =>
    p.id === oldId ? { ...p, id: newId } : p
  )
  const newFilters = resources.filters.map((f) =>
    f.id === oldId ? { ...f, id: newId } : f
  )
  const newMarkers = resources.markers.map((m) =>
    m.id === oldId ? { ...m, id: newId } : m
  )
  const newSymbols = resources.symbols.map((s) =>
    s.id === oldId ? { ...s, id: newId } : s
  )
  const newStyleBlocks = resources.styleBlocks.map((sb) =>
    sb.id === oldId ? { ...sb, id: newId } : sb
  )
  const newSwatches = resources.swatches.map((sw) =>
    sw.id === oldId ? { ...sw, id: newId } : sw
  )
  const newComponents = resources.components.map((c) =>
    c.id === oldId ? { ...c, id: newId } : c
  )
  const newTextStyles = resources.textStyles.map((ts) =>
    ts.id === oldId ? { ...ts, id: newId } : ts
  )
  const newExportSlices = resources.exportSlices.map((es) =>
    es.id === oldId ? { ...es, id: newId } : es
  )

  // ── Assemble the updated document ─────────────────────────────────────────
  const updatedDoc: SvgDocument = {
    ...doc,
    root: newRoot,
    updatedAt: new Date().toISOString(),
    resources: {
      ...resources,
      gradients: newGradients,
      patterns: newPatterns,
      filters: newFilters,
      markers: newMarkers,
      symbols: newSymbols,
      styleBlocks: newStyleBlocks,
      swatches: newSwatches,
      components: newComponents,
      textStyles: newTextStyles,
      exportSlices: newExportSlices,
    },
  }

  // Rebuild the legacy idRegistry so it stays in sync
  updatedDoc.idRegistry = rebuildDocIdRegistry(updatedDoc)

  return { document: updatedDoc, affectedEdges, conflicts: [] }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Returns true if `href` is a local fragment ref pointing to `targetId`. */
function stripAndCheck(href: string | undefined, targetId: string): boolean {
  if (!href) return false
  if (href.startsWith('#')) return href.slice(1) === targetId
  return href === targetId
}

function getAppearance(node: SvgNode): AppearanceModel | undefined {
  if ('style' in node && node.style && typeof node.style === 'object') {
    return node.style as AppearanceModel
  }
  return undefined
}

function rewriteAppearance(
  appearance: AppearanceModel,
  oldId: string,
  newId: string
): AppearanceModel {
  let changed = false
  let updated = appearance

  const rewriteRef = (val: string | undefined): string | undefined => {
    if (val === oldId) { changed = true; return newId }
    return val
  }

  const newFilterRef = rewriteRef(appearance.filterRef)
  const newMaskRef = rewriteRef(appearance.maskRef)
  const newClipPathRef = rewriteRef(appearance.clipPathRef)
  const newMarkerStartRef = rewriteRef(appearance.markerStartRef)
  const newMarkerMidRef = rewriteRef(appearance.markerMidRef)
  const newMarkerEndRef = rewriteRef(appearance.markerEndRef)

  const newFill = rewritePaint(appearance.fill, oldId, newId)
  if (newFill !== appearance.fill) changed = true

  if (changed) {
    updated = {
      ...appearance,
      filterRef: newFilterRef,
      maskRef: newMaskRef,
      clipPathRef: newClipPathRef,
      markerStartRef: newMarkerStartRef,
      markerMidRef: newMarkerMidRef,
      markerEndRef: newMarkerEndRef,
      fill: newFill,
    }
  }

  return updated
}

function rewritePaint(
  paint: PaintModel | undefined,
  oldId: string,
  newId: string
): PaintModel | undefined {
  if (!paint) return paint
  if ((paint.kind === 'gradient' || paint.kind === 'pattern') && paint.resourceId === oldId) {
    return { ...paint, resourceId: newId }
  }
  return paint
}

// Re-export GradientResource for consumers that need to do resource-level operations
export type { GradientResource }
