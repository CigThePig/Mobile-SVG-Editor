import type { SvgDocument } from '@/model/document/documentTypes'
import type {
  CircleNode,
  EllipseNode,
  GroupNode,
  ImageNode,
  LineNode,
  PathNode,
  PolygonNode,
  PolylineNode,
  RectNode,
  RootNode,
  SvgNode,
  TextNode
} from '@/model/nodes/nodeTypes'
import { getNodeBounds, normalizeBounds, type NodeBounds } from '@/features/selection/utils/nodeBounds'

export function cloneDocument<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function translatePoints(points: Array<{ x: number; y: number }>, dx: number, dy: number) {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }))
}

function translatePathData(d: string, dx: number, dy: number) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g)
  if (!tokens) return d

  const out: string[] = []
  let currentCommand = ''
  let expectX = false
  let expectY = false
  let relative = false

  for (const token of tokens) {
    if (/^[a-zA-Z]$/.test(token)) {
      currentCommand = token
      relative = token === token.toLowerCase()
      const upper = token.toUpperCase()
      expectX = ['M', 'L', 'T'].includes(upper)
      expectY = false
      out.push(token)
      continue
    }

    const value = Number(token)
    if (!Number.isFinite(value) || relative || !currentCommand) {
      out.push(token)
      continue
    }

    const upper = currentCommand.toUpperCase()
    if (upper === 'H') {
      out.push(String(value + dx))
      continue
    }
    if (upper === 'V') {
      out.push(String(value + dy))
      continue
    }

    if (['M', 'L', 'T'].includes(upper)) {
      if (expectX) {
        out.push(String(value + dx))
        expectX = false
        expectY = true
      } else if (expectY) {
        out.push(String(value + dy))
        expectX = true
        expectY = false
      } else {
        out.push(token)
      }
      continue
    }

    if (['S', 'Q', 'C'].includes(upper)) {
      if (!expectX && !expectY) expectX = true
      if (expectX) {
        out.push(String(value + dx))
        expectX = false
        expectY = true
      } else if (expectY) {
        out.push(String(value + dy))
        expectX = true
        expectY = false
      }
      continue
    }

    out.push(token)
  }

  return out.join(' ')
}

function scaleX(x: number, oldBounds: NodeBounds, newBounds: NodeBounds) {
  const width = oldBounds.width === 0 ? 1 : oldBounds.width
  return newBounds.x + ((x - oldBounds.x) / width) * newBounds.width
}

function scaleY(y: number, oldBounds: NodeBounds, newBounds: NodeBounds) {
  const height = oldBounds.height === 0 ? 1 : oldBounds.height
  return newBounds.y + ((y - oldBounds.y) / height) * newBounds.height
}

function scalePoints(points: Array<{ x: number; y: number }>, oldBounds: NodeBounds, newBounds: NodeBounds) {
  return points.map((point) => ({
    x: scaleX(point.x, oldBounds, newBounds),
    y: scaleY(point.y, oldBounds, newBounds)
  }))
}

