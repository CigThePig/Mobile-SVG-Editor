import type {
  CircleNode,
  EllipseNode,
  LineNode,
  PathNode,
  PolygonNode,
  PolylineNode,
  RectNode,
  StarNode,
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

/**
 * Compute approximate bounds for an SVG path by parsing its commands.
 * Collects all absolute endpoints and control points as candidate extrema.
 * Relative commands are not translated (approximation), but absolute commands
 * and the final endpoint of each command are correctly handled.
 * Arc bounds use only endpoints + bounding circle approximation.
 */
function approxPathBounds(d: string): NodeBounds | null {
  // Tokenise into command letters and numeric values
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[+-]?\d+)?/gi)
  if (!tokens) return null

  const points: Array<{ x: number; y: number }> = []
  let cx = 0
  let cy = 0
  let cmd = 'M'
  let i = 0

  function num(): number {
    // tokens is guaranteed non-null here: checked via `if (!tokens) return null` above,
    // but TypeScript's control-flow narrowing doesn't carry into closures.
    return Number(tokens![i++] ?? 0)
  }

  while (i < tokens.length) {
    const token = tokens[i]
    if (/^[a-zA-Z]$/.test(token ?? '')) {
      cmd = token ?? cmd
      i++
    }

    const upper = cmd.toUpperCase()
    const rel = cmd === cmd.toLowerCase() && cmd !== 'Z' && cmd !== 'z'

    if (upper === 'Z') {
      // No coordinates
      continue
    }

    if (upper === 'M' || upper === 'L' || upper === 'T') {
      const x = num()
      const y = num()
      cx = rel ? cx + x : x
      cy = rel ? cy + y : y
      points.push({ x: cx, y: cy })
      // Implicit subsequent coords use L/l
      cmd = rel ? 'l' : 'L'
      continue
    }

    if (upper === 'H') {
      const x = num()
      cx = rel ? cx + x : x
      points.push({ x: cx, y: cy })
      continue
    }

    if (upper === 'V') {
      const y = num()
      cy = rel ? cy + y : y
      points.push({ x: cx, y: cy })
      continue
    }

    if (upper === 'L') {
      const x = num()
      const y = num()
      cx = rel ? cx + x : x
      cy = rel ? cy + y : y
      points.push({ x: cx, y: cy })
      continue
    }

    if (upper === 'C') {
      // cubic bezier: x1 y1 x2 y2 x y
      const x1 = num(); const y1 = num()
      const x2 = num(); const y2 = num()
      const x = num(); const y = num()
      // Include control points as conservative overestimate of bounds
      points.push(
        { x: rel ? cx + x1 : x1, y: rel ? cy + y1 : y1 },
        { x: rel ? cx + x2 : x2, y: rel ? cy + y2 : y2 }
      )
      cx = rel ? cx + x : x
      cy = rel ? cy + y : y
      points.push({ x: cx, y: cy })
      continue
    }

    if (upper === 'S' || upper === 'Q') {
      // smooth cubic / quadratic: x1 y1 x y
      const x1 = num(); const y1 = num()
      const x = num(); const y = num()
      points.push({ x: rel ? cx + x1 : x1, y: rel ? cy + y1 : y1 })
      cx = rel ? cx + x : x
      cy = rel ? cy + y : y
      points.push({ x: cx, y: cy })
      continue
    }

    if (upper === 'A') {
      // arc: rx ry x-rotation large-arc-flag sweep-flag x y
      const rx = Math.abs(num())
      const ry = Math.abs(num())
      num() // x-rotation (ignored)
      num() // large-arc-flag (ignored)
      num() // sweep-flag (ignored)
      const x = num()
      const y = num()
      const ex = rel ? cx + x : x
      const ey = rel ? cy + y : y
      // Conservative: include a bounding diamond around the arc centre
      const midX = (cx + ex) / 2
      const midY = (cy + ey) / 2
      points.push(
        { x: midX - rx, y: midY },
        { x: midX + rx, y: midY },
        { x: midX, y: midY - ry },
        { x: midX, y: midY + ry },
        { x: ex, y: ey }
      )
      cx = ex
      cy = ey
      continue
    }

    // Unknown command — skip one token to avoid infinite loop
    i++
  }

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
    case 'star': {
      const n = node as StarNode
      return { x: n.cx - n.outerRadius, y: n.cy - n.outerRadius, width: n.outerRadius * 2, height: n.outerRadius * 2 }
    }
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

/**
 * Returns the bounds of a node in its own local coordinate space, before any
 * transform on the node itself is applied. This is the space in which
 * transform.pivotX/Y should be expressed for rotation.
 */
export function getLocalNodeBounds(node: SvgNode): NodeBounds | null {
  return getBaseNodeBounds(node)
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
