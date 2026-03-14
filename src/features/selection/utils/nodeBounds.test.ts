import { describe, it, expect } from 'vitest'
import { collectSelectableNodes, getNodeBounds, boundsIntersect } from './nodeBounds'
import type { GroupNode, RectNode, RootNode, SvgNode } from '@/model/nodes/nodeTypes'

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