function scalePathData(d: string, oldBounds: NodeBounds, newBounds: NodeBounds) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g)
  if (!tokens) return d

  const out: string[] = []
  let currentCommand = ''
  let relative = false
  let pairToggle = true
  let arcIndex = 0

  for (const token of tokens) {
    if (/^[a-zA-Z]$/.test(token)) {
      currentCommand = token
      relative = token === token.toLowerCase()
      pairToggle = true
      arcIndex = 0
      out.push(token)
      continue
    }

    const value = Number(token)
    if (!Number.isFinite(value) || !currentCommand || relative) {
      out.push(token)
      continue
    }

    const upper = currentCommand.toUpperCase()
    if (upper === 'H') {
      out.push(String(scaleX(value, oldBounds, newBounds)))
      continue
    }
    if (upper === 'V') {
      out.push(String(scaleY(value, oldBounds, newBounds)))
      continue
    }
    if (['M', 'L', 'T', 'S', 'Q', 'C'].includes(upper)) {
      out.push(String(pairToggle ? scaleX(value, oldBounds, newBounds) : scaleY(value, oldBounds, newBounds)))
      pairToggle = !pairToggle
      continue
    }
    if (upper === 'A') {
      if (arcIndex === 0) {
        out.push(String((value / Math.max(1, oldBounds.width)) * newBounds.width))
      } else if (arcIndex === 1) {
        out.push(String((value / Math.max(1, oldBounds.height)) * newBounds.height))
      } else if (arcIndex === 5) {
        out.push(String(scaleX(value, oldBounds, newBounds)))
      } else if (arcIndex === 6) {
        out.push(String(scaleY(value, oldBounds, newBounds)))
      } else {
        out.push(token)
      }
      arcIndex = (arcIndex + 1) % 7
      continue
    }

    out.push(token)
  }

  return out.join(' ')
}

function moveNode(node: SvgNode, dx: number, dy: number): SvgNode {
  switch (node.type) {
    case 'rect': {
      const n = node as RectNode
      return { ...n, x: n.x + dx, y: n.y + dy }
    }
    case 'circle': {
      const n = node as CircleNode
      return { ...n, cx: n.cx + dx, cy: n.cy + dy }
    }
    case 'ellipse': {
      const n = node as EllipseNode
      return { ...n, cx: n.cx + dx, cy: n.cy + dy }
    }
    case 'line': {
      const n = node as LineNode
      return { ...n, x1: n.x1 + dx, y1: n.y1 + dy, x2: n.x2 + dx, y2: n.y2 + dy }
    }
    case 'polyline': {
      const n = node as PolylineNode
      return { ...n, points: translatePoints(n.points, dx, dy) }
    }
    case 'polygon': {
      const n = node as PolygonNode
      return { ...n, points: translatePoints(n.points, dx, dy) }
    }
    case 'path': {
      const n = node as PathNode
      return { ...n, d: translatePathData(n.d, dx, dy) }
    }
    case 'text': {
      const n = node as TextNode
      return { ...n, x: n.x + dx, y: n.y + dy }
    }
    case 'image': {
      const n = node as ImageNode
      return { ...n, x: n.x + dx, y: n.y + dy }
    }
    case 'group': {
      const n = node as GroupNode
      return { ...n, children: (n.children ?? []).map((child) => moveNode(child, dx, dy)) }
    }
    case 'root': {
      const n = node as RootNode
      return { ...n, children: (n.children ?? []).map((child) => moveNode(child, dx, dy)) }
    }
    default:
      return node
  }
}

