import type { EditorCommand } from '@/features/documents/services/commands'
import type { SvgDocument } from '@/model/document/documentTypes'
import type { SvgNode, AppearanceModel, PaintModel } from '@/model/nodes/nodeTypes'
import { mapNodeTree } from '@/model/utils/nodeTraversal'
import { buildReferenceGraph, type ReferenceSlot } from './referenceGraph'
import { getOrphanedResources } from './referenceQueries'
import { renameId, type RenameIdOptions } from './renameResourceCommand'
import { rebuildDocIdRegistry } from './idRegistry'

// ── Rename id command ─────────────────────────────────────────────────────────

/**
 * Rename an id everywhere in the document (atomically).
 *
 * Payload: `{ oldId, newId, force? }`
 *
 * If `newId` already exists and `force` is false, the command is a no-op
 * (returns the document unchanged). The label still indicates a rename was
 * attempted so the undo stack records the intent.
 */
export const renameIdCommand: EditorCommand<RenameIdOptions> = {
  id: 'references.renameId',
  label: 'Rename ID',
  run: ({ document }, payload) => {
    const result = renameId(document, payload)
    if (result.conflicts.length > 0) {
      return {
        label: `Rename ID (conflict: ${result.conflicts.join(', ')})`,
        document,
      }
    }
    return {
      label: `Rename ID "${payload.oldId}" → "${payload.newId}"`,
      document: result.document,
    }
  },
}

// ── Relink reference command ──────────────────────────────────────────────────

export interface RelinkReferencePayload {
  /** Id of the node or resource whose reference slot should be updated. */
  sourceId: string
  /** Which reference slot to update. */
  slot: ReferenceSlot
  /** The new target id to point to (without '#' prefix). */
  newTargetId: string
}

/**
 * Update a single reference slot on a specific element to point to a new target.
 *
 * Useful when the user wants to change e.g. which gradient fills a shape,
 * or which symbol a `<use>` element instantiates.
 */
export const relinkReferenceCommand: EditorCommand<RelinkReferencePayload> = {
  id: 'references.relinkReference',
  label: 'Relink Reference',
  run: ({ document }, { sourceId, slot, newTargetId }) => {
    const updatedDoc = relinkSlot(document, sourceId, slot, newTargetId)
    return {
      label: `Relink ${slot} → "${newTargetId}"`,
      document: updatedDoc,
    }
  },
}

// ── Remove orphaned resources command ─────────────────────────────────────────

/**
 * Remove all resources that are defined but never referenced by any node or
 * other resource. This is a cleanup operation — it is safe only when the
 * caller has verified via `getOrphanedResources()` that these resources
 * are genuinely unused.
 */
export const removeOrphanedResourcesCommand: EditorCommand<Record<string, never>> = {
  id: 'references.removeOrphanedResources',
  label: 'Remove Orphaned Resources',
  run: ({ document }) => {
    const graph = buildReferenceGraph(document)
    const orphanedIds = new Set(getOrphanedResources(graph))

    if (orphanedIds.size === 0) {
      return { label: 'Remove Orphaned Resources (none found)', document }
    }

    const resources = document.resources
    const updatedDoc: SvgDocument = {
      ...document,
      updatedAt: new Date().toISOString(),
      resources: {
        ...resources,
        gradients: resources.gradients.filter((r) => !orphanedIds.has(r.id)),
        patterns: resources.patterns.filter((r) => !orphanedIds.has(r.id)),
        filters: resources.filters.filter((r) => !orphanedIds.has(r.id)),
        markers: resources.markers.filter((r) => !orphanedIds.has(r.id)),
        symbols: resources.symbols.filter((r) => !orphanedIds.has(r.id)),
        styleBlocks: resources.styleBlocks.filter((r) => !orphanedIds.has(r.id)),
        swatches: resources.swatches.filter((r) => !orphanedIds.has(r.id)),
        components: resources.components.filter((r) => !orphanedIds.has(r.id)),
        textStyles: resources.textStyles.filter((r) => !orphanedIds.has(r.id)),
        exportSlices: resources.exportSlices.filter((r) => !orphanedIds.has(r.id)),
      },
    }
    updatedDoc.idRegistry = rebuildDocIdRegistry(updatedDoc)

    return {
      label: `Remove Orphaned Resources (${orphanedIds.size})`,
      document: updatedDoc,
    }
  },
}

// ── Public: slot rewriter (also used by repairReferences) ────────────────────

/**
 * Pure function that relinks a single reference slot on the given source element
 * to point to `newTargetId`. Used internally by `relinkReferenceCommand` and
 * by `repairReferences.ts`.
 */
export function relinkDocumentSlot(
  doc: SvgDocument,
  sourceId: string,
  slot: ReferenceSlot,
  newTargetId: string
): SvgDocument {
  return relinkSlot(doc, sourceId, slot, newTargetId)
}

// ── Internal: slot rewriter ───────────────────────────────────────────────────

function relinkSlot(
  doc: SvgDocument,
  sourceId: string,
  slot: ReferenceSlot,
  newTargetId: string
): SvgDocument {
  let touched = false

  const newRoot = mapNodeTree(doc.root, (node): SvgNode => {
    if (node.id !== sourceId) return node

    // use-href
    if (slot === 'use-href' && node.type === 'use') {
      touched = true
      return { ...node, href: `#${newTargetId}` }
    }

    // textPath-href
    if (slot === 'textPath-href' && node.type === 'textPath') {
      touched = true
      return { ...node, href: `#${newTargetId}` }
    }

    // Appearance slots
    const appearance = getAppearance(node)
    if (appearance) {
      const newAppearance = relinkAppearanceSlot(appearance, slot, newTargetId)
      if (newAppearance !== appearance) {
        touched = true
        return { ...node, style: newAppearance } as SvgNode
      }
    }

    return node
  }) as typeof doc.root

  // gradient-href — relink in the resource store
  let newGradients = doc.resources.gradients
  if (slot === 'gradient-href') {
    newGradients = newGradients.map((g) => {
      if (g.id !== sourceId) return g
      touched = true
      return { ...g, href: `#${newTargetId}` }
    })
  }

  if (!touched) return doc

  return {
    ...doc,
    updatedAt: new Date().toISOString(),
    root: newRoot,
    resources: { ...doc.resources, gradients: newGradients },
  }
}

function getAppearance(node: SvgNode): AppearanceModel | undefined {
  if ('style' in node && node.style && typeof node.style === 'object') {
    return node.style as AppearanceModel
  }
  return undefined
}

function relinkAppearanceSlot(
  appearance: AppearanceModel,
  slot: ReferenceSlot,
  newTargetId: string
): AppearanceModel {
  switch (slot) {
    case 'filter-ref':
      return { ...appearance, filterRef: newTargetId }
    case 'mask-ref':
      return { ...appearance, maskRef: newTargetId }
    case 'clipPath-ref':
      return { ...appearance, clipPathRef: newTargetId }
    case 'marker-start-ref':
      return { ...appearance, markerStartRef: newTargetId }
    case 'marker-mid-ref':
      return { ...appearance, markerMidRef: newTargetId }
    case 'marker-end-ref':
      return { ...appearance, markerEndRef: newTargetId }
    case 'fill-paint-ref':
      return { ...appearance, fill: rewritePaintResourceId(appearance.fill, newTargetId) }
    default:
      return appearance
  }
}

function rewritePaintResourceId(
  paint: PaintModel | undefined,
  newTargetId: string
): PaintModel | undefined {
  if (!paint) return paint
  if (paint.kind === 'gradient' || paint.kind === 'pattern') {
    return { ...paint, resourceId: newTargetId }
  }
  return paint
}
