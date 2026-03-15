/**
 * Commands for vector path editing.
 * All integrate with the existing command/history system.
 */

import { nanoid } from 'nanoid'
import type { SvgDocument } from '@/model/document/documentTypes'
import type { AppearanceModel, PathNode, RootNode, SvgNode } from '@/model/nodes/nodeTypes'
import type { EditorCommand } from '@/features/documents/services/commands'
import type { HandleMode } from '../utils/pathGeometry'
import { parsePathD, serializePathD } from '../utils/pathGeometry'
import { nodeToPathD, isConvertibleToPath } from '../utils/pathConversion'
import {
  moveAnchor,
  moveHandle,
  addPointOnSegment,
  deleteAnchor,
  convertAnchorType,
  toggleSubpathClosed
} from '../utils/pathOperations'
import { performBooleanOp, BooleanOpError, type BooleanOpType } from '../utils/booleanOps'
import { getNodeBounds } from '@/features/selection/utils/nodeBounds'
import { moveNodesInDocument } from '@/features/documents/utils/documentMutations'

// ── Tree helpers ──────────────────────────────────────────────────────────────

function findNodeById(node: SvgNode, id: string): SvgNode | undefined {
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    const found = findNodeById(child, id)
    if (found) return found
  }
  return undefined
}

function updateNodeInTree(node: SvgNode, targetId: string, updater: (n: SvgNode) => SvgNode): SvgNode {
  if (node.id === targetId) return updater(node)
  if (!node.children?.length) return node
  return { ...node, children: node.children.map((c) => updateNodeInTree(c, targetId, updater)) }
}

function removeNodesFromTree(node: SvgNode, targetIds: Set<string>): SvgNode {
  if (!node.children?.length) return node
  const nextChildren = node.children
    .filter((c) => !targetIds.has(c.id))
    .map((c) => removeNodesFromTree(c, targetIds))
  return { ...node, children: nextChildren }
}

function getParentOf(root: SvgNode, childId: string): (SvgNode & { children: SvgNode[] }) | null {
  if (!root.children?.length) return null
  for (const child of root.children) {
    if (child.id === childId) return root as SvgNode & { children: SvgNode[] }
    const found = getParentOf(child, childId)
    if (found) return found
  }
  return null
}

function updatedDoc(document: SvgDocument, nextRoot: SvgNode): SvgDocument {
  return { ...document, updatedAt: new Date().toISOString(), root: nextRoot as RootNode }
}

// ── path.convertToPath ────────────────────────────────────────────────────────

export const convertToPathCommand: EditorCommand<{ nodeIds: string[] }> = {
  id: 'path.convertToPath',
  label: 'Convert to Path',
  run: ({ document }, { nodeIds }) => {
    const convertibleIds = nodeIds.filter((id) => {
      const node = findNodeById(document.root, id)
      return node && isConvertibleToPath(node) && node.type !== 'path'
    })

    if (convertibleIds.length === 0) {
      return { label: 'Convert to Path', document, selectionIds: nodeIds }
    }

    const newIds: string[] = []
    let root: SvgNode = document.root

    for (const nodeId of convertibleIds) {
      const node = findNodeById(root, nodeId)
      if (!node) continue
      const d = nodeToPathD(node)
      if (!d) continue

      const pathNode: PathNode = {
        id: nanoid(),
        type: 'path',
        name: node.name ?? `Path`,
        visible: node.visible,
        locked: node.locked,
        transform: node.transform,
        d,
        style: (node as { style?: AppearanceModel }).style
      }
      newIds.push(pathNode.id)

      // Replace in tree
      root = updateNodeInTree(root, nodeId, () => pathNode)
    }

    return {
      label: `Convert to Path`,
      selectionIds: newIds.length > 0 ? newIds : nodeIds,
      document: updatedDoc(document, root)
    }
  }
}

// ── path.movePoint ────────────────────────────────────────────────────────────

