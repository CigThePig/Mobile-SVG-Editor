import { describe, it, expect } from 'vitest'
import { parsePathD, serializePathD } from './pathGeometry'

describe('parsePathD', () => {
  it('returns empty ParsedPath for empty string', () => {
    const result = parsePathD('')
    expect(result.subpaths).toHaveLength(0)
  })

  it('parses a simple triangle (line segments)', () => {
    const d = 'M 0 0 L 100 0 L 50 100 Z'
    const parsed = parsePathD(d)
    expect(parsed.subpaths).toHaveLength(1)
    const sp = parsed.subpaths[0]
    expect(sp.closed).toBe(true)
    expect(sp.anchors).toHaveLength(3)
    expect(sp.anchors[0].x).toBeCloseTo(0)
    expect(sp.anchors[0].y).toBeCloseTo(0)
    expect(sp.anchors[1].x).toBeCloseTo(100)
    expect(sp.anchors[2].x).toBeCloseTo(50)
    expect(sp.anchors[2].y).toBeCloseTo(100)
  })

  it('parses cubic bezier curve', () => {
    const d = 'M 0 0 C 10 -20 90 -20 100 0'
    const parsed = parsePathD(d)
    expect(parsed.subpaths).toHaveLength(1)
    const sp = parsed.subpaths[0]
    expect(sp.closed).toBe(false)
    expect(sp.anchors).toHaveLength(2)
    const start = sp.anchors[0]
    const end = sp.anchors[1]
    // Start's out-handle should be (10, -20)
    expect(start.h2x).toBeCloseTo(10)
    expect(start.h2y).toBeCloseTo(-20)
    // End's in-handle should be (90, -20)
    expect(end.h1x).toBeCloseTo(90)
    expect(end.h1y).toBeCloseTo(-20)
  })

  it('handles open path without Z', () => {
    const d = 'M 10 10 L 100 10 L 100 100'
    const parsed = parsePathD(d)
    expect(parsed.subpaths[0].closed).toBe(false)
    expect(parsed.subpaths[0].anchors).toHaveLength(3)
  })
})

describe('serializePathD', () => {
  it('round-trips a simple triangle', () => {
    const d = 'M 0 0 L 100 0 L 50 100 Z'
    const parsed = parsePathD(d)
    const out = serializePathD(parsed)
    // Re-parse to verify geometry matches
    const reparsed = parsePathD(out)
    expect(reparsed.subpaths).toHaveLength(1)
    const sp = reparsed.subpaths[0]
    expect(sp.closed).toBe(true)
    expect(sp.anchors).toHaveLength(3)
    expect(sp.anchors[0].x).toBeCloseTo(0)
    expect(sp.anchors[1].x).toBeCloseTo(100)
    expect(sp.anchors[2].x).toBeCloseTo(50)
  })

  it('round-trips a cubic bezier curve', () => {
    const d = 'M 0 0 C 10 -20 90 -20 100 0'
    const parsed = parsePathD(d)
    const out = serializePathD(parsed)
    const reparsed = parsePathD(out)
    const a0 = reparsed.subpaths[0].anchors[0]
    const a1 = reparsed.subpaths[0].anchors[1]
    expect(a0.h2x).toBeCloseTo(10, 1)
    expect(a0.h2y).toBeCloseTo(-20, 1)
    expect(a1.h1x).toBeCloseTo(90, 1)
    expect(a1.h1y).toBeCloseTo(-20, 1)
  })

  it('produces L commands for degenerate handles', () => {
    const d = 'M 0 0 L 100 0 L 100 100'
    const parsed = parsePathD(d)
    const out = serializePathD(parsed)
    expect(out).toContain('L')
    expect(out).not.toContain('C')
  })

  it('produces C commands for cubic handles', () => {
    const d = 'M 0 0 C 10 -20 90 -20 100 0'
    const parsed = parsePathD(d)
    const out = serializePathD(parsed)
    expect(out).toContain('C')
  })
})

describe('parsePathD multi-subpath', () => {
  it('parses two separate subpaths', () => {
    const d = 'M 0 0 L 50 0 Z M 100 100 L 150 100 L 150 150 Z'
    const parsed = parsePathD(d)
    expect(parsed.subpaths).toHaveLength(2)
    expect(parsed.subpaths[0].anchors).toHaveLength(2)
    expect(parsed.subpaths[1].anchors).toHaveLength(3)
  })
})
