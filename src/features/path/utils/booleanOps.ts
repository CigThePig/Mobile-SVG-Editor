/**
 * Boolean shape operations (union, subtract, intersect, exclude).
 * Uses the polygon-clipping library which expects polygon ring coordinates.
 *
 * Limitations:
 * - Only works on filled closed paths. Open paths or non-closed shapes
 *   will throw a BooleanOpError.
 * - Stroke geometry is ignored (only fill area is considered).
 * - Arc / curve geometry is approximated by flattening to polygon segments.
 * - Groups in selection are not supported.
 */

import polygonClipping from 'polygon-clipping'
import { Bezier } from 'bezier-js'
import { nanoid } from 'nanoid'
import type { PathNode, SvgNode, AppearanceModel } from '@/model/nodes/nodeTypes'
import { parsePathD, serializePathD } from './pathGeometry'
import { nodeToPathD } from './pathConversion'

export class BooleanOpError extends Error {}

// ── Polygon format helpers ────────────────────────────────────────────────────

type Ring = [number, number][]
type Polygon = Ring[]
type MultiPolygon = Polygon[]

/**
 * Convert SVG path data to polygon-clipping Polygon format.
 * Flattens bezier curves by sampling them at ~1% intervals.
 */
function pathDToPolygon(d: string): Polygon {
  const parsed = parsePathD(d)
  const rings: Ring[] = []

  for (const subpath of parsed.subpaths) {
    const { anchors, closed } = subpath
    if (anchors.length < 2) continue

    const ring: Ring = []

    // Sample the path as line segments
    const allAnchors = closed ? [...anchors] : anchors
    const segCount = closed ? allAnchors.length : allAnchors.length - 1

    for (let si = 0; si < segCount; si++) {
      const from = allAnchors[si]
      const to = allAnchors[(si + 1) % allAnchors.length]

      const p0 = [from.x, from.y]
      const p1 = [from.h2x, from.h2y]
      const p2 = [to.h1x, to.h1y]
      const p3 = [to.x, to.y]

      // Sample bezier curve at N steps (adaptive: proportional to arc length)
      const isLine = Math.abs(p1[0] - p0[0]) < 1e-4 && Math.abs(p1[1] - p0[1]) < 1e-4 &&
                     Math.abs(p2[0] - p3[0]) < 1e-4 && Math.abs(p2[1] - p3[1]) < 1e-4
      const steps = isLine ? 1 : adaptiveSteps(p0, p1, p2, p3)

      for (let t = 0; t < steps; t++) {
        const u = t / steps
        ring.push(sampleCubic(p0, p1, p2, p3, u) as [number, number])
      }
    }

    // Close the ring
    if (ring.length > 0) {
      ring.push(ring[0])
    }

    if (ring.length >= 4) {
      rings.push(ring)
    }
  }

  if (rings.length === 0) {
    throw new BooleanOpError('Path has no closed geometry suitable for boolean operations')
  }

  return rings
}

/**
 * Compute the number of sampling steps for a cubic bezier segment based on
 * its arc length (via bezier-js). More steps for longer/curvier segments,
 * fewer for nearly-straight lines — instead of the previous fixed 20.
 * Range: 8–64 steps, approximately 1 sample per 4 SVG user units.
 */
function adaptiveSteps(p0: number[], p1: number[], p2: number[], p3: number[]): number {
  try {
    const b = new Bezier(
      { x: p0[0], y: p0[1] },
      { x: p1[0], y: p1[1] },
      { x: p2[0], y: p2[1] },
      { x: p3[0], y: p3[1] }
    )
    const length = b.length()
    return Math.max(8, Math.min(64, Math.ceil(length / 4)))
  } catch {
    return 20
  }
}

function sampleCubic(p0: number[], p1: number[], p2: number[], p3: number[], t: number): number[] {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
  ]
}

/**
 * Convert polygon-clipping MultiPolygon result back to SVG path data string.
 */
function multiPolygonToPathD(mp: MultiPolygon): string {
  const parts: string[] = []

  for (const polygon of mp) {
    for (let ri = 0; ri < polygon.length; ri++) {
      const ring = polygon[ri]
      if (ring.length < 2) continue

      // Skip the last point if it's a duplicate of the first (polygon-clipping closes rings)
      const pts = ring[ring.length - 1][0] === ring[0][0] && ring[ring.length - 1][1] === ring[0][1]
        ? ring.slice(0, -1)
        : ring.slice()

      if (pts.length < 2) continue

      const [firstPt] = pts
      parts.push(`M ${fmt(firstPt[0])} ${fmt(firstPt[1])}`)
      for (let i = 1; i < pts.length; i++) {
        parts.push(`L ${fmt(pts[i][0])} ${fmt(pts[i][1])}`)
      }
      parts.push('Z')
    }
  }

  return parts.join(' ')
}

function fmt(v: number): string {
  return String(Math.round(v * 100) / 100)
}

// ── Get path data from any node, converting if needed ────────────────────────

function getPathDataFromNode(node: SvgNode): string {
  const d = nodeToPathD(node)
  if (!d) throw new BooleanOpError(`Cannot convert node type "${node.type}" to path for boolean operation`)
  return d
}

// ── Boolean operations ────────────────────────────────────────────────────────

export type BooleanOpType = 'union' | 'subtract' | 'intersect' | 'exclude'

/**
 * Perform a boolean operation on 2+ nodes.
 * Returns a new PathNode (not inserted into document — caller handles that).
 *
 * For subtract: first node is the "base", rest are subtracted from it.
 * For union/intersect/exclude: all nodes are treated symmetrically.
 */
export function performBooleanOp(nodes: SvgNode[], op: BooleanOpType): PathNode {
  if (nodes.length < 2) {
    throw new BooleanOpError('Boolean operations require at least 2 shapes')
  }

  const primaryNode = nodes[0]
  const polygons: Polygon[] = nodes.map((n) => {
    const d = getPathDataFromNode(n)
    return pathDToPolygon(d)
  })

  let result: MultiPolygon
  const [first, ...rest] = polygons

  try {
    switch (op) {
      case 'union':
        result = polygonClipping.union(first, ...rest)
        break
      case 'subtract':
        result = polygonClipping.difference(first, ...rest)
        break
      case 'intersect':
        result = polygonClipping.intersection(first, ...rest)
        break
      case 'exclude':
        result = polygonClipping.xor(first, ...rest)
        break
    }
  } catch (e) {
    throw new BooleanOpError(`Boolean operation failed: ${String(e)}`)
  }

  if (!result || result.length === 0) {
    throw new BooleanOpError('Boolean operation produced empty result')
  }

  const d = multiPolygonToPathD(result)
  const primaryStyle = (primaryNode as { style?: AppearanceModel }).style

  const resultNode: PathNode = {
    id: nanoid(),
    type: 'path',
    name: `${op.charAt(0).toUpperCase() + op.slice(1)} Path`,
    visible: true,
    locked: false,
    d,
    style: primaryStyle ? { ...primaryStyle } : undefined
  }

  return resultNode
}