export const movePointCommand: EditorCommand<{
  nodeId: string
  subpathIndex: number
  anchorIndex: number
  x: number
  y: number
}> = {
  id: 'path.movePoint',
  label: 'Move Point',
  run: ({ document }, { nodeId, subpathIndex, anchorIndex, x, y }) => {
    const node = findNodeById(document.root, nodeId) as PathNode | undefined
    if (!node || node.type !== 'path') return { label: 'Move Point', document }

    const parsed = parsePathD(node.d)
    const next = moveAnchor(parsed, subpathIndex, anchorIndex, x, y)
    const nextD = serializePathD(next)
    const root = updateNodeInTree(document.root, nodeId, (n) => ({ ...n, d: nextD } as PathNode))

    return { label: 'Move Point', selectionIds: [nodeId], document: updatedDoc(document, root) }
  }
}

// ── path.moveHandle ───────────────────────────────────────────────────────────

export const moveHandleCommand: EditorCommand<{
  nodeId: string
  subpathIndex: number
  anchorIndex: number
  handleType: 'h1' | 'h2'
  x: number
  y: number
}> = {
  id: 'path.moveHandle',
  label: 'Move Handle',
  run: ({ document }, { nodeId, subpathIndex, anchorIndex, handleType, x, y }) => {
    const node = findNodeById(document.root, nodeId) as PathNode | undefined
    if (!node || node.type !== 'path') return { label: 'Move Handle', document }

    const parsed = parsePathD(node.d)
    const next = moveHandle(parsed, subpathIndex, anchorIndex, handleType, x, y)
    const nextD = serializePathD(next)
    const root = updateNodeInTree(document.root, nodeId, (n) => ({ ...n, d: nextD } as PathNode))

    return { label: 'Move Handle', selectionIds: [nodeId], document: updatedDoc(document, root) }
  }
}

// ── path.addPoint ─────────────────────────────────────────────────────────────

export const addPointCommand: EditorCommand<{
  nodeId: string
  subpathIndex: number
  segmentIndex: number
  t: number
}> = {
  id: 'path.addPoint',
  label: 'Add Point',
  run: ({ document }, { nodeId, subpathIndex, segmentIndex, t }) => {
    const node = findNodeById(document.root, nodeId) as PathNode | undefined
    if (!node || node.type !== 'path') return { label: 'Add Point', document }

    const parsed = parsePathD(node.d)
    const next = addPointOnSegment(parsed, subpathIndex, segmentIndex, t)
    const nextD = serializePathD(next)
    const root = updateNodeInTree(document.root, nodeId, (n) => ({ ...n, d: nextD } as PathNode))

    return { label: 'Add Point', selectionIds: [nodeId], document: updatedDoc(document, root) }
  }
}

// ── path.deletePoint ──────────────────────────────────────────────────────────

export const deletePointCommand: EditorCommand<{
  nodeId: string
  subpathIndex: number
  anchorIndex: number
}> = {
  id: 'path.deletePoint',
  label: 'Delete Point',
  run: ({ document }, { nodeId, subpathIndex, anchorIndex }) => {
    const node = findNodeById(document.root, nodeId) as PathNode | undefined
    if (!node || node.type !== 'path') return { label: 'Delete Point', document }

    const parsed = parsePathD(node.d)
    const next = deleteAnchor(parsed, subpathIndex, anchorIndex)
    const nextD = serializePathD(next)

    // If all subpaths were deleted, remove the node
    if (next.subpaths.length === 0) {
      const targetIds = new Set([nodeId])
      const root = removeNodesFromTree(document.root, targetIds)
      return { label: 'Delete Point', selectionIds: [], document: updatedDoc(document, root) }
    }

    const root = updateNodeInTree(document.root, nodeId, (n) => ({ ...n, d: nextD } as PathNode))
    return { label: 'Delete Point', selectionIds: [nodeId], document: updatedDoc(document, root) }
  }
}

// ── path.convertPointType ─────────────────────────────────────────────────────

