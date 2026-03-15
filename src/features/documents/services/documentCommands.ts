import { nanoid } from 'nanoid'
import type { SvgDocument } from '@/model/document/documentTypes'
import type { AppearanceModel, CircleNode, EllipseNode, GroupNode, ImageNode, LineNode, PathNode, PolygonNode, PolylineNode, RootNode, StarNode, StrokeModel, SvgNode, RectNode, TextNode } from '@/model/nodes/nodeTypes'
import type { EditorCommand } from './commands'

function isContainerNode(node: SvgNode): node is RootNode | GroupNode {
  return node.type === 'root' || node.type === 'group'
}

function getNodeInTree(node: SvgNode, targetId: string): SvgNode | null {
  if (node.id === targetId) return node
  if (!node.children?.length) return null
  for (const child of node.children) {
    const found = getNodeInTree(child, targetId)
    if (found) return found
  }
  return null
}

function getParentInfo(node: SvgNode, childId: string): { parent: RootNode | GroupNode; index: number } | null {
  if (!isContainerNode(node)) return null

  const children = node.children ?? []
  const directIndex = children.findIndex((child) => child.id === childId)
  if (directIndex >= 0) return { parent: node, index: directIndex }

  for (const child of children) {
    const match = getParentInfo(child, childId)
    if (match) return match
  }

  return null
}

function replaceChildrenInTree(node: SvgNode, parentId: string, nextChildren: SvgNode[]): SvgNode {
  if (node.id === parentId && isContainerNode(node)) {
    return {
      ...node,
      children: nextChildren
    }
  }

  if (!node.children?.length) return node

  return {
    ...node,
    children: node.children.map((child) => replaceChildrenInTree(child, parentId, nextChildren))
  }
}

/**
 * Bake a pure translation (dx, dy) directly into a node's geometry coordinates,
 * avoiding any transform accumulation. Falls back to transform for unknown types.
 */
