/**
 * Snapping utilities for precise geometry editing.
 * All functions are pure — no side effects.
 */

import type { NodeBounds } from '@/features/selection/utils/nodeBounds'
import type { Guide } from '@/model/view/viewTypes'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SnapConfig {
  snapToGrid: boolean
  gridSize: number
  snapToPoints: boolean
  snapToBbox: boolean
  angleSnap: boolean
  angleSnapDegrees: number
}

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  snapToGrid: true,
  gridSize: 10,
  snapToPoints: true,
  snapToBbox: true,
  angleSnap: true,
  angleSnapDegrees: 15
}

export type SnapType = 'grid' | 'point' | 'bbox' | 'guide'

export interface SnapResult {
  x: number
  y: number
  snapped: boolean
  snapType?: SnapType
  snapX?: boolean
  snapY?: boolean
}

export interface SnapCandidate {
  x: number
  y: number
  type: SnapType
}

// ── Snap to grid ──────────────────────────────────────────────────────────────

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

// ── Point snap ────────────────────────────────────────────────────────────────

/**
 * Collect snap candidate points from node bounds (corners + center + edges).
 */
export function boundsToSnapCandidates(bounds: NodeBounds): SnapCandidate[] {
  const { x, y, width, height } = bounds
  const cx = x + width / 2
  const cy = y + height / 2
  const r = x + width
  const b = y + height

  return [
    { x, y, type: 'bbox' },
    { x: r, y, type: 'bbox' },
    { x: r, y: b, type: 'bbox' },
    { x, y: b, type: 'bbox' },
    { x: cx, y, type: 'bbox' },
    { x: r, y: cy, type: 'bbox' },
    { x: cx, y: b, type: 'bbox' },
    { x, y: cy, type: 'bbox' },
    { x: cx, y: cy, type: 'bbox' }
  ]
}

// ── Main snap function ────────────────────────────────────────────────────────

/**
 * Snap a point to the nearest snap target within threshold (in document space).
 * Optionally snaps to guide lines (axis-restricted: vertical guides snap x, horizontal snap y).
 */
export function snapPoint(
  raw: { x: number; y: number },
  candidates: SnapCandidate[],
  config: SnapConfig,
  threshold: number,
  guides?: Guide[]
): SnapResult {
  let bestX = raw.x
  let bestY = raw.y
  let bestDistX = threshold
  let bestDistY = threshold
  let snapType: SnapType | undefined
  let snappedX = false
  let snappedY = false

  // Grid snap
  if (config.snapToGrid && config.gridSize > 0) {
    const gx = snapToGrid(raw.x, config.gridSize)
    const gy = snapToGrid(raw.y, config.gridSize)
    const dx = Math.abs(raw.x - gx)
    const dy = Math.abs(raw.y - gy)
    if (dx < bestDistX) { bestX = gx; bestDistX = dx; snappedX = true; snapType = 'grid' }
    if (dy < bestDistY) { bestY = gy; bestDistY = dy; snappedY = true; snapType = 'grid' }
  }

  // Point / bbox snap
  if (candidates.length > 0 && (config.snapToPoints || config.snapToBbox)) {
    for (const cand of candidates) {
      if (!config.snapToPoints && cand.type === 'point') continue
      if (!config.snapToBbox && cand.type === 'bbox') continue

      const dx = Math.abs(raw.x - cand.x)
      const dy = Math.abs(raw.y - cand.y)
      if (dx < bestDistX) { bestX = cand.x; bestDistX = dx; snappedX = true; snapType = cand.type }
      if (dy < bestDistY) { bestY = cand.y; bestDistY = dy; snappedY = true; snapType = cand.type }
    }
  }

  // Guide snap (axis-restricted)
  if (guides && guides.length > 0) {
    for (const guide of guides) {
      if (guide.orientation === 'vertical') {
        const dx = Math.abs(raw.x - guide.position)
        if (dx < bestDistX) { bestX = guide.position; bestDistX = dx; snappedX = true; snapType = 'guide' }
      } else {
        const dy = Math.abs(raw.y - guide.position)
        if (dy < bestDistY) { bestY = guide.position; bestDistY = dy; snappedY = true; snapType = 'guide' }
      }
    }
  }

  const snapped = snappedX || snappedY
  return {
    x: snapped ? bestX : raw.x,
    y: snapped ? bestY : raw.y,
    snapped,
    snapType,
    snapX: snappedX,
    snapY: snappedY
  }
}

// ── Angle snap ────────────────────────────────────────────────────────────────

/**
 * Snap an angle (degrees) to the nearest multiple of angleSnapDegrees.
 */
export function snapAngle(degrees: number, config: SnapConfig): number {
  if (!config.angleSnap || config.angleSnapDegrees <= 0) return degrees
  const step = config.angleSnapDegrees
  return Math.round(degrees / step) * step
}

// ── Screen-space threshold ────────────────────────────────────────────────────

/**
 * Convert a screen-pixel threshold to document-space units using the current zoom.
 */
export function screenThresholdToDocSpace(screenPixels: number, zoom: number): number {
  return screenPixels / zoom
}
