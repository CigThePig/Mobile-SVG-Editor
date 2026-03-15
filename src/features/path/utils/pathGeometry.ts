/**
 * Internal structured path model for geometry editing.
 *
 * PathNode.d (SVG path string) remains the persisted/rendered format.
 * These types are used only in-memory during editing operations.
 *
 * ParsedPath ←→ d string via parsePathD / serializePathD.
 */

import { pathToAbsolute, arcToCubic, pathToString } from 'svg-path-commander'
import { nanoid } from 'nanoid'

// ── Types ──────────────────────────────────────────────────────────────────────

export type HandleMode = 'symmetric' | 'smooth' | 'corner'

export interface PathAnchor {
  /** Unique id within the ParsedPath (not stored in document) */
  id: string
  /** Anchor position in absolute document coordinates */
  x: number
  y: number
  /** In-handle: absolute position of the handle for the curve arriving at this anchor */
  h1x: number
  h1y: number
  /** Out-handle: absolute position of the handle for the curve leaving this anchor */
  h2x: number
  h2y: number
  /** How h1/h2 move relative to each other when the user drags one */
  handleMode: HandleMode
}

export interface PathSubpath {
  anchors: PathAnchor[]
  closed: boolean
}

export interface ParsedPath {
  subpaths: PathSubpath[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function samePoint(ax: number, ay: number, bx: number, by: number, eps = 1e-4): boolean {
  return Math.abs(ax - bx) < eps && Math.abs(ay - by) < eps
}

function inferHandleMode(h1x: number, h1y: number, h2x: number, h2y: number, ax: number, ay: number): HandleMode {
  // If both handles are at the anchor, it's a corner (line-to)
  if (samePoint(h1x, h1y, ax, ay) && samePoint(h2x, h2y, ax, ay)) return 'corner'

  // Check if handles are symmetric (same distance, opposite direction)
  const d1x = ax - h1x; const d1y = ay - h1y
  const d2x = h2x - ax; const d2y = h2y - ay
  const len1 = Math.sqrt(d1x * d1x + d1y * d1y)
  const len2 = Math.sqrt(d2x * d2x + d2y * d2y)

  if (len1 < 1e-6 || len2 < 1e-6) return 'smooth'

  // Check co-linear (dot product of unit vectors close to 1)
  const dot = (d1x / len1) * (d2x / len2) + (d1y / len1) * (d2y / len2)
  if (dot > 0.999) {
    if (Math.abs(len1 - len2) < 1e-3) return 'symmetric'
    return 'smooth'
  }

  return 'corner'
}

function makeAnchor(x: number, y: number, h1x = x, h1y = y, h2x = x, h2y = y): PathAnchor {
  return {
    id: nanoid(8),
    x, y, h1x, h1y, h2x, h2y,
    handleMode: inferHandleMode(h1x, h1y, h2x, h2y, x, y)
  }
}

// ── Parse d → ParsedPath ──────────────────────────────────────────────────────

type AbsSegment = [string, ...number[]]

/**
 * Parse an SVG path string into a structured ParsedPath for editing.
 * Uses svg-path-commander's pathToAbsolute to normalize, then converts
 * all segment types to anchor + handle representation.
 */
export function parsePathD(d: string): ParsedPath {
  if (!d || d.trim() === '') return { subpaths: [] }

  let absSegments: AbsSegment[]
  try {
    absSegments = pathToAbsolute(d) as AbsSegment[]
  } catch {
    return { subpaths: [] }
  }

  const subpaths: PathSubpath[] = []
  let currentSubpath: PathSubpath | null = null
  let curX = 0; let curY = 0
  let subpathStartX = 0; let subpathStartY = 0
  // For smooth cubic (S) and smooth quadratic (T)
  let prevCmd = ''
  let prevCp2x = 0; let prevCp2y = 0

  function ensureSubpath(): PathSubpath {
    if (!currentSubpath) {
      currentSubpath = { anchors: [], closed: false }
      subpaths.push(currentSubpath)
    }
    return currentSubpath
  }

  function prevAnchor(): PathAnchor | null {
    const sp = currentSubpath
    if (!sp || sp.anchors.length === 0) return null
    return sp.anchors[sp.anchors.length - 1]
  }

  for (const seg of absSegments) {
    const cmd = seg[0] as string

    switch (cmd) {
      case 'M': {
        const mx = seg[1] as number; const my = seg[2] as number
        subpathStartX = mx; subpathStartY = my
        currentSubpath = { anchors: [], closed: false }
        subpaths.push(currentSubpath)
        currentSubpath.anchors.push(makeAnchor(mx, my))
        curX = mx; curY = my
        break
      }

      case 'L': {
        const lx = seg[1] as number; const ly = seg[2] as number
        const sp = ensureSubpath()
        // Previous anchor's out-handle stays at anchor (line-to)
        sp.anchors.push(makeAnchor(lx, ly))
        curX = lx; curY = ly
        break
      }

      case 'H': {
        const hx = seg[1] as number
        const sp = ensureSubpath()
        sp.anchors.push(makeAnchor(hx, curY))
        curX = hx
        break
      }

      case 'V': {
        const vy = seg[1] as number
        const sp = ensureSubpath()
        sp.anchors.push(makeAnchor(curX, vy))
        curY = vy
        break
      }

      case 'C': {
        const cp1x = seg[1] as number; const cp1y = seg[2] as number
        const cp2x = seg[3] as number; const cp2y = seg[4] as number
        const ex = seg[5] as number; const ey = seg[6] as number
        const sp = ensureSubpath()
        // Set out-handle of previous anchor
        const prev = prevAnchor()
        if (prev) { prev.h2x = cp1x; prev.h2y = cp1y; prev.handleMode = inferHandleMode(prev.h1x, prev.h1y, cp1x, cp1y, prev.x, prev.y) }
        // Create new anchor with in-handle = cp2
        sp.anchors.push(makeAnchor(ex, ey, cp2x, cp2y, ex, ey))
        prevCp2x = cp2x; prevCp2y = cp2y
        curX = ex; curY = ey
        break
      }

      case 'S': {
        // Smooth cubic: cp1 is reflection of previous cp2
        const cp2x = seg[1] as number; const cp2y = seg[2] as number
        const ex = seg[3] as number; const ey = seg[4] as number
        const sp = ensureSubpath()
        let cp1x: number; let cp1y: number
        if (prevCmd === 'C' || prevCmd === 'S') {
          cp1x = 2 * curX - prevCp2x; cp1y = 2 * curY - prevCp2y
        } else {
          cp1x = curX; cp1y = curY
        }
        const prev = prevAnchor()
        if (prev) { prev.h2x = cp1x; prev.h2y = cp1y; prev.handleMode = inferHandleMode(prev.h1x, prev.h1y, cp1x, cp1y, prev.x, prev.y) }
        sp.anchors.push(makeAnchor(ex, ey, cp2x, cp2y, ex, ey))
        prevCp2x = cp2x; prevCp2y = cp2y
        curX = ex; curY = ey
        break
      }

      case 'Q': {
        // Quadratic → cubic: cp1 = p0 + 2/3*(q1-p0), cp2 = p3 + 2/3*(q1-p3)
        const qx = seg[1] as number; const qy = seg[2] as number
        const ex = seg[3] as number; const ey = seg[4] as number
        const cp1x = curX + (2 / 3) * (qx - curX)
        const cp1y = curY + (2 / 3) * (qy - curY)
        const cp2x = ex + (2 / 3) * (qx - ex)
        const cp2y = ey + (2 / 3) * (qy - ey)
        const sp = ensureSubpath()
        const prev = prevAnchor()
        if (prev) { prev.h2x = cp1x; prev.h2y = cp1y; prev.handleMode = inferHandleMode(prev.h1x, prev.h1y, cp1x, cp1y, prev.x, prev.y) }
        sp.anchors.push(makeAnchor(ex, ey, cp2x, cp2y, ex, ey))
        prevCp2x = qx; prevCp2y = qy // For smooth T
        curX = ex; curY = ey
        break
      }

      case 'T': {
        // Smooth quadratic
        const ex = seg[1] as number; const ey = seg[2] as number
        let qx: number; let qy: number
        if (prevCmd === 'Q' || prevCmd === 'T') {
          qx = 2 * curX - prevCp2x; qy = 2 * curY - prevCp2y
        } else {
          qx = curX; qy = curY
        }
        const cp1x = curX + (2 / 3) * (qx - curX)
        const cp1y = curY + (2 / 3) * (qy - curY)
        const cp2x = ex + (2 / 3) * (qx - ex)
        const cp2y = ey + (2 / 3) * (qy - ey)
        const sp = ensureSubpath()
        const prev = prevAnchor()
        if (prev) { prev.h2x = cp1x; prev.h2y = cp1y; prev.handleMode = inferHandleMode(prev.h1x, prev.h1y, cp1x, cp1y, prev.x, prev.y) }
        sp.anchors.push(makeAnchor(ex, ey, cp2x, cp2y, ex, ey))
        prevCp2x = qx; prevCp2y = qy
        curX = ex; curY = ey
        break
      }

      case 'A': {
        // Arc → cubic bezier via arcToCubic
        const rx = seg[1] as number; const ry = seg[2] as number
        const xRot = seg[3] as number; const large = seg[4] as number; const sweep = seg[5] as number
        const ex = seg[6] as number; const ey = seg[7] as number
        const sp = ensureSubpath()
        try {
          const cubics = arcToCubic(curX, curY, rx, ry, xRot, large, sweep, ex, ey)
          // cubics is flat [cp1x, cp1y, cp2x, cp2y, ex, ey, ...] repeated per segment
          let cx = curX; let cy = curY
          for (let i = 0; i < cubics.length; i += 6) {
            const cp1x = cubics[i] as number; const cp1y = cubics[i + 1] as number
            const cp2x = cubics[i + 2] as number; const cp2y = cubics[i + 3] as number
            const nx = cubics[i + 4] as number; const ny = cubics[i + 5] as number
            const prev = prevAnchor()
            if (prev) { prev.h2x = cp1x; prev.h2y = cp1y; prev.handleMode = inferHandleMode(prev.h1x, prev.h1y, cp1x, cp1y, prev.x, prev.y) }
            sp.anchors.push(makeAnchor(nx, ny, cp2x, cp2y, nx, ny))
            cx = nx; cy = ny
          }
          curX = cx; curY = cy
        } catch {
          // Arc conversion failed — fall back to a line
          sp.anchors.push(makeAnchor(ex, ey))
          curX = ex; curY = ey
        }
        break
      }

      case 'Z':
      case 'z': {
        if (currentSubpath) {
          currentSubpath.closed = true
          // If the last anchor is at the same position as the start, remove it (it's redundant)
          const anchors = currentSubpath.anchors
          if (anchors.length > 1) {
            const last = anchors[anchors.length - 1]
            const first = anchors[0]
            if (samePoint(last.x, last.y, first.x, first.y)) {
              // Transfer the out-handle of the near-duplicate to the first anchor's in-handle
              if (!samePoint(last.h1x, last.h1y, last.x, last.y)) {
                first.h1x = last.h1x; first.h1y = last.h1y
              }
              anchors.pop()
            }
          }
        }
        curX = subpathStartX; curY = subpathStartY
        currentSubpath = null // Force new subpath on next M
        break
      }

      default:
        break
    }

    prevCmd = cmd
  }

  return { subpaths: subpaths.filter((sp) => sp.anchors.length > 0) }
}

// ── Serialize ParsedPath → d string ──────────────────────────────────────────

/**
 * Convert a ParsedPath back to an SVG path string for storage/rendering.
 * Lines are produced for degenerate (coincident-with-anchor) handles;
 * cubic beziers are produced otherwise.
 */
export function serializePathD(parsed: ParsedPath): string {
  const parts: string[] = []

  for (const subpath of parsed.subpaths) {
    const { anchors, closed } = subpath
    if (anchors.length === 0) continue

    // M to first anchor
    const first = anchors[0]
    parts.push(`M ${r(first.x)} ${r(first.y)}`)

    // Segments between consecutive anchors
    for (let i = 1; i < anchors.length; i++) {
      const prev = anchors[i - 1]
      const curr = anchors[i]
      appendSegment(parts, prev, curr)
    }

    // Closing segment back to first anchor (if closed)
    if (closed && anchors.length > 1) {
      const last = anchors[anchors.length - 1]
      // Only emit closing curve if handles are non-degenerate
      if (!samePoint(last.h2x, last.h2y, last.x, last.y) ||
          !samePoint(first.h1x, first.h1y, first.x, first.y)) {
        appendSegment(parts, last, first)
      }
      parts.push('Z')
    } else if (closed) {
      parts.push('Z')
    }
  }

  return parts.join(' ')
}

function appendSegment(out: string[], from: PathAnchor, to: PathAnchor): void {
  const h2Degen = samePoint(from.h2x, from.h2y, from.x, from.y)
  const h1Degen = samePoint(to.h1x, to.h1y, to.x, to.y)
  if (h2Degen && h1Degen) {
    out.push(`L ${r(to.x)} ${r(to.y)}`)
  } else {
    out.push(`C ${r(from.h2x)} ${r(from.h2y)} ${r(to.h1x)} ${r(to.h1y)} ${r(to.x)} ${r(to.y)}`)
  }
}

/** Round to 4 decimal places to avoid floating point noise in output */
function r(v: number): string {
  return String(Math.round(v * 10000) / 10000)
}

// ── Utility exports ───────────────────────────────────────────────────────────

export { pathToString }

/** Deep-clone a ParsedPath with fresh anchor IDs */
export function cloneParsedPath(parsed: ParsedPath): ParsedPath {
  return {
    subpaths: parsed.subpaths.map((sp) => ({
      closed: sp.closed,
      anchors: sp.anchors.map((a) => ({ ...a, id: nanoid(8) }))
    }))
  }
}
