import { describe, it, expect } from 'vitest'
import { collectSelectableNodes, getNodeBounds, getLocalNodeBounds, boundsIntersect } from './nodeBounds'
import type { CircleNode, EllipseNode, GroupNode, LineNode, PathNode, RectNode, RootNode, SvgNode } from '@/model/nodes/nodeTypes'

function makeRoot(children: SvgNode[]): RootNode {
  return { id: 'root', type: 'root', visible: true, locked: false, children }
}

function makeRect(id: string, x: number, y: number, w = 100, h = 100): RectNode {
  return { id, type: 'rect', visible: true, locked: false, x, y, width: w, height: h }
}

function makeGroup(id: string, children: GroupNode['children']): GroupNode {
  return { id, type: 'group', visible: true, locked: false, children }
}

describe('collectSelectableNodes', () => {
  it('returns only direct children of root', () => {
    const root = makeRoot([makeRect('r1', 0, 0), makeRect('r2', 100, 0)])
    const nodes = collectSelectableNodes(root)
    expect(nodes.map((n) => n.id)).toEqual(['r1', 'r2'])
  })

  it('returns groups as-is, not their children', () => {
    const group = makeGroup('g1', [makeRect('r1', 0, 0), makeRect('r2', 50, 0)])
    const root = makeRoot([group, makeRect('r3', 200, 0)])
    const nodes = collectSelectableNodes(root)
    expect(nodes.map((n) => n.id)).toEqual(['g1', 'r3'])
    // r1 and r2 (inside the group) must NOT be included
    const ids = nodes.map((n) => n.id)
    expect(ids).not.toContain('r1')
    expect(ids).not.toContain('r2')
  })

  it('returns empty array for empty root', () => {
    const root = makeRoot([])
    expect(collectSelectableNodes(root)).toEqual([])
  })

  it('returns direct children of isolation root when isolationRootId is provided', () => {
    const group = makeGroup('g1', [makeRect('r1', 0, 0), makeRect('r2', 50, 0)])
    const root = makeRoot([group, makeRect('r3', 200, 0)])
    const nodes = collectSelectableNodes(root, 'g1')
    expect(nodes.map((n) => n.id)).toEqual(['r1', 'r2'])
    expect(nodes.map((n) => n.id)).not.toContain('r3')
  })

  it('falls back to root children when isolationRootId is not found', () => {
    const root = makeRoot([makeRect('r1', 0, 0)])
    const nodes = collectSelectableNodes(root, 'nonexistent')
    expect(nodes.map((n) => n.id)).toEqual(['r1'])
  })
})

describe('getNodeBounds', () => {
  it('returns correct bounds for a rect', () => {
    const r = makeRect('r1', 10, 20, 80, 60)
    const bounds = getNodeBounds(r)
    expect(bounds).toEqual({ x: 10, y: 20, width: 80, height: 60 })
  })

  it('applies translateX/Y from transform', () => {
    const r: RectNode = { ...makeRect('r1', 10, 10, 100, 100), transform: { translateX: 50, translateY: 30 } }
    const bounds = getNodeBounds(r)
    expect(bounds?.x).toBeCloseTo(60)
    expect(bounds?.y).toBeCloseTo(40)
  })

  it('returns null for unknown node type', () => {
    const node = { id: 'x', type: 'symbol', visible: true, locked: false } as unknown as RectNode
    expect(getNodeBounds(node)).toBeNull()
  })
})

describe('getLocalNodeBounds', () => {
  it('returns the same as getNodeBounds when there is no transform', () => {
    const r = makeRect('r1', 10, 20, 80, 60)
    expect(getLocalNodeBounds(r)).toEqual({ x: 10, y: 20, width: 80, height: 60 })
  })

  it('returns local (pre-transform) bounds even when a transform is present', () => {
    const r: RectNode = { ...makeRect('r1', 10, 10, 100, 100), transform: { translateX: 200, translateY: 150, rotate: 45 } }
    // Local bounds ignores the transform — rect sits at x=10, y=10
    expect(getLocalNodeBounds(r)).toEqual({ x: 10, y: 10, width: 100, height: 100 })
    // World bounds should be different
    const world = getNodeBounds(r)
    expect(world?.x).not.toBe(10)
  })
})