function resizeNode(node: SvgNode, oldBounds: NodeBounds, targetBounds: NodeBounds): SvgNode {
  const newBounds = normalizeBounds(targetBounds)

  switch (node.type) {
    case 'rect': {
      const n = node as RectNode
      return { ...n, x: newBounds.x, y: newBounds.y, width: newBounds.width, height: newBounds.height }
    }
    case 'circle': {
      const size = Math.min(newBounds.width, newBounds.height)
      return {
        ...(node as CircleNode),
        cx: newBounds.x + newBounds.width / 2,
        cy: newBounds.y + newBounds.height / 2,
        r: size / 2
      }
    }
    case 'ellipse': {
      return {
        ...(node as EllipseNode),
        cx: newBounds.x + newBounds.width / 2,
        cy: newBounds.y + newBounds.height / 2,
        rx: newBounds.width / 2,
        ry: newBounds.height / 2
      }
    }
    case 'line': {
      const n = node as LineNode
      return {
        ...n,
        x1: scaleX(n.x1, oldBounds, newBounds),
        y1: scaleY(n.y1, oldBounds, newBounds),
        x2: scaleX(n.x2, oldBounds, newBounds),
        y2: scaleY(n.y2, oldBounds, newBounds)
      }
    }
    case 'polyline': {
      const n = node as PolylineNode
      return { ...n, points: scalePoints(n.points, oldBounds, newBounds) }
    }
    case 'polygon': {
      const n = node as PolygonNode
      return { ...n, points: scalePoints(n.points, oldBounds, newBounds) }
    }
    case 'path': {
      const n = node as PathNode
      return { ...n, d: scalePathData(n.d, oldBounds, newBounds) }
    }
    case 'text': {
      const n = node as TextNode
      const fontSize = n.textStyle?.fontSize ?? 16
      const scaledFontSize = Math.max(4, (fontSize / Math.max(1, oldBounds.height)) * newBounds.height)
      return {
        ...n,
        x: newBounds.x,
        y: newBounds.y + newBounds.height,
        textStyle: {
          ...n.textStyle,
          fontSize: scaledFontSize
        }
      }
    }
    case 'image': {
      const n = node as ImageNode
      return {
        ...n,
        x: newBounds.x,
        y: newBounds.y,
        width: newBounds.width,
        height: newBounds.height
      }
    }
    case 'group': {
      const n = node as GroupNode
      return {
        ...n,
        children: (n.children ?? []).map((child) => {
          const childBounds = getNodeBounds(child)
          if (!childBounds) return child
          const mappedBounds = normalizeBounds({
            x: scaleX(childBounds.x, oldBounds, newBounds),
            y: scaleY(childBounds.y, oldBounds, newBounds),
            width: (childBounds.width / Math.max(1, oldBounds.width)) * newBounds.width,
            height: (childBounds.height / Math.max(1, oldBounds.height)) * newBounds.height
          })
          return resizeNode(child, childBounds, mappedBounds)
        })
      }
    }
    case 'root': {
      const n = node as RootNode
      return {
        ...n,
        children: (n.children ?? []).map((child) => {
          const childBounds = getNodeBounds(child)
          if (!childBounds) return child
          const mappedBounds = normalizeBounds({
            x: scaleX(childBounds.x, oldBounds, newBounds),
            y: scaleY(childBounds.y, oldBounds, newBounds),
            width: (childBounds.width / Math.max(1, oldBounds.width)) * newBounds.width,
            height: (childBounds.height / Math.max(1, oldBounds.height)) * newBounds.height
          })
          return resizeNode(child, childBounds, mappedBounds)
        })
      }
    }
    default:
      return node
  }
}

function rotatePoint(point: { x: number; y: number }, center: { x: number; y: number }, degrees: number) {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  }
}

function rotateNodeAroundPivot(node: SvgNode, deltaDegrees: number, pivot: { x: number; y: number }): SvgNode {
  const nodeBounds = getNodeBounds(node)
  const currentCenter = nodeBounds
    ? { x: nodeBounds.x + nodeBounds.width / 2, y: nodeBounds.y + nodeBounds.height / 2 }
    : pivot
  const nextCenter = rotatePoint(currentCenter, pivot, deltaDegrees)
  const currentTranslateX = node.transform?.translateX ?? 0
  const currentTranslateY = node.transform?.translateY ?? 0
  const currentRotate = node.transform?.rotate ?? 0

  return {
    ...node,
    transform: {
      ...node.transform,
      translateX: currentTranslateX + (nextCenter.x - currentCenter.x),
      translateY: currentTranslateY + (nextCenter.y - currentCenter.y),
      rotate: currentRotate + deltaDegrees,
      pivotX: currentCenter.x,
      pivotY: currentCenter.y
    }
  }
}

function mapNodeTree(nodes: SvgNode[], targetIds: Set<string>, mapper: (node: SvgNode) => SvgNode): SvgNode[] {
  return nodes.map((node) => {
    if (targetIds.has(node.id)) return mapper(node)
    if (node.children?.length) {
      return {
        ...node,
        children: mapNodeTree(node.children, targetIds, mapper)
      }
    }
    return node
  })
}

