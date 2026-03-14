import { describe, it, expect } from 'vitest'
import { moveNodesInDocument, moveNodeInDocument, rotateNodeInDocument, rotateNodesInDocument, resizeNodeInDocument } from './documentMutations'
import type { SvgDocument } from '@/model/document/documentTypes'
import type { GroupNode, RectNode, RootNode, SvgNode } from '@/model/nodes/nodeTypes'
import { getNodeBounds } from '@/features/selection/utils/nodeBounds'

function rootChildren(doc: SvgDocument): SvgNode[] {
  return (doc.root as RootNode).children
}

function makeDoc(children: RootNode['children']): SvgDocument {
  return {
    id: 'test',
    title: 'Test',
    createdAt: '',
    updatedAt: '',
    width: 800,
    height: 600,
    viewBox: { x: 0, y: 0, width: 800, height: 600 },
    background: { type: 'transparent' },
    metadata: {},
    resources: {
      swatches: [],
      gradients: [],
      patterns: [],
      filters: [],
      markers: [],
      symbols: [],
      components: [],
      textStyles: [],
      exportSlices: []
    },
    snapshotIds: [],
    version: 1,
    root: {
      id: 'root',
      type: 'root',
      visible: true,
      locked: false,
      children
    }
  }
}

function makeRect(id: string, x: number, y: number, w = 100, h = 100): RectNode {
  return { id, type: 'rect', visible: true, locked: false, x, y, width: w, height: h }
}

function makeGroup(id: string, children: GroupNode['children'], transform?: GroupNode['transform']): GroupNode {
  return { id, type: 'group', visible: true, locked: false, children, transform }
}

describe('moveNodesInDocument', () => {
  it('moves a rect by dx/dy directly (no transform)', () => {
    const doc = makeDoc([makeRect('r1', 10, 20)])
    const result = moveNodeInDocument(doc, 'r1', 30, 40)
    const r = rootChildren(result)[0] as RectNode
    expect(r.x).toBe(40)
    expect(r.y).toBe(60)
  })

  it('moves multiple rects by the same delta', () => {
    const doc = makeDoc([makeRect('r1', 0, 0), makeRect('r2', 100, 100)])
    const result = moveNodesInDocument(doc, ['r1', 'r2'], 10, 20)
    expect((rootChildren(result)[0] as RectNode).x).toBe(10)
    expect((rootChildren(result)[1] as RectNode).x).toBe(110)
  })

  it('moves a group without rotation by updating children coords', () => {
    const group = makeGroup('g1', [makeRect('r1', 50, 50)])
    const doc = makeDoc([group])
    const result = moveNodeInDocument(doc, 'g1', 20, 30)
    const g = rootChildren(result)[0] as GroupNode
    // Children's coordinates should be updated
    expect((g.children[0] as RectNode).x).toBe(70)
    expect((g.children[0] as RectNode).y).toBe(80)
    // Group itself should have no transform added
    expect(g.transform?.translateX ?? 0).toBe(0)
  })

  it('moves a rotated group via transform translation, not child coords', () => {
    const group = makeGroup('g1', [makeRect('r1', 50, 50)], { rotate: 45, pivotX: 100, pivotY: 100 })
    const doc = makeDoc([group])
    const result = moveNodeInDocument(doc, 'g1', 20, 30)
    const g = rootChildren(result)[0] as GroupNode
    // Children should NOT have moved
    expect((g.children[0] as RectNode).x).toBe(50)
    expect((g.children[0] as RectNode).y).toBe(50)
    // Group transform.translateX/Y should have the delta added
    expect(g.transform?.translateX).toBe(20)
    expect(g.transform?.translateY).toBe(30)
  })

  it('accumulates multiple moves on a rotated group via transform', () => {
    const group = makeGroup('g1', [makeRect('r1', 50, 50)], { rotate: 90, translateX: 10, translateY: 5 })
    const doc = makeDoc([group])
    const result = moveNodeInDocument(doc, 'g1', 15, 25)
    const g = rootChildren(result)[0] as GroupNode
    expect(g.transform?.translateX).toBe(25) // 10 + 15
    expect(g.transform?.translateY).toBe(30) // 5 + 25
  })

  it('does not mutate the original document', () => {
    const doc = makeDoc([makeRect('r1', 10, 10)])
    const result = moveNodeInDocument(doc, 'r1', 5, 5)
    // Original doc unchanged
    expect((rootChildren(doc)[0] as RectNode).x).toBe(10)
    expect((rootChildren(result)[0] as RectNode).x).toBe(15)
  })
})

