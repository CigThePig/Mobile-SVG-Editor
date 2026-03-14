import { nanoid } from 'nanoid'
import type { SvgDocument } from '@/model/document/documentTypes'
import type { GroupNode, RootNode, SvgNode, RectNode } from '@/model/nodes/nodeTypes'
import type { EditorCommand } from './commands'

function isContainerNode(node: SvgNode): node is RootNode | GroupNode {
  return node.type === 'root' || node.type === 'group'
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

function foldTransformIntoChild(child: SvgNode, groupTransform?: GroupNode['transform']): SvgNode {
  if (!groupTransform) return child

  return {
    ...child,
    transform: {
      ...child.transform,
      translateX: (child.transform?.translateX ?? 0) + (groupTransform.translateX ?? 0),
      translateY: (child.transform?.translateY ?? 0) + (groupTransform.translateY ?? 0),
      rotate: (child.transform?.rotate ?? 0) + (groupTransform.rotate ?? 0),
      scaleX: (child.transform?.scaleX ?? 1) * (groupTransform.scaleX ?? 1),
      scaleY: (child.transform?.scaleY ?? 1) * (groupTransform.scaleY ?? 1),
      skewX: (child.transform?.skewX ?? 0) + (groupTransform.skewX ?? 0),
      skewY: (child.transform?.skewY ?? 0) + (groupTransform.skewY ?? 0),
      pivotX: groupTransform.pivotX ?? child.transform?.pivotX,
      pivotY: groupTransform.pivotY ?? child.transform?.pivotY
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