export function moveNodeInDocument(document: SvgDocument, nodeId: string, dx: number, dy: number): SvgDocument {
  return moveNodesInDocument(document, [nodeId], dx, dy)
}

export function moveNodesInDocument(document: SvgDocument, nodeIds: string[], dx: number, dy: number): SvgDocument {
  const targetIds = new Set(nodeIds)
  return {
    ...document,
    updatedAt: new Date().toISOString(),
    root: {
      ...document.root,
      children: mapNodeTree(document.root.children ?? [], targetIds, (node) => moveNode(node, dx, dy))
    }
  }
}

export function resizeNodeInDocument(document: SvgDocument, nodeId: string, targetBounds: NodeBounds): SvgDocument {
  return resizeNodesInDocument(document, [nodeId], targetBounds)
}

export function resizeNodesInDocument(document: SvgDocument, nodeIds: string[], targetBounds: NodeBounds, sourceGroupBounds?: NodeBounds): SvgDocument {
  const targetIds = new Set(nodeIds)
  const boundsById = new Map<string, NodeBounds>()
  const normalizedTarget = normalizeBounds(targetBounds)

  for (const nodeId of nodeIds) {
    const node = getNodeById(document.root, nodeId)
    const nodeBounds = node ? getNodeBounds(node) : null
    if (node && nodeBounds) boundsById.set(nodeId, nodeBounds)
  }

  const groupBounds = sourceGroupBounds ?? normalizeBounds({
    x: Math.min(...Array.from(boundsById.values()).map((b) => b.x)),
    y: Math.min(...Array.from(boundsById.values()).map((b) => b.y)),
    width: Math.max(...Array.from(boundsById.values()).map((b) => b.x + b.width)) - Math.min(...Array.from(boundsById.values()).map((b) => b.x)),
    height: Math.max(...Array.from(boundsById.values()).map((b) => b.y + b.height)) - Math.min(...Array.from(boundsById.values()).map((b) => b.y))
  })

  return {
    ...document,
    updatedAt: new Date().toISOString(),
    root: {
      ...document.root,
      children: mapNodeTree(document.root.children ?? [], targetIds, (node) => {
        const oldBounds = boundsById.get(node.id) ?? getNodeBounds(node)
        if (!oldBounds) return node
        if (nodeIds.length === 1) return resizeNode(node, oldBounds, normalizedTarget)
        const mappedBounds = normalizeBounds({
          x: scaleX(oldBounds.x, groupBounds, normalizedTarget),
          y: scaleY(oldBounds.y, groupBounds, normalizedTarget),
          width: (oldBounds.width / Math.max(1, groupBounds.width)) * normalizedTarget.width,
          height: (oldBounds.height / Math.max(1, groupBounds.height)) * normalizedTarget.height
        })
        return resizeNode(node, oldBounds, mappedBounds)
      })
    }
  }
}

export function rotateNodeInDocument(
  document: SvgDocument,
  nodeId: string,
  angle: number,
  pivot: { x: number; y: number }
): SvgDocument {
  const node = getNodeById(document.root, nodeId)
  const current = node?.transform?.rotate ?? 0
  return rotateNodesInDocument(document, [nodeId], angle - current, pivot)
}

export function rotateNodesInDocument(
  document: SvgDocument,
  nodeIds: string[],
  deltaDegrees: number,
  pivot: { x: number; y: number }
): SvgDocument {
  const targetIds = new Set(nodeIds)
  return {
    ...document,
    updatedAt: new Date().toISOString(),
    root: {
      ...document.root,
      children: mapNodeTree(document.root.children ?? [], targetIds, (node) => rotateNodeAroundPivot(node, deltaDegrees, pivot))
    }
  }
}

export function getNodeById(node: SvgNode, nodeId: string): SvgNode | undefined {
  if (node.id === nodeId) return node
  for (const child of node.children ?? []) {
    const match = getNodeById(child, nodeId)
    if (match) return match
  }
  return undefined
}