describe('rotateNodeInDocument', () => {
  it('sets rotate on the node transform', () => {
    const doc = makeDoc([makeRect('r1', 0, 0, 100, 100)])
    const pivot = { x: 50, y: 50 }
    const result = rotateNodeInDocument(doc, 'r1', 45, pivot)
    const node = rootChildren(result)[0]
    expect(node.transform?.rotate).toBeCloseTo(45)
  })

  it('stores pivotX/Y as local-space centre, not world-space centre', () => {
    // Rect at x=0, y=0, w=100, h=100. Local centre = (50, 50).
    // Rotate around a distant pivot (200, 200) so the translate moves the node.
    const doc = makeDoc([makeRect('r1', 0, 0, 100, 100)])
    const pivot = { x: 200, y: 200 }
    const result = rotateNodeInDocument(doc, 'r1', 90, pivot)
    const node = rootChildren(result)[0]
    // pivotX/Y must be the LOCAL centre (50, 50), not the translated world position
    expect(node.transform?.pivotX).toBeCloseTo(50)
    expect(node.transform?.pivotY).toBeCloseTo(50)
  })

  it('produces consistent world bounds after two successive rotations via multi-select pivot', () => {
    // Rotate a rect 90° then another 90° (total 180°) around an off-centre pivot.
    // Uses rotateNodesInDocument with delta each step (mirrors what the editor overlay does
    // when each gesture applies a cumulative delta from its startDocument snapshot).
    const doc = makeDoc([makeRect('r1', 0, 0, 100, 100)])
    const pivot = { x: 200, y: 200 }

    // First gesture: 90° delta from fresh doc
    const after90 = rotateNodesInDocument(doc, ['r1'], 90, pivot)
    // Second gesture: another 90° delta from the post-first-gesture doc
    const after180 = rotateNodesInDocument(after90, ['r1'], 90, pivot)

    const bounds = getNodeBounds(rootChildren(after180)[0])!
    // After 180° around (200, 200), a rect initially at (0,0)–(100,100):
    // original centre (50,50) → 180° around (200,200) → (350,350)
    // so bounds should be (300,300)–(400,400)
    expect(bounds.x).toBeCloseTo(300, 0)
    expect(bounds.y).toBeCloseTo(300, 0)
    expect(bounds.width).toBeCloseTo(100, 0)
    expect(bounds.height).toBeCloseTo(100, 0)
  })

  it('multi-node rotation preserves relative positions', () => {
    // Two rects side by side, rotate both 90° around their shared centre
    const r1 = makeRect('r1', 0, 0, 100, 100)
    const r2 = makeRect('r2', 200, 0, 100, 100)
    const doc = makeDoc([r1, r2])
    const pivot = { x: 150, y: 50 } // midpoint between them
    const result = rotateNodesInDocument(doc, ['r1', 'r2'], 90, pivot)

    const b1 = getNodeBounds(rootChildren(result)[0])!
    const b2 = getNodeBounds(rootChildren(result)[1])!

    // Both should still be 100×100
    expect(b1.width).toBeCloseTo(100, 0)
    expect(b1.height).toBeCloseTo(100, 0)
    expect(b2.width).toBeCloseTo(100, 0)
    expect(b2.height).toBeCloseTo(100, 0)

    // After 90° rotation around (150, 50), the two centres (50,50) and (250,50) should become:
    // centre1: (150+(50-50), 50+(150-50)) = (150,150)... let me compute properly:
    // For centre (50,50): dx=50-150=-100, dy=50-50=0; 90°→(-dy,dx)=(0,-100); new=(150,50-100)=(150,-50)
    // For centre (250,50): dx=100, dy=0; 90°→(0,100); new=(150+0,50+100)=(150,150)
    const c1x = b1.x + b1.width / 2
    const c1y = b1.y + b1.height / 2
    const c2x = b2.x + b2.width / 2
    const c2y = b2.y + b2.height / 2
    expect(c1x).toBeCloseTo(150, 0)
    expect(c1y).toBeCloseTo(-50, 0)
    expect(c2x).toBeCloseTo(150, 0)
    expect(c2y).toBeCloseTo(150, 0)
  })
})

describe('resizeNodeInDocument', () => {
  it('resizes a rect to new bounds', () => {
    const doc = makeDoc([makeRect('r1', 0, 0, 100, 100)])
    const result = resizeNodeInDocument(doc, 'r1', { x: 10, y: 20, width: 200, height: 50 })
    const r = rootChildren(result)[0] as RectNode
    expect(r.x).toBe(10)
    expect(r.y).toBe(20)
    expect(r.width).toBe(200)
    expect(r.height).toBe(50)
  })

  it('does not mutate the original', () => {
    const doc = makeDoc([makeRect('r1', 0, 0, 100, 100)])
    resizeNodeInDocument(doc, 'r1', { x: 50, y: 50, width: 50, height: 50 })
    const orig = rootChildren(doc)[0] as RectNode
    expect(orig.width).toBe(100)
  })
})