export const convertPointTypeCommand: EditorCommand<{
  nodeId: string
  subpathIndex: number
  anchorIndex: number
  mode: HandleMode
}> = {
  id: 'path.convertPointType',
  label: 'Convert Point Type',
  run: ({ document }, { nodeId, subpathIndex, anchorIndex, mode }) => {
    const node = findNodeById(document.root, nodeId) as PathNode | undefined
    if (!node || node.type !== 'path') return { label: 'Convert Point Type', document }

    const parsed = parsePathD(node.d)
    const next = convertAnchorType(parsed, subpathIndex, anchorIndex, mode)
    const nextD = serializePathD(next)
    const root = updateNodeInTree(document.root, nodeId, (n) => ({ ...n, d: nextD } as PathNode))

    return { label: 'Convert Point Type', selectionIds: [nodeId], document: updatedDoc(document, root) }
  }
}

// ── path.toggleClosed ─────────────────────────────────────────────────────────

export const toggleClosedCommand: EditorCommand<{
  nodeId: string
  subpathIndex: number
}> = {
  id: 'path.toggleClosed',
  label: 'Toggle Path Close',
  run: ({ document }, { nodeId, subpathIndex }) => {
    const node = findNodeById(document.root, nodeId) as PathNode | undefined
    if (!node || node.type !== 'path') return { label: 'Toggle Path Close', document }

    const parsed = parsePathD(node.d)
    const next = toggleSubpathClosed(parsed, subpathIndex)
    const nextD = serializePathD(next)
    const root = updateNodeInTree(document.root, nodeId, (n) => ({ ...n, d: nextD } as PathNode))

    const closed = next.subpaths[subpathIndex]?.closed ?? false
    return { label: closed ? 'Close Path' : 'Open Path', selectionIds: [nodeId], document: updatedDoc(document, root) }
  }
}

// ── Boolean operations ────────────────────────────────────────────────────────

function makeBooleanCommand(op: BooleanOpType): EditorCommand<{ nodeIds: string[] }> {
  const label = op.charAt(0).toUpperCase() + op.slice(1)
  return {
    id: `path.boolean${label}`,
    label: `Boolean ${label}`,
    run: async ({ document }, { nodeIds }) => {
      if (nodeIds.length < 2) {
        return { label: `Boolean ${label}`, document }
      }

      const nodes = nodeIds.map((id) => findNodeById(document.root, id)).filter((n): n is SvgNode => !!n)
      if (nodes.length < 2) {
        return { label: `Boolean ${label}`, document }
      }

      let resultNode: PathNode
      try {
        resultNode = await performBooleanOp(nodes, op)
      } catch (e) {
        if (e instanceof BooleanOpError) {
          console.warn(`Boolean op failed: ${e.message}`)
        }
        return { label: `Boolean ${label}`, document }
      }

      // Find the parent of the first selected node to insert result there
      const firstNode = nodes[0]
      const parent = getParentOf(document.root, firstNode.id)
      const insertParentId = parent?.id ?? document.root.id

      // Remove source nodes
      const targetIds = new Set(nodeIds)
      let root = removeNodesFromTree(document.root, targetIds)

      // Add result to the parent at the position of the first removed node
      root = updateNodeInTree(root, insertParentId, (n) => ({
        ...n,
        children: [...(n.children ?? []), resultNode]
      }))

      return {
        label: `Boolean ${label}`,
        selectionIds: [resultNode.id],
        document: updatedDoc(document, root)
      }
    }
  }
}

export const booleanUnionCommand = makeBooleanCommand('union')
export const booleanSubtractCommand = makeBooleanCommand('subtract')
export const booleanIntersectCommand = makeBooleanCommand('intersect')
export const booleanExcludeCommand = makeBooleanCommand('exclude')

// ── Alignment commands ────────────────────────────────────────────────────────

export type AlignDirection = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

