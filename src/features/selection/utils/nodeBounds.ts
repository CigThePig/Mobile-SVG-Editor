import type {
  CircleNode,
  EllipseNode,
  LineNode,
  PathNode,
  PolygonNode,
  PolylineNode,
  RectNode,
  SvgNode,
  TextNode,
  TransformModel
} from '@/model/nodes/nodeTypes'

export interface NodeBounds {
  x: number
  y: number
  width: number
  height: number
}

function fromPoints(points: Array<{ x: number; y: number }>): NodeBounds | null {
  if (!points.length) return null
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function approxPathBounds(d: string): NodeBounds | null {
  const matches = d.match(/-?\d*\.?\d+/g)
  if (!matches || matches.length < 2) return null
  const nums = matches.map(Number)
  const points: Array<{ x: number; y: number }> = []
  for (let i = 0; i < nums.length - 1; i += 2) points.push({ x: nums[i], y: nums[i + 1] })
  return fromPoints(points)
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

function transformBounds(bounds: NodeBounds, transform?: TransformModel): NodeBounds {
  if (!transform) return bounds

  const translateX = transform.translateX ?? 0
  const translateY = transform.translateY ?? 0
  const scaleX = transform.scaleX ?? 1
  const scaleY = transform.scaleY ?? 1
  const rotate = transform.rotate ?? 0

  const pivot = {
    x: transform.pivotX ?? bounds.x + bounds.width / 2,
    y: transform.pivotY ?? bounds.y + bounds.height / 2
  }

  let points = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height }
  ]

  points = points.map((point) => ({
    x: pivot.x + (point.x - pivot.x) * scaleX,
    y: pivot.y + (point.y - pivot.y) * scaleY
  }))

  if (rotate) {
    points = points.map((point) => rotatePoint(point, pivot, rotate))
  }

  points = points.map((point) => ({
    x: point.x + translateX,
    y: point.y + translateY
  }))

  return fromPoints(points) ?? bounds
}

function getBaseNodeBounds(node: SvgNode): NodeBounds | null {
  switch (node.type) {
    case 'rect': {
      const n = node as RectNode
      return { x: n.x, y: n.y, width: n.width, height: n.height }
    }
    case 'circle': {
      const n = node as CircleNode
      return { x: n.cx - n.r, y: n.cy - n.r, width: n.r * 2, height: n.r * 2 }
    }
    case 'ellipse': {
      const n = node as EllipseNode
      return { x: n.cx - n.rx, y: n.cy - n.ry, width: n.rx * 2, height: n.ry * 2 }
    }
    case 'line': {
      const n = node as LineNode
      return {
        x: Math.min(n.x1, n.x2),
        y: Math.min(n.y1, n.y2),
        width: Math.abs(n.x2 - n.x1),
        height: Math.abs(n.y2 - n.y1)
      }
    }
    case 'polyline':
      return fromPoints((node as PolylineNode).points)
    case 'polygon':
      return fromPoints((node as PolygonNode).points)
    case 'path':
      return approxPathBounds((node as PathNode).d)
    case 'text': {
      const n = node as TextNode
      const fontSize = n.textStyle?.fontSize ?? 16
      const width = Math.max(40, n.content.length * fontSize * 0.6)
      return { x: n.x, y: n.y - fontSize, width, height: fontSize * 1.2 }
    }
    case 'group':
    case 'root': {
      const childBounds = (node.children ?? []).map(getNodeBounds).filter(Boolean) as NodeBounds[]
      return combineBounds(childBounds)
    }
    default:
      return null
  }
}

export function getNodeBounds(node: SvgNode): NodeBounds | null {
  const baseBounds = getBaseNodeBounds(node)
  if (!baseBounds) return null
  return transformBounds(baseBounds, node.transform)
}

export function combineBounds(boundsList: NodeBounds[]): NodeBounds | null {
  if (!boundsList.length) return null
  const minX = Math.min(...boundsList.map((b) => b.x))
  const minY = Math.min(...boundsList.map((b) => b.y))
  const maxX = Math.max(...boundsList.map((b) => b.x + b.width))
  const maxY = Math.max(...boundsList.map((b) => b.y + b.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function getBoundsForNodes(nodes: SvgNode[]): NodeBounds | null {
  return combineBounds(nodes.map(getNodeBounds).filter(Boolean) as NodeBounds[])
}

export function normalizeBounds(bounds: NodeBounds): NodeBounds {
  const x = bounds.width >= 0 ? bounds.x : bounds.x + bounds.width
  const y = bounds.height >= 0 ? bounds.y : bounds.y + bounds.height
  return {
    x,
    y,
    width: Math.max(1, Math.abs(bounds.width)),
    height: Math.max(1, Math.abs(bounds.height))
  }
}

export function boundsIntersect(a: NodeBounds, b: NodeBounds): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y
}

export function collectSelectableNodes(root: SvgNode): SvgNode[] {
  return root.children ?? []
}
