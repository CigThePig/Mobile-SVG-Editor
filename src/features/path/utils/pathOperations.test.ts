import { describe, it, expect } from 'vitest'
import { moveAnchor, addPointOnSegment, deleteAnchor, toggleSubpathClosed, convertAnchorType } from './pathOperations'
import { parsePathD, serializePathD } from './pathGeometry'

function triangle() {
  return parsePathD('M 0 0 L 100 0 L 50 100 Z')
}

function openPath() {
  return parsePathD('M 0 0 L 100 0 L 100 100')
}

describe('moveAnchor', () => {
  it('moves anchor and its handles together', () => {
    const parsed = triangle()
    const original = parsed.subpaths[0].anchors[0]
    const moved = moveAnchor(parsed, 0, 0, 20, 30)
    const a = moved.subpaths[0].anchors[0]
    expect(a.x).toBeCloseTo(20)
    expect(a.y).toBeCloseTo(30)
    // Handles should have moved by the same delta
    expect(a.h1x).toBeCloseTo(original.h1x + 20)
    expect(a.h2y).toBeCloseTo(original.h2y + 30)
  })

  it('does not mutate original', () => {
    const parsed = triangle()
    moveAnchor(parsed, 0, 0, 99, 99)
    expect(parsed.subpaths[0].anchors[0].x).toBeCloseTo(0)
  })

  it('returns original if indices invalid', () => {
    const parsed = triangle()
    const result = moveAnchor(parsed, 99, 0, 10, 10)
    expect(result).toBe(parsed)
  })
})

describe('addPointOnSegment', () => {
  it('inserts a new anchor between two existing anchors', () => {
    const parsed = triangle()
    const before = parsed.subpaths[0].anchors.length
    const result = addPointOnSegment(parsed, 0, 0, 0.5)
    expect(result.subpaths[0].anchors.length).toBe(before + 1)
  })

  it('new point is roughly at midpoint for t=0.5 on a straight line', () => {
    const parsed = parsePathD('M 0 0 L 100 0')
    const result = addPointOnSegment(parsed, 0, 0, 0.5)
    const newPoint = result.subpaths[0].anchors[1]
    expect(newPoint.x).toBeCloseTo(50, 0)
    expect(newPoint.y).toBeCloseTo(0, 0)
  })

  it('does not mutate original', () => {
    const parsed = triangle()
    addPointOnSegment(parsed, 0, 0, 0.5)
    expect(parsed.subpaths[0].anchors.length).toBe(3)
  })
})

describe('deleteAnchor', () => {
  it('removes an anchor from subpath', () => {
    const parsed = triangle()
    const result = deleteAnchor(parsed, 0, 1)
    expect(result.subpaths[0].anchors.length).toBe(2)
  })

  it('removes the entire subpath when only 1 anchor left', () => {
    const parsed = parsePathD('M 50 50 L 100 100')
    const withOne = deleteAnchor(parsed, 0, 1)
    const withNone = deleteAnchor(withOne, 0, 0)
    expect(withNone.subpaths.length).toBe(0)
  })

  it('does not mutate original', () => {
    const parsed = triangle()
    deleteAnchor(parsed, 0, 0)
    expect(parsed.subpaths[0].anchors.length).toBe(3)
  })
})

describe('toggleSubpathClosed', () => {
  it('opens a closed subpath', () => {
    const parsed = triangle()
    const result = toggleSubpathClosed(parsed, 0)
    expect(result.subpaths[0].closed).toBe(false)
  })

  it('closes an open subpath', () => {
    const parsed = openPath()
    const result = toggleSubpathClosed(parsed, 0)
    expect(result.subpaths[0].closed).toBe(true)
  })

  it('does not mutate original', () => {
    const parsed = triangle()
    toggleSubpathClosed(parsed, 0)
    expect(parsed.subpaths[0].closed).toBe(true)
  })
})

describe('convertAnchorType', () => {
  it('sets anchor mode to corner', () => {
    const parsed = parsePathD('M 0 0 C 10 -20 90 -20 100 0')
    const result = convertAnchorType(parsed, 0, 1, 'corner')
    expect(result.subpaths[0].anchors[1].handleMode).toBe('corner')
  })

  it('does not mutate original', () => {
    const parsed = parsePathD('M 0 0 C 10 -20 90 -20 100 0')
    const originalMode = parsed.subpaths[0].anchors[1].handleMode
    convertAnchorType(parsed, 0, 1, 'corner')
    expect(parsed.subpaths[0].anchors[1].handleMode).toBe(originalMode)
  })
})

describe('serialize round-trip after operations', () => {
  it('move anchor round-trips through serialize', () => {
    const parsed = triangle()
    const moved = moveAnchor(parsed, 0, 0, 10, 20)
    const d = serializePathD(moved)
    const reparsed = parsePathD(d)
    expect(reparsed.subpaths[0].anchors[0].x).toBeCloseTo(10)
    expect(reparsed.subpaths[0].anchors[0].y).toBeCloseTo(20)
  })

  it('add point round-trips through serialize', () => {
    const parsed = parsePathD('M 0 0 L 100 0 L 100 100 Z')
    const added = addPointOnSegment(parsed, 0, 0, 0.5)
    const d = serializePathD(added)
    const reparsed = parsePathD(d)
    expect(reparsed.subpaths[0].anchors.length).toBe(4)
  })
})