function applyTranslateToChildCoords(child: SvgNode, dx: number, dy: number): SvgNode {
  switch (child.type) {
    case 'rect': {
      const n = child as RectNode
      return { ...n, x: n.x + dx, y: n.y + dy }
    }
    case 'circle': {
      const n = child as CircleNode
      return { ...n, cx: n.cx + dx, cy: n.cy + dy }
    }
    case 'ellipse': {
      const n = child as EllipseNode
      return { ...n, cx: n.cx + dx, cy: n.cy + dy }
    }
    case 'line': {
      const n = child as LineNode
      return { ...n, x1: n.x1 + dx, y1: n.y1 + dy, x2: n.x2 + dx, y2: n.y2 + dy }
    }
    case 'polyline': {
      const n = child as PolylineNode
      return { ...n, points: n.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
    }
    case 'polygon': {
      const n = child as PolygonNode
      return { ...n, points: n.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
    }
    case 'text': {
      const n = child as TextNode
      return { ...n, x: n.x + dx, y: n.y + dy }
    }
    case 'image': {
      const n = child as ImageNode
      return { ...n, x: n.x + dx, y: n.y + dy }
    }
    default:
      // For groups or unknown: fall back to accumulating translateX/Y on transform
      return {
        ...child,
        transform: {
          ...child.transform,
          translateX: (child.transform?.translateX ?? 0) + dx,
          translateY: (child.transform?.translateY ?? 0) + dy
        }
      }
  }
}

function foldTransformIntoChild(child: SvgNode, groupTransform?: GroupNode['transform']): SvgNode {
  if (!groupTransform) return child

  const tx = groupTransform.translateX ?? 0
  const ty = groupTransform.translateY ?? 0
  const rotate = groupTransform.rotate ?? 0
  const scaleX = groupTransform.scaleX ?? 1
  const scaleY = groupTransform.scaleY ?? 1
  const skewX = groupTransform.skewX ?? 0
  const skewY = groupTransform.skewY ?? 0

  // Fast path: group has only a translation (the most common case after moving a
  // non-rotated group). Bake it directly into child geometry so children end up
  // with clean coordinates and no accumulated transform.
  const isTranslateOnly = !rotate && scaleX === 1 && scaleY === 1 && !skewX && !skewY &&
    groupTransform.pivotX == null && groupTransform.pivotY == null
  if (isTranslateOnly) {
    if (!tx && !ty) return child
    return applyTranslateToChildCoords(child, tx, ty)
  }

  // General case: combine all transform components.
  // Note: this is an approximation — translate+rotate compositions are only exact
  // when both pivots coincide. Known limitation for complex nested transforms.
  // Critically, we do NOT inherit the group's pivotX/Y onto the child: the group
  // pivot is in group-local space while child.pivotX/Y must be in child-local space.
  return {
    ...child,
    transform: {
      ...child.transform,
      translateX: (child.transform?.translateX ?? 0) + tx,
      translateY: (child.transform?.translateY ?? 0) + ty,
      rotate: (child.transform?.rotate ?? 0) + rotate,
      scaleX: (child.transform?.scaleX ?? 1) * scaleX,
      scaleY: (child.transform?.scaleY ?? 1) * scaleY,
      skewX: (child.transform?.skewX ?? 0) + skewX,
      skewY: (child.transform?.skewY ?? 0) + skewY
      // pivotX/pivotY: intentionally NOT inherited from group — they are in
      // different coordinate spaces. Child keeps its own pivot (or none).
    }
  }
}

function groupSelection(document: SvgDocument, nodeIds: string[]) {
  const uniqueNodeIds = Array.from(new Set(nodeIds))
  if (uniqueNodeIds.length < 2) return null

  const parentInfos = uniqueNodeIds.map((nodeId) => getParentInfo(document.root, nodeId))
  if (parentInfos.some((info) => !info)) return null

  const firstParentId = parentInfos[0]!.parent.id
  if (parentInfos.some((info) => info!.parent.id !== firstParentId)) return null

  const parentNode = parentInfos[0]!.parent
  const children = parentNode.children ?? []
  const selectedSet = new Set(uniqueNodeIds)
  const selectedEntries = children
    .map((child, index) => ({ child, index }))
    .filter((entry) => selectedSet.has(entry.child.id))

  if (selectedEntries.length < 2) return null

  const insertIndex = Math.min(...selectedEntries.map((entry) => entry.index))
  const groupId = nanoid()
  const groupNode: GroupNode = {
    id: groupId,
    type: 'group',
    name: `Group (${selectedEntries.length})`,
    visible: true,
    locked: false,
    children: selectedEntries.map((entry) => entry.child)
  }

  const nextChildren: SvgNode[] = []
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    if (index == insertIndex) nextChildren.push(groupNode)
    if (!selectedSet.has(child.id)) nextChildren.push(child)
  }

  return {
    document: {
      ...document,
      updatedAt: new Date().toISOString(),
      root: replaceChildrenInTree(document.root, parentNode.id, nextChildren) as RootNode
    },
    selectionIds: [groupId]
  }
}

function ungroupSelection(document: SvgDocument, nodeIds: string[]) {
  const targetIds = new Set(nodeIds)
  const insertedChildIds: string[] = []

  const expandChildren = (children: SvgNode[]): SvgNode[] => {
    const out: SvgNode[] = []

    for (const child of children) {
      if (targetIds.has(child.id) && child.type === 'group') {
        const bakedChildren = (child.children ?? []).map((grandchild) => foldTransformIntoChild(grandchild, child.transform))
        insertedChildIds.push(...bakedChildren.map((node) => node.id))
        out.push(...bakedChildren)
        continue
      }

      if (child.children?.length) {
        out.push({
          ...child,
          children: expandChildren(child.children)
        })
        continue
      }

      out.push(child)
    }

    return out
  }

  const nextRoot = {
    ...document.root,
    children: expandChildren(document.root.children ?? [])
  }

  if (!insertedChildIds.length) return null

  return {
    document: {
      ...document,
      updatedAt: new Date().toISOString(),
      root: nextRoot
    },
    selectionIds: insertedChildIds
  }
}

export const addRectCommand: EditorCommand<{ x: number; y: number; width: number; height: number }> = {
  id: 'document.addRect',
  label: 'Add Rectangle',
  run: ({ document }, payload) => {
    const rect: RectNode = {
      id: nanoid(),
      type: 'rect',
      visible: true,
      locked: false,
      x: payload.x,
      y: payload.y,
      width: payload.width,
      height: payload.height,
      style: {
        fill: { kind: 'solid', color: '#ffffff' },
        stroke: { color: '#000000', width: 0 }
      }
    }

    return {
      label: 'Add Rectangle',
      selectionIds: [rect.id],
      document: {
        ...document,
        updatedAt: new Date().toISOString(),
        root: {
          ...document.root,
          children: [...(document.root.children ?? []), rect]
        }
      }
    }
  }
}

// ─── Tree helpers ────────────────────────────────────────────────────────────

function removeNodesFromTree(node: SvgNode, targetIds: Set<string>): SvgNode {
  if (!node.children?.length) return node
  const nextChildren = node.children
    .filter((child) => !targetIds.has(child.id))
    .map((child) => removeNodesFromTree(child, targetIds))
  return { ...node, children: nextChildren }
}

function updateNodeInTree(node: SvgNode, targetId: string, updater: (n: SvgNode) => SvgNode): SvgNode {
  if (node.id === targetId) return updater(node)
  if (!node.children?.length) return node
  return { ...node, children: node.children.map((child) => updateNodeInTree(child, targetId, updater)) }
}

function deepCloneWithNewIds(node: SvgNode): SvgNode {
  const clone = JSON.parse(JSON.stringify(node)) as SvgNode
  clone.id = nanoid()
  if (clone.children?.length) {
    clone.children = clone.children.map(deepCloneWithNewIds)
  }
  return clone
}

function offsetNode(node: SvgNode, dx: number, dy: number): SvgNode {
  switch (node.type) {
    case 'rect': return { ...node, x: (node as RectNode).x + dx, y: (node as RectNode).y + dy }
    case 'ellipse': return { ...node, cx: (node as EllipseNode).cx + dx, cy: (node as EllipseNode).cy + dy }
    case 'circle': return { ...node, cx: (node as CircleNode).cx + dx, cy: (node as CircleNode).cy + dy }
    case 'line': {
      const n = node as LineNode
      return { ...n, x1: n.x1 + dx, y1: n.y1 + dy, x2: n.x2 + dx, y2: n.y2 + dy }
    }
    case 'polyline': return { ...node, points: (node as PolylineNode).points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
    case 'polygon': return { ...node, points: (node as PolygonNode).points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
    case 'star': return { ...node, cx: (node as StarNode).cx + dx, cy: (node as StarNode).cy + dy }
    case 'text': return { ...node, x: (node as TextNode).x + dx, y: (node as TextNode).y + dy }
    case 'image': return { ...node, x: (node as ImageNode).x + dx, y: (node as ImageNode).y + dy }
    default:
      return { ...node, transform: { ...node.transform, translateX: ((node.transform?.translateX) ?? 0) + dx, translateY: ((node.transform?.translateY) ?? 0) + dy } }
  }
}

function reorderChildren(children: SvgNode[], nodeId: string, direction: 'up' | 'down' | 'front' | 'back'): SvgNode[] {
  const index = children.findIndex((c) => c.id === nodeId)
  if (index < 0) return children
  const arr = [...children]
  const [item] = arr.splice(index, 1)
  if (direction === 'front') {
    arr.push(item)
  } else if (direction === 'back') {
    arr.unshift(item)
  } else if (direction === 'up') {
    arr.splice(Math.min(arr.length, index + 1), 0, item)
  } else {
    arr.splice(Math.max(0, index - 1), 0, item)
  }
  return arr
}

function reorderInTree(node: SvgNode, targetId: string, direction: 'up' | 'down' | 'front' | 'back'): SvgNode {
  if (!node.children?.length) return node
  if (node.children.some((c) => c.id === targetId)) {
    return { ...node, children: reorderChildren(node.children, targetId, direction) }
  }
  return { ...node, children: node.children.map((child) => reorderInTree(child, targetId, direction)) }
}

function defaultStyle(): AppearanceModel {
  return {
    fill: { kind: 'solid', color: '#4f8ef7' },
    stroke: { color: '#1d4ed8', width: 2 }
  }
}

// ─── Shape creation commands ──────────────────────────────────────────────────

export const addEllipseCommand: EditorCommand<{ cx: number; cy: number; rx: number; ry: number }> = {
  id: 'document.addEllipse',
  label: 'Add Ellipse',
  run: ({ document }, payload) => {
    const ellipse: EllipseNode = {
      id: nanoid(),
      type: 'ellipse',
      visible: true,
      locked: false,
      cx: payload.cx,
      cy: payload.cy,
      rx: payload.rx,
      ry: payload.ry,
      style: defaultStyle()
    }
    return {
      label: 'Add Ellipse',
      selectionIds: [ellipse.id],
      document: { ...document, updatedAt: new Date().toISOString(), root: { ...document.root, children: [...(document.root.children ?? []), ellipse] } }
    }
  }
}

export const addLineCommand: EditorCommand<{ x1: number; y1: number; x2: number; y2: number }> = {
  id: 'document.addLine',
  label: 'Add Line',
  run: ({ document }, payload) => {
    const line: LineNode = {
      id: nanoid(),
      type: 'line',
      visible: true,
      locked: false,
      x1: payload.x1,
      y1: payload.y1,
      x2: payload.x2,
      y2: payload.y2,
      style: { fill: { kind: 'none' }, stroke: { color: '#1d4ed8', width: 3 } }
    }
    return {
      label: 'Add Line',
      selectionIds: [line.id],
      document: { ...document, updatedAt: new Date().toISOString(), root: { ...document.root, children: [...(document.root.children ?? []), line] } }
    }
  }
}

export const addPolygonCommand: EditorCommand<{ cx: number; cy: number; radius: number; sides: number }> = {
  id: 'document.addPolygon',
  label: 'Add Polygon',
  run: ({ document }, payload) => {
    const { cx, cy, radius, sides } = payload
    const points: Array<{ x: number; y: number }> = []
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 * i) / sides - Math.PI / 2
      points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
    }
    const polygon: PolygonNode = {
      id: nanoid(),
      type: 'polygon',
      visible: true,
      locked: false,
      points,
      style: defaultStyle()
    }
    return {
      label: 'Add Polygon',
      selectionIds: [polygon.id],
      document: { ...document, updatedAt: new Date().toISOString(), root: { ...document.root, children: [...(document.root.children ?? []), polygon] } }
    }
  }
}

export const addStarCommand: EditorCommand<{ cx: number; cy: number; outerRadius: number; innerRadius: number; numPoints: number }> = {
  id: 'document.addStar',
  label: 'Add Star',
  run: ({ document }, payload) => {
    const star: StarNode = {
      id: nanoid(),
      type: 'star',
      visible: true,
      locked: false,
      cx: payload.cx,
      cy: payload.cy,
      outerRadius: payload.outerRadius,
      innerRadius: payload.innerRadius,
      numPoints: payload.numPoints,
      style: { fill: { kind: 'solid', color: '#fbbf24' }, stroke: { color: '#b45309', width: 2 } }
    }
    return {
      label: 'Add Star',
      selectionIds: [star.id],
      document: { ...document, updatedAt: new Date().toISOString(), root: { ...document.root, children: [...(document.root.children ?? []), star] } }
    }
  }
}

export const addTextCommand: EditorCommand<{ x: number; y: number; content: string }> = {
  id: 'document.addText',
  label: 'Add Text',
  run: ({ document }, payload) => {
    const text: TextNode = {
      id: nanoid(),
      type: 'text',
      visible: true,
      locked: false,
      x: payload.x,
      y: payload.y,
      content: payload.content,
      textStyle: { fontSize: 48, fontFamily: 'sans-serif', fontWeight: 'normal' },
      style: { fill: { kind: 'solid', color: '#ffffff' }, stroke: { color: 'transparent', width: 0 } }
    }
    return {
      label: 'Add Text',
      selectionIds: [text.id],
      document: { ...document, updatedAt: new Date().toISOString(), root: { ...document.root, children: [...(document.root.children ?? []), text] } }
    }
  }
}

// ─── Object action commands ───────────────────────────────────────────────────

export const deleteNodesCommand: EditorCommand<{ nodeIds: string[] }> = {
  id: 'document.deleteNodes',
  label: 'Delete',
  run: ({ document }, { nodeIds }) => {
    const targetIds = new Set(nodeIds)
    const nextRoot = removeNodesFromTree(document.root, targetIds)
    return {
      label: `Delete ${nodeIds.length === 1 ? 'Object' : 'Objects'}`,
      selectionIds: [],
      document: { ...document, updatedAt: new Date().toISOString(), root: nextRoot as typeof document.root }
    }
  }
}

export const duplicateNodesCommand: EditorCommand<{ nodeIds: string[] }> = {
  id: 'document.duplicateNodes',
  label: 'Duplicate',
  run: ({ document }, { nodeIds }) => {
    const newIds: string[] = []
    let root: SvgNode = document.root

    for (const nodeId of nodeIds) {
      const parentInfo = getParentInfo(root, nodeId)
      if (!parentInfo) continue
      const { parent } = parentInfo
      const index = parent.children.findIndex((c) => c.id === nodeId)
      if (index < 0) continue
      const original = parent.children[index]
      const clone = deepCloneWithNewIds(offsetNode(original, 16, 16))
      newIds.push(clone.id)
      const newParentChildren = [
        ...parent.children.slice(0, index + 1),
        clone,
        ...parent.children.slice(index + 1)
      ]
      root = replaceChildrenInTree(root, parent.id, newParentChildren)
    }

    return {
      label: `Duplicate ${nodeIds.length === 1 ? 'Object' : 'Objects'}`,
      selectionIds: newIds,
      document: { ...document, updatedAt: new Date().toISOString(), root: root as RootNode }
    }
  }
}

export const reorderNodeCommand: EditorCommand<{ nodeId: string; direction: 'up' | 'down' | 'front' | 'back' }> = {
  id: 'document.reorderNode',
  label: 'Reorder',
  run: ({ document }, { nodeId, direction }) => {
    const labelMap = { up: 'Move Forward', down: 'Move Backward', front: 'Bring to Front', back: 'Send to Back' }
    const nextRoot = reorderInTree(document.root, nodeId, direction)
    return {
      label: labelMap[direction],
      selectionIds: [nodeId],
      document: { ...document, updatedAt: new Date().toISOString(), root: nextRoot as typeof document.root }
    }
  }
}

export const setNodeVisibilityCommand: EditorCommand<{ nodeId: string; visible: boolean }> = {
  id: 'document.setNodeVisibility',
  label: 'Set Visibility',
  run: ({ document }, { nodeId, visible }) => {
    const nextRoot = updateNodeInTree(document.root, nodeId, (n) => ({ ...n, visible }))
    return {
      label: visible ? 'Show Object' : 'Hide Object',
      selectionIds: [nodeId],
      document: { ...document, updatedAt: new Date().toISOString(), root: nextRoot as typeof document.root }
    }
  }
}

export const setNodeLockedCommand: EditorCommand<{ nodeId: string; locked: boolean }> = {
  id: 'document.setNodeLocked',
  label: 'Set Locked',
  run: ({ document }, { nodeId, locked }) => {
    const nextRoot = updateNodeInTree(document.root, nodeId, (n) => ({ ...n, locked }))
    return {
      label: locked ? 'Lock Object' : 'Unlock Object',
      selectionIds: [nodeId],
      document: { ...document, updatedAt: new Date().toISOString(), root: nextRoot as typeof document.root }
    }
  }
}

export const updateNodeStyleCommand: EditorCommand<{ nodeId: string; style: Partial<AppearanceModel> }> = {
  id: 'document.updateNodeStyle',
  label: 'Update Style',
  run: ({ document }, { nodeId, style }) => {
    const nextRoot = updateNodeInTree(document.root, nodeId, (n) => {
      const existing = (n as { style?: AppearanceModel }).style ?? {}
      return { ...n, style: { ...existing, ...style } }
    })
    return {
      label: 'Update Style',
      selectionIds: [nodeId],
      document: { ...document, updatedAt: new Date().toISOString(), root: nextRoot as typeof document.root }
    }
  }
}

export const updateNodePropertiesCommand: EditorCommand<{ nodeId: string; properties: Record<string, unknown> }> = {
  id: 'document.updateNodeProperties',
  label: 'Update Properties',
  run: ({ document }, { nodeId, properties }) => {
    const nextRoot = updateNodeInTree(document.root, nodeId, (n) => ({ ...n, ...properties }))
    return {
      label: 'Update Properties',
      selectionIds: [nodeId],
      document: { ...document, updatedAt: new Date().toISOString(), root: nextRoot as typeof document.root }
    }
  }
}

// ─── Style-specific updaters ──────────────────────────────────────────────────

export const updateNodeFillCommand: EditorCommand<{ nodeId: string; color: string }> = {
  id: 'document.updateNodeFill',
  label: 'Update Fill',
  run: ({ document }, { nodeId, color }) => {
    const nextRoot = updateNodeInTree(document.root, nodeId, (n) => {
      const existing = (n as { style?: AppearanceModel }).style ?? {}
      return { ...n, style: { ...existing, fill: { kind: 'solid' as const, color } } }
    })
    return {
      label: 'Update Fill',
      selectionIds: [nodeId],
      document: { ...document, updatedAt: new Date().toISOString(), root: nextRoot as typeof document.root }
    }
  }
}

export const updateNodeStrokeCommand: EditorCommand<{ nodeId: string; stroke: StrokeModel }> = {
  id: 'document.updateNodeStroke',
  label: 'Update Stroke',
  run: ({ document }, { nodeId, stroke }) => {
    const nextRoot = updateNodeInTree(document.root, nodeId, (n) => {
      const existing = (n as { style?: AppearanceModel }).style ?? {}
      return { ...n, style: { ...existing, stroke } }
    })
    return {
      label: 'Update Stroke',
      selectionIds: [nodeId],
      document: { ...document, updatedAt: new Date().toISOString(), root: nextRoot as typeof document.root }
    }
  }
}

export const groupSelectionCommand: EditorCommand<{ nodeIds: string[] }> = {
  id: 'document.groupSelection',
  label: 'Group Selection',
  run: ({ document }, payload) => {
    const result = groupSelection(document, payload.nodeIds)
    if (!result) {
      return {
        label: 'Group Selection',
        document,
        selectionIds: payload.nodeIds
      }
    }

    return {
      label: 'Group Selection',
      document: result.document,
      selectionIds: result.selectionIds
    }
  }
}

export const ungroupSelectionCommand: EditorCommand<{ nodeIds: string[] }> = {
  id: 'document.ungroupSelection',
  label: 'Ungroup Selection',
  run: ({ document }, payload) => {
    const result = ungroupSelection(document, payload.nodeIds)
    if (!result) {
      return {
        label: 'Ungroup Selection',
        document,
        selectionIds: payload.nodeIds
      }
    }

    return {
      label: 'Ungroup Selection',
      document: result.document,
      selectionIds: result.selectionIds
    }
  }
}

export const moveNodeOutOfGroupCommand: EditorCommand<{ nodeId: string }> = {
  id: 'document.moveNodeOutOfGroup',
  label: 'Move Out of Group',
  run: ({ document }, { nodeId }) => {
    const parentInfo = getParentInfo(document.root, nodeId)
    if (!parentInfo || parentInfo.parent.type === 'root') {
      return { label: 'Move Out of Group', selectionIds: [nodeId], document }
    }
    const node = parentInfo.parent.children.find((c) => c.id === nodeId)!
    const newParentChildren = parentInfo.parent.children.filter((c) => c.id !== nodeId)
    const tempRoot = replaceChildrenInTree(document.root, parentInfo.parent.id, newParentChildren) as RootNode
    const grandParentInfo = getParentInfo(tempRoot, parentInfo.parent.id)
    if (!grandParentInfo) return { label: 'Move Out of Group', selectionIds: [nodeId], document }
    const groupIndex = grandParentInfo.parent.children.findIndex((c) => c.id === parentInfo.parent.id)
    const newGrandChildren = [
      ...grandParentInfo.parent.children.slice(0, groupIndex + 1),
      node,
      ...grandParentInfo.parent.children.slice(groupIndex + 1)
    ]
    const nextRoot = replaceChildrenInTree(tempRoot, grandParentInfo.parent.id, newGrandChildren) as RootNode
    return {
      label: 'Move Out of Group',
      selectionIds: [nodeId],
      document: { ...document, updatedAt: new Date().toISOString(), root: nextRoot }
    }
  }
}

export const moveNodesIntoGroupCommand: EditorCommand<{ nodeIds: string[]; targetGroupId: string }> = {
  id: 'document.moveNodesIntoGroup',
  label: 'Move Into Group',
  run: ({ document }, { nodeIds, targetGroupId }) => {
    let nextRoot: SvgNode = document.root
    const collected: SvgNode[] = []

    for (const nodeId of nodeIds) {
      if (nodeId === targetGroupId) continue
      const parentInfo = getParentInfo(nextRoot, nodeId)
      if (!parentInfo) continue
      const node = parentInfo.parent.children.find((c) => c.id === nodeId)
      if (!node) continue
      collected.push(node)
      const newParentChildren = parentInfo.parent.children.filter((c) => c.id !== nodeId)
      nextRoot = replaceChildrenInTree(nextRoot, parentInfo.parent.id, newParentChildren)
    }

    if (!collected.length) return { label: 'Move Into Group', selectionIds: nodeIds, document }
    const targetNode = getNodeInTree(nextRoot, targetGroupId)
    if (!targetNode || targetNode.type !== 'group') {
      return { label: 'Move Into Group', selectionIds: nodeIds, document }
    }
    const newTargetChildren = [...(targetNode.children ?? []), ...collected]
    nextRoot = replaceChildrenInTree(nextRoot, targetGroupId, newTargetChildren)
    return {
      label: 'Move Into Group',
      selectionIds: collected.map((n) => n.id),
      document: { ...document, updatedAt: new Date().toISOString(), root: nextRoot as RootNode }
    }
  }
}