export const alignNodesCommand: EditorCommand<{ nodeIds: string[]; align: AlignDirection }> = {
  id: 'document.alignNodes',
  label: 'Align',
  run: ({ document }, { nodeIds, align }) => {
    if (nodeIds.length < 2) return { label: 'Align', document }

    const nodeBoundsMap = new Map<string, ReturnType<typeof getNodeBounds>>()
    for (const id of nodeIds) {
      const node = findNodeById(document.root, id)
      if (node) nodeBoundsMap.set(id, getNodeBounds(node))
    }

    const allBounds = Array.from(nodeBoundsMap.values()).filter(Boolean)
    if (allBounds.length === 0) return { label: 'Align', document }

    // Reference bounds = union of all selected
    const refLeft = Math.min(...allBounds.map((b) => b!.x))
    const refTop = Math.min(...allBounds.map((b) => b!.y))
    const refRight = Math.max(...allBounds.map((b) => b!.x + b!.width))
    const refBottom = Math.max(...allBounds.map((b) => b!.y + b!.height))
    const refCX = (refLeft + refRight) / 2
    const refCY = (refTop + refBottom) / 2

    let root = document.root as SvgNode
    for (const nodeId of nodeIds) {
      const bounds = nodeBoundsMap.get(nodeId)
      if (!bounds) continue

      let dx = 0; let dy = 0
      switch (align) {
        case 'left':    dx = refLeft - bounds.x; break
        case 'hcenter': dx = refCX - (bounds.x + bounds.width / 2); break
        case 'right':   dx = refRight - (bounds.x + bounds.width); break
        case 'top':     dy = refTop - bounds.y; break
        case 'vcenter': dy = refCY - (bounds.y + bounds.height / 2); break
        case 'bottom':  dy = refBottom - (bounds.y + bounds.height); break
      }

      if (dx !== 0 || dy !== 0) {
        root = moveNodesInDocument({ ...document, root: root as RootNode }, [nodeId], dx, dy).root
      }
    }

    const labelMap: Record<AlignDirection, string> = {
      left: 'Align Left', hcenter: 'Align Center', right: 'Align Right',
      top: 'Align Top', vcenter: 'Align Middle', bottom: 'Align Bottom'
    }

    return { label: labelMap[align], selectionIds: nodeIds, document: updatedDoc(document, root) }
  }
}

export type DistributeDirection = 'horizontal' | 'vertical'

export const distributeNodesCommand: EditorCommand<{ nodeIds: string[]; direction: DistributeDirection }> = {
  id: 'document.distributeNodes',
  label: 'Distribute',
  run: ({ document }, { nodeIds, direction }) => {
    if (nodeIds.length < 3) return { label: 'Distribute', document }

    const nodeBoundsMap = new Map<string, ReturnType<typeof getNodeBounds>>()
    for (const id of nodeIds) {
      const node = findNodeById(document.root, id)
      if (node) nodeBoundsMap.set(id, getNodeBounds(node))
    }

    type BoundsEntry = { id: string; cx: number; cy: number; bounds: NonNullable<ReturnType<typeof getNodeBounds>> }
    const entries: BoundsEntry[] = nodeIds
      .map((id) => {
        const b = nodeBoundsMap.get(id)
        return b ? { id, cx: b.x + b.width / 2, cy: b.y + b.height / 2, bounds: b } : null
      })
      .filter((e): e is BoundsEntry => e !== null)

    if (entries.length < 3) return { label: 'Distribute', document }

    // Sort by center position
    const sorted = [...entries].sort((a, b) => direction === 'horizontal' ? a.cx - b.cx : a.cy - b.cy)
    const first = sorted[0]; const last = sorted[sorted.length - 1]

    const totalSpan = direction === 'horizontal'
      ? last.cx - first.cx
      : last.cy - first.cy

    const gap = totalSpan / (sorted.length - 1)

    let root = document.root as SvgNode
    for (let i = 1; i < sorted.length - 1; i++) {
      const entry = sorted[i]
      const targetCenter = (direction === 'horizontal' ? first.cx : first.cy) + i * gap
      const currentCenter = direction === 'horizontal' ? entry.cx : entry.cy
      const delta = targetCenter - currentCenter
      const dx = direction === 'horizontal' ? delta : 0
      const dy = direction === 'vertical' ? delta : 0
      if (dx !== 0 || dy !== 0) {
        root = moveNodesInDocument({ ...document, root: root as RootNode }, [entry.id], dx, dy).root
      }
    }

    const label = direction === 'horizontal' ? 'Distribute Horizontally' : 'Distribute Vertically'
    return { label, selectionIds: nodeIds, document: updatedDoc(document, root) }
  }
}
