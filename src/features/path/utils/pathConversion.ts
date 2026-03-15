/**
 * Conversion of SVG primitive nodes to path data strings.
 * Preserves the visual appearance as faithfully as possible.
 */

import type {
  RectNode,
  CircleNode,
  EllipseNode,
  LineNode,
  PolylineNode,
  PolygonNode,
  StarNode,
  SvgNode
} from '@/model/nodes/nodeTypes'

/** Round helper to avoid floating-point noise in output */
function r(v: number): string {
  return String(Math.round(v * 10000) / 10000)
}

// ── Rectangle ────────────────────────────────────────────────────────────────

/**
 * Convert a rect (with optional rounded corners) to a path.
 * Uses arc commands to represent rounded corners.
 */
export function rectToPathD(node: RectNode): string {
  const { x, y, width, height } = node
  const rx = node.rx ?? 0
  const ry = node.ry ?? rx

  if (rx <= 0 || ry <= 0) {
    // Simple rectangle
    return `M ${r(x)} ${r(y)} L ${r(x + width)} ${r(y)} L ${r(x + width)} ${r(y + height)} L ${r(x)} ${r(y + height)} Z`
  }

  // Clamped radii
  const crx = Math.min(rx, width / 2)
  const cry = Math.min(ry, height / 2)

  // Rectangle with rounded corners via arc commands
  return [
    `M ${r(x + crx)} ${r(y)}`,
    `L ${r(x + width - crx)} ${r(y)}`,
    `A ${r(crx)} ${r(cry)} 0 0 1 ${r(x + width)} ${r(y + cry)}`,
    `L ${r(x + width)} ${r(y + height - cry)}`,
    `A ${r(crx)} ${r(cry)} 0 0 1 ${r(x + width - crx)} ${r(y + height)}`,
    `L ${r(x + crx)} ${r(y + height)}`,
    `A ${r(crx)} ${r(cry)} 0 0 1 ${r(x)} ${r(y + height - cry)}`,
    `L ${r(x)} ${r(y + cry)}`,
    `A ${r(crx)} ${r(cry)} 0 0 1 ${r(x + crx)} ${r(y)}`,
    `Z`
  ].join(' ')
}

// ── Ellipse ───────────────────────────────────────────────────────────────────

/**
 * Convert an ellipse to a path using two arcs.
 * Using near-duplicate endpoints to avoid "zero-length arc" issues.
 */
export function ellipseToPathD(node: EllipseNode): string {
  const { cx, cy, rx, ry } = node
  // Two arc commands for a full ellipse
  const top = cy - ry
  const bottom = cy + ry
  return [
    `M ${r(cx)} ${r(top)}`,
    `A ${r(rx)} ${r(ry)} 0 1 1 ${r(cx)} ${r(bottom)}`,
    `A ${r(rx)} ${r(ry)} 0 1 1 ${r(cx)} ${r(top)}`,
    `Z`
  ].join(' ')
}

// ── Circle ────────────────────────────────────────────────────────────────────

export function circleToPathD(node: CircleNode): string {
  return ellipseToPathD({ ...node, type: 'ellipse', rx: node.r, ry: node.r })
}

// ── Line ──────────────────────────────────────────────────────────────────────

export function lineToPathD(node: LineNode): string {
  return `M ${r(node.x1)} ${r(node.y1)} L ${r(node.x2)} ${r(node.y2)}`
}

// ── Polyline ──────────────────────────────────────────────────────────────────

export function polylineToPathD(node: PolylineNode): string {
  if (node.points.length === 0) return ''
  const [first, ...rest] = node.points
  const parts = [`M ${r(first.x)} ${r(first.y)}`]
  for (const pt of rest) {
    parts.push(`L ${r(pt.x)} ${r(pt.y)}`)
  }
  return parts.join(' ')
}

// ── Polygon ───────────────────────────────────────────────────────────────────

export function polygonToPathD(node: PolygonNode): string {
  if (node.points.length === 0) return ''
  const [first, ...rest] = node.points
  const parts = [`M ${r(first.x)} ${r(first.y)}`]
  for (const pt of rest) {
    parts.push(`L ${r(pt.x)} ${r(pt.y)}`)
  }
  parts.push('Z')
  return parts.join(' ')
}

// ── Star ──────────────────────────────────────────────────────────────────────

export function starToPathD(node: StarNode): string {
  const { cx, cy, outerRadius, innerRadius, numPoints } = node
  const points: Array<{ x: number; y: number }> = []
  for (let i = 0; i < numPoints * 2; i++) {
    const angle = (Math.PI * i) / numPoints - Math.PI / 2
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
  }
  if (points.length === 0) return ''
  const [first, ...rest] = points
  const parts = [`M ${r(first.x)} ${r(first.y)}`]
  for (const pt of rest) {
    parts.push(`L ${r(pt.x)} ${r(pt.y)}`)
  }
  parts.push('Z')
  return parts.join(' ')
}

// ── Generic dispatch ──────────────────────────────────────────────────────────

/**
 * Convert any supported primitive node to an SVG path string.
 * Returns null for nodes that cannot be converted (e.g. text, image, group).
 */
export function nodeToPathD(node: SvgNode): string | null {
  switch (node.type) {
    case 'rect':     return rectToPathD(node as RectNode)
    case 'circle':   return circleToPathD(node as CircleNode)
    case 'ellipse':  return ellipseToPathD(node as EllipseNode)
    case 'line':     return lineToPathD(node as LineNode)
    case 'polyline': return polylineToPathD(node as PolylineNode)
    case 'polygon':  return polygonToPathD(node as PolygonNode)
    case 'star':     return starToPathD(node as StarNode)
    case 'path':     return (node as { d: string }).d
    default:         return null
  }
}

/** Whether a node type can be converted to a path */
export function isConvertibleToPath(node: SvgNode): boolean {
  return ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'star', 'path'].includes(node.type)
}