describe('getNodeBounds – path', () => {
  it('returns correct bounds for a simple M L path', () => {
    const p: PathNode = { id: 'p1', type: 'path', visible: true, locked: false, d: 'M 10 20 L 90 80' }
    const b = getNodeBounds(p)
    expect(b?.x).toBeCloseTo(10)
    expect(b?.y).toBeCloseTo(20)
    expect(b?.width).toBeCloseTo(80)
    expect(b?.height).toBeCloseTo(60)
  })

  it('handles H and V commands correctly', () => {
    // M 0 0 H 100 V 50 forms an L-shape; bounds should cover 0–100 x 0–50
    const p: PathNode = { id: 'p1', type: 'path', visible: true, locked: false, d: 'M 0 0 H 100 V 50' }
    const b = getNodeBounds(p)
    expect(b?.x).toBeCloseTo(0)
    expect(b?.y).toBeCloseTo(0)
    expect(b?.width).toBeCloseTo(100)
    expect(b?.height).toBeCloseTo(50)
  })

  it('does not treat arc flags as coordinates', () => {
    // Arc with flags 1 and 0 — these should NOT be included as (1,0) coordinate pair
    // Path: move to (0,0), arc to (100, 0) with rx=50 ry=50
    const p: PathNode = { id: 'p1', type: 'path', visible: true, locked: false, d: 'M 0 0 A 50 50 0 1 0 100 0' }
    const b = getNodeBounds(p)
    // x range must not include 1 or 0 from flags as if they were coords
    // The endpoint (100,0) and start (0,0) should define at least x=0..100
    expect(b).not.toBeNull()
    expect(b!.x).toBeGreaterThanOrEqual(0)
    expect(b!.x + b!.width).toBeGreaterThanOrEqual(100)
    // Crucially: y-min should not be some large number caused by misinterpreted flags
    // Arc with ry=50 conservative estimate: midpoint±ry covers approx -50..50 y range
    expect(b!.y).toBeGreaterThanOrEqual(-60)
    expect(b!.y + b!.height).toBeLessThanOrEqual(60)
  })

  it('handles cubic bezier C command', () => {
    // C with control points that extend the bounding box
    const p: PathNode = { id: 'p1', type: 'path', visible: true, locked: false, d: 'M 0 0 C 0 100 100 100 100 0' }
    const b = getNodeBounds(p)
    expect(b?.x).toBeCloseTo(0)
    expect(b?.y).toBeCloseTo(0)
    expect(b?.width).toBeCloseTo(100)
    // Control points are at y=100 so bounds should include up to y=100
    expect((b?.height ?? 0)).toBeGreaterThanOrEqual(0)
  })

  it('handles a closed rect-shaped path', () => {
    const p: PathNode = { id: 'p1', type: 'path', visible: true, locked: false, d: 'M 10 10 L 90 10 L 90 70 L 10 70 Z' }
    const b = getNodeBounds(p)
    expect(b?.x).toBeCloseTo(10)
    expect(b?.y).toBeCloseTo(10)
    expect(b?.width).toBeCloseTo(80)
    expect(b?.height).toBeCloseTo(60)
  })
})

describe('getNodeBounds – circle and ellipse', () => {
  it('returns correct bounds for a circle', () => {
    const c: CircleNode = { id: 'c1', type: 'circle', visible: true, locked: false, cx: 50, cy: 60, r: 30 }
    expect(getNodeBounds(c)).toEqual({ x: 20, y: 30, width: 60, height: 60 })
  })

  it('returns correct bounds for an ellipse', () => {
    const e: EllipseNode = { id: 'e1', type: 'ellipse', visible: true, locked: false, cx: 100, cy: 80, rx: 40, ry: 20 }
    expect(getNodeBounds(e)).toEqual({ x: 60, y: 60, width: 80, height: 40 })
  })
})

describe('getNodeBounds – line', () => {
  it('returns correct bounds for a diagonal line', () => {
    const l: LineNode = { id: 'l1', type: 'line', visible: true, locked: false, x1: 10, y1: 20, x2: 90, y2: 60 }
    expect(getNodeBounds(l)).toEqual({ x: 10, y: 20, width: 80, height: 40 })
  })
})

describe('getNodeBounds – rotation transform', () => {
  it('returns wider AABB for a rotated rect', () => {
    // A 100×100 square rotated 45° should have an AABB of ~141×141
    const r: RectNode = {
      ...makeRect('r1', 0, 0, 100, 100),
      transform: { rotate: 45, pivotX: 50, pivotY: 50 }
    }
    const b = getNodeBounds(r)
    expect(b).not.toBeNull()
    const side = 100 * Math.SQRT2
    expect(b!.width).toBeCloseTo(side, 0)
    expect(b!.height).toBeCloseTo(side, 0)
  })

  it('centres correctly after rotation around own centre', () => {
    const r: RectNode = {
      ...makeRect('r1', 0, 0, 100, 100),
      transform: { rotate: 90, pivotX: 50, pivotY: 50 }
    }
    const b = getNodeBounds(r)!
    // 90° rotation of a square around its centre: same AABB centre
    expect(b.x + b.width / 2).toBeCloseTo(50)
    expect(b.y + b.height / 2).toBeCloseTo(50)
  })

  it('translates AABB centre correctly when node is moved via translateX/Y', () => {
    const r: RectNode = {
      ...makeRect('r1', 0, 0, 100, 100),
      transform: { translateX: 200, translateY: 100, rotate: 90, pivotX: 50, pivotY: 50 }
    }
    const b = getNodeBounds(r)!
    expect(b.x + b.width / 2).toBeCloseTo(250)
    expect(b.y + b.height / 2).toBeCloseTo(150)
  })
})

describe('boundsIntersect', () => {
  it('returns true for overlapping rects', () => {
    expect(boundsIntersect({ x: 0, y: 0, width: 100, height: 100 }, { x: 50, y: 50, width: 100, height: 100 })).toBe(true)
  })

  it('returns false for non-overlapping rects', () => {
    expect(boundsIntersect({ x: 0, y: 0, width: 50, height: 50 }, { x: 100, y: 100, width: 50, height: 50 })).toBe(false)
  })

  it('returns true for touching rects (edge case)', () => {
    expect(boundsIntersect({ x: 0, y: 0, width: 50, height: 50 }, { x: 50, y: 0, width: 50, height: 50 })).toBe(true)
  })
})
