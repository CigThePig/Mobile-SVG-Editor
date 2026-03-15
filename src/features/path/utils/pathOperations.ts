/**
 * Pure mutation functions on ParsedPath for point-level editing.
 * All functions return a new ParsedPath — do not mutate in place.
 */

import type { ParsedPath, PathAnchor, HandleMode } from './pathGeometry'
import { nanoid } from 'nanoid'

// ── Helpers ───────────────────────────────────────────────────────────────────

function cloneAnchor(a: PathAnchor): PathAnchor {
  return { ...a }
}

function clonePath(parsed: ParsedPath): ParsedPath {
  return {
    subpaths: parsed.subpaths.map((sp) => ({
      closed: sp.closed,
      anchors: sp.anchors.map(cloneAnchor)
    }))
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// ── moveAnchor ────────────────────────────────────────────────────────────────

/**
 * Move an anchor point to (newX, newY).
 * Handles move with the anchor (keeping their relative offset unchanged).
 */
export function moveAnchor(
  parsed: ParsedPath,
  subpathIdx: number,
  anchorIdx: number,
  newX: number,
  newY: number
): ParsedPath {
  const next = clonePath(parsed)
  const sp = next.subpaths[subpathIdx]
  if (!sp) return parsed
  const a = sp.anchors[anchorIdx]
  if (!a) return parsed

  const dx = newX - a.x
  const dy = newY - a.y
  a.x = newX; a.y = newY
  a.h1x += dx; a.h1y += dy
  a.h2x += dx; a.h2y += dy

  return next
}

// ── moveHandle ────────────────────────────────────────────────────────────────

/**
 * Move a bezier handle (h1 or h2) of an anchor.
 * Applies handle symmetry/smoothness constraints based on handleMode.
 */
export function moveHandle(
  parsed: ParsedPath,
  subpathIdx: number,
  anchorIdx: number,
  handleType: 'h1' | 'h2',
  newX: number,
  newY: number
): ParsedPath {
  const next = clonePath(parsed)
  const sp = next.subpaths[subpathIdx]
  if (!sp) return parsed
  const a = sp.anchors[anchorIdx]
  if (!a) return parsed

  if (handleType === 'h1') {
    a.h1x = newX; a.h1y = newY
    if (a.handleMode === 'symmetric') {
      // Mirror h2 to be same length opposite direction
      a.h2x = a.x + (a.x - newX)
      a.h2y = a.y + (a.y - newY)
    } else if (a.handleMode === 'smooth') {
      // Mirror h2 direction only (preserve h2 length)
      const dx = a.x - newX; const dy = a.y - newY
      const len1 = Math.sqrt(dx * dx + dy * dy)
      if (len1 > 1e-6) {
        const h2Dx = a.h2x - a.x; const h2Dy = a.h2y - a.y
        const len2 = Math.sqrt(h2Dx * h2Dx + h2Dy * h2Dy)
        a.h2x = a.x + (dx / len1) * len2
        a.h2y = a.y + (dy / len1) * len2
      }
    }
  } else {
    a.h2x = newX; a.h2y = newY
    if (a.handleMode === 'symmetric') {
      a.h1x = a.x + (a.x - newX)
      a.h1y = a.y + (a.y - newY)
    } else if (a.handleMode === 'smooth') {
      const dx = a.x - newX; const dy = a.y - newY
      const len2 = Math.sqrt(dx * dx + dy * dy)
      if (len2 > 1e-6) {
        const h1Dx = a.h1x - a.x; const h1Dy = a.h1y - a.y
        const len1 = Math.sqrt(h1Dx * h1Dx + h1Dy * h1Dy)
        a.h1x = a.x + (dx / len1) * len1
        a.h1y = a.y + (dy / len1) * len1
      }
    }
  }

  return next
}

// ── addPointOnSegment ─────────────────────────────────────────────────────────

/**
 * Insert a new anchor on the segment between anchors[segmentIdx] and anchors[segmentIdx+1].
 * t=0 → at start, t=1 → at end.
 * Uses de Casteljau algorithm for cubic bezier splitting.
 */
export function addPointOnSegment(
  parsed: ParsedPath,
  subpathIdx: number,
  segmentIdx: number,
  t: number
): ParsedPath {
  const next = clonePath(parsed)
  const sp = next.subpaths[subpathIdx]
  if (!sp) return parsed

  const anchors = sp.anchors
  const fromIdx = segmentIdx
  const toIdx = (segmentIdx + 1) % anchors.length

  if (fromIdx < 0 || fromIdx >= anchors.length) return parsed
  if (!sp.closed && toIdx >= anchors.length) return parsed

  const a = anchors[fromIdx]
  const b = anchors[toIdx]

  // De Casteljau split
  const p0 = [a.x, a.y]
  const p1 = [a.h2x, a.h2y]
  const p2 = [b.h1x, b.h1y]
  const p3 = [b.x, b.y]

  const p01 = [lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t)]
  const p12 = [lerp(p1[0], p2[0], t), lerp(p1[1], p2[1], t)]
  const p23 = [lerp(p2[0], p3[0], t), lerp(p2[1], p3[1], t)]
  const p012 = [lerp(p01[0], p12[0], t), lerp(p01[1], p12[1], t)]
  const p123 = [lerp(p12[0], p23[0], t), lerp(p12[1], p23[1], t)]
  const p0123 = [lerp(p012[0], p123[0], t), lerp(p012[1], p123[1], t)]

  // Update existing anchors' handles
  a.h2x = p01[0]; a.h2y = p01[1]
  b.h1x = p23[0]; b.h1y = p23[1]

  // New anchor at split point
  const newAnchor: PathAnchor = {
    id: nanoid(8),
    x: p0123[0], y: p0123[1],
    h1x: p012[0], h1y: p012[1],
    h2x: p123[0], h2y: p123[1],
    handleMode: 'smooth'
  }

  // Insert after fromIdx
  anchors.splice(fromIdx + 1, 0, newAnchor)

  return next
}

// ── deleteAnchor ──────────────────────────────────────────────────────────────

/**
 * Delete an anchor from a subpath.
 * The segment is reconnected; if only 1 anchor remains the subpath is removed.
 */
export function deleteAnchor(
  parsed: ParsedPath,
  subpathIdx: number,
  anchorIdx: number
): ParsedPath {
  const next = clonePath(parsed)
  const sp = next.subpaths[subpathIdx]
  if (!sp) return parsed
  if (sp.anchors.length <= 1) {
    next.subpaths.splice(subpathIdx, 1)
    return next
  }

  sp.anchors.splice(anchorIdx, 1)

  // If only 1 anchor left and closed, it's degenerate
  if (sp.anchors.length === 1 && sp.closed) {
    sp.closed = false
  }

  return next
}

// ── convertAnchorType ─────────────────────────────────────────────────────────

/**
 * Change the handle mode of an anchor.
 * - corner: handles stay at their positions but are freed
 * - smooth: mirrors handle direction (preserves lengths)
 * - symmetric: mirrors handle direction and equalizes lengths
 */
export function convertAnchorType(
  parsed: ParsedPath,
  subpathIdx: number,
  anchorIdx: number,
  mode: HandleMode
): ParsedPath {
  const next = clonePath(parsed)
  const sp = next.subpaths[subpathIdx]
  if (!sp) return parsed
  const a = sp.anchors[anchorIdx]
  if (!a) return parsed

  a.handleMode = mode

  if (mode === 'corner') {
    // Handles stay where they are — no adjustment
    return next
  }

  // For smooth/symmetric: align h2 with h1's direction
  const dx1 = a.x - a.h1x; const dy1 = a.y - a.h1y
  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
  const dx2 = a.h2x - a.x; const dy2 = a.h2y - a.y
  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)

  if (len1 < 1e-6) {
    // h1 is at anchor; reflect h2
    if (len2 > 1e-6) {
      const newLen = mode === 'symmetric' ? len2 : len1 === 0 ? 0 : len1
      const nx = -dx2 / len2; const ny = -dy2 / len2
      a.h1x = a.x + nx * (mode === 'symmetric' ? len2 : newLen)
      a.h1y = a.y + ny * (mode === 'symmetric' ? len2 : newLen)
    }
    return next
  }

  // Align h2 to be opposite of h1
  const ux = dx1 / len1; const uy = dy1 / len1
  const outLen = mode === 'symmetric' ? len1 : len2
  a.h2x = a.x + ux * outLen
  a.h2y = a.y + uy * outLen

  return next
}

// ── toggleSubpathClosed ───────────────────────────────────────────────────────

/**
 * Toggle the closed/open state of a subpath.
 * Only toggles if the subpath has at least 2 anchors.
 */
export function toggleSubpathClosed(
  parsed: ParsedPath,
  subpathIdx: number
): ParsedPath {
  const next = clonePath(parsed)
  const sp = next.subpaths[subpathIdx]
  if (!sp || sp.anchors.length < 2) return parsed
  sp.closed = !sp.closed
  return next
}
