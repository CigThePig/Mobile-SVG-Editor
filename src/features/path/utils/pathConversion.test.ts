import { describe, it, expect } from 'vitest'
import { rectToPathD, ellipseToPathD, circleToPathD, lineToPathD, polylineToPathD, polygonToPathD, starToPathD } from './pathConversion'
import { parsePathD } from './pathGeometry'

describe('rectToPathD', () => {
  it('converts a simple rectangle', () => {
    const d = rectToPathD({ type: 'rect', id: '1', visible: true, locked: false, x: 0, y: 0, width: 100, height: 50 })
    expect(d).toContain('M')
    expect(d).toContain('Z')
    const parsed = parsePathD(d)
    expect(parsed.subpaths).toHaveLength(1)
    expect(parsed.subpaths[0].closed).toBe(true)
    expect(parsed.subpaths[0].anchors).toHaveLength(4)
  })

  it('converts a rectangle with rounded corners', () => {
    const d = rectToPathD({ type: 'rect', id: '1', visible: true, locked: false, x: 10, y: 10, width: 80, height: 60, rx: 8 })
    expect(d).toContain('A') // arc commands for corners
    expect(d).toContain('Z')
  })

  it('preserves position and dimensions', () => {
    const d = rectToPathD({ type: 'rect', id: '1', visible: true, locked: false, x: 20, y: 30, width: 100, height: 50 })
    // Should start at (20, 30) area
    expect(d).toContain('M 20')
  })
})

describe('ellipseToPathD', () => {
  it('converts an ellipse', () => {
    const d = ellipseToPathD({ type: 'ellipse', id: '1', visible: true, locked: false, cx: 50, cy: 50, rx: 30, ry: 20 })
    expect(d).toContain('A')
    expect(d).toContain('Z')
    expect(d).toContain('M')
  })
})

describe('circleToPathD', () => {
  it('converts a circle', () => {
    const d = circleToPathD({ type: 'circle', id: '1', visible: true, locked: false, cx: 50, cy: 50, r: 30 })
    expect(d).toContain('A')
    expect(d).toContain('Z')
  })
})

describe('lineToPathD', () => {
  it('converts a line to open path', () => {
    const d = lineToPathD({ type: 'line', id: '1', visible: true, locked: false, x1: 0, y1: 0, x2: 100, y2: 100 })
    expect(d).toBe('M 0 0 L 100 100')
  })
})

describe('polylineToPathD', () => {
  it('converts a polyline (open)', () => {
    const d = polylineToPathD({
      type: 'polyline', id: '1', visible: true, locked: false,
      points: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }]
    })
    expect(d).toContain('M')
    expect(d).toContain('L')
    expect(d).not.toContain('Z')
  })
})

describe('polygonToPathD', () => {
  it('converts a polygon (closed)', () => {
    const d = polygonToPathD({
      type: 'polygon', id: '1', visible: true, locked: false,
      points: [{ x: 50, y: 0 }, { x: 100, y: 86 }, { x: 0, y: 86 }]
    })
    expect(d).toContain('M')
    expect(d).toContain('L')
    expect(d).toContain('Z')
  })
})

describe('starToPathD', () => {
  it('converts a 5-pointed star', () => {
    const d = starToPathD({ type: 'star', id: '1', visible: true, locked: false, cx: 50, cy: 50, outerRadius: 40, innerRadius: 18, numPoints: 5 })
    expect(d).toContain('M')
    expect(d).toContain('L')
    expect(d).toContain('Z')
    // 5-pointed star should have 10 alternating points
    const parsed = parsePathD(d)
    expect(parsed.subpaths[0].anchors.length).toBe(10)
  })
})
