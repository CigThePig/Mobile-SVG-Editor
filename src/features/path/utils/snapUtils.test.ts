import { describe, it, expect } from 'vitest'
import {
  snapPoint,
  snapAngle,
  boundsToSnapCandidates,
  screenThresholdToDocSpace,
  DEFAULT_SNAP_CONFIG
} from './snapUtils'
import type { SnapConfig } from './snapUtils'

describe('snapPoint — grid snapping', () => {
  it('snaps x and y to nearest grid line when within threshold', () => {
    const config: SnapConfig = { ...DEFAULT_SNAP_CONFIG, snapToGrid: true, gridSize: 10, snapToPoints: false, snapToBbox: false }
    const result = snapPoint({ x: 12, y: 18 }, [], config, 5)
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
    expect(result.snapped).toBe(true)
    expect(result.snapType).toBe('grid')
  })

  it('does not snap when raw point is outside the threshold', () => {
    const config: SnapConfig = { ...DEFAULT_SNAP_CONFIG, snapToGrid: true, gridSize: 10, snapToPoints: false, snapToBbox: false }
    const result = snapPoint({ x: 16, y: 16 }, [], config, 3)
    expect(result.x).toBe(16)
    expect(result.y).toBe(16)
    expect(result.snapped).toBe(false)
  })

  it('respects snapToGrid: false — does not snap to grid', () => {
    const config: SnapConfig = { ...DEFAULT_SNAP_CONFIG, snapToGrid: false, snapToPoints: false, snapToBbox: false }
    const result = snapPoint({ x: 11, y: 11 }, [], config, 5)
    expect(result.x).toBe(11)
    expect(result.y).toBe(11)
    expect(result.snapped).toBe(false)
  })

  it('snaps only the axis that is within threshold', () => {
    const config: SnapConfig = { ...DEFAULT_SNAP_CONFIG, snapToGrid: true, gridSize: 10, snapToPoints: false, snapToBbox: false }
    // x=23 is 3 away from grid 20 (< threshold 5, snaps)
    // y=25 is exactly 5 away from both 20 and 30 (not < threshold 5, does not snap)
    const result = snapPoint({ x: 23, y: 25 }, [], config, 5)
    expect(result.x).toBe(20)   // snapped
    expect(result.y).toBe(25)   // not snapped (dist=5 is not < 5)
    expect(result.snapX).toBe(true)
    expect(result.snapY).toBe(false)
  })
})

describe('snapPoint — bbox snapping', () => {
  it('snaps to bbox candidate when closer than grid', () => {
    const config: SnapConfig = { ...DEFAULT_SNAP_CONFIG, snapToGrid: false, snapToPoints: false, snapToBbox: true }
    const candidates = [{ x: 50, y: 100, type: 'bbox' as const }]
    const result = snapPoint({ x: 52, y: 98 }, candidates, config, 5)
    expect(result.x).toBe(50)
    expect(result.y).toBe(100)
    expect(result.snapped).toBe(true)
    expect(result.snapType).toBe('bbox')
  })

  it('does not snap to bbox when snapToBbox is false', () => {
    const config: SnapConfig = { ...DEFAULT_SNAP_CONFIG, snapToGrid: false, snapToPoints: false, snapToBbox: false }
    const candidates = [{ x: 50, y: 50, type: 'bbox' as const }]
    const result = snapPoint({ x: 52, y: 52 }, candidates, config, 5)
    expect(result.snapped).toBe(false)
  })

  it('prefers closer candidate over grid', () => {
    const config: SnapConfig = { ...DEFAULT_SNAP_CONFIG, snapToGrid: true, gridSize: 10, snapToPoints: false, snapToBbox: true }
    // x: grid would snap to 10 (dist=1), bbox candidate at 12 (dist=1) — grid wins as it was evaluated first
    // but at x=13, grid=10 (dist=3), bbox=15 (dist=2) — bbox wins
    const candidates = [{ x: 15, y: 100, type: 'bbox' as const }]
    const result = snapPoint({ x: 13, y: 100 }, candidates, config, 5)
    expect(result.x).toBe(15)
    expect(result.snapType).toBe('bbox')
  })
})

describe('snapAngle', () => {
  it('rounds to nearest 15-degree multiple', () => {
    const config: SnapConfig = { ...DEFAULT_SNAP_CONFIG, angleSnap: true, angleSnapDegrees: 15 }
    expect(snapAngle(7, config)).toBe(0)
    expect(snapAngle(8, config)).toBe(15)
    expect(snapAngle(22, config)).toBe(15)
    expect(snapAngle(23, config)).toBe(30)
    expect(snapAngle(90, config)).toBe(90)
    expect(snapAngle(-7, config)).toBeCloseTo(0)
    expect(snapAngle(-8, config)).toBe(-15)
  })

  it('rounds to 45-degree multiples when configured', () => {
    const config: SnapConfig = { ...DEFAULT_SNAP_CONFIG, angleSnap: true, angleSnapDegrees: 45 }
    expect(snapAngle(22, config)).toBe(0)
    expect(snapAngle(23, config)).toBe(45)
  })

  it('returns angle unchanged when angleSnap is false', () => {
    const config: SnapConfig = { ...DEFAULT_SNAP_CONFIG, angleSnap: false, angleSnapDegrees: 15 }
    expect(snapAngle(7, config)).toBe(7)
    expect(snapAngle(22.5, config)).toBe(22.5)
  })

  it('returns angle unchanged when angleSnapDegrees is 0', () => {
    const config: SnapConfig = { ...DEFAULT_SNAP_CONFIG, angleSnap: true, angleSnapDegrees: 0 }
    expect(snapAngle(33, config)).toBe(33)
  })
})

describe('boundsToSnapCandidates', () => {
  it('returns 9 candidates for a rect bounds', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 50 }
    const candidates = boundsToSnapCandidates(bounds)
    expect(candidates).toHaveLength(9)
  })

  it('includes all 4 corners', () => {
    const bounds = { x: 10, y: 20, width: 100, height: 50 }
    const candidates = boundsToSnapCandidates(bounds)
    expect(candidates).toContainEqual({ x: 10, y: 20, type: 'bbox' })    // top-left
    expect(candidates).toContainEqual({ x: 110, y: 20, type: 'bbox' })   // top-right
    expect(candidates).toContainEqual({ x: 110, y: 70, type: 'bbox' })   // bottom-right
    expect(candidates).toContainEqual({ x: 10, y: 70, type: 'bbox' })    // bottom-left
  })

  it('includes the center point', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 }
    const candidates = boundsToSnapCandidates(bounds)
    expect(candidates).toContainEqual({ x: 50, y: 50, type: 'bbox' })
  })

  it('includes all 4 edge midpoints', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 40 }
    const candidates = boundsToSnapCandidates(bounds)
    expect(candidates).toContainEqual({ x: 50, y: 0, type: 'bbox' })   // top edge
    expect(candidates).toContainEqual({ x: 100, y: 20, type: 'bbox' }) // right edge
    expect(candidates).toContainEqual({ x: 50, y: 40, type: 'bbox' })  // bottom edge
    expect(candidates).toContainEqual({ x: 0, y: 20, type: 'bbox' })   // left edge
  })
})

describe('screenThresholdToDocSpace', () => {
  it('divides screen pixels by zoom', () => {
    expect(screenThresholdToDocSpace(8, 2)).toBe(4)
    expect(screenThresholdToDocSpace(10, 1)).toBe(10)
    expect(screenThresholdToDocSpace(10, 0.5)).toBe(20)
  })
})
