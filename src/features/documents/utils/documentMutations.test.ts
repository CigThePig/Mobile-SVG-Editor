import { describe, it, expect } from 'vitest'
import { moveNodesInDocument, moveNodeInDocument } from './documentMutations'
import type { SvgDocument } from '@/model/document/documentTypes'
import type { GroupNode, RectNode, RootNode, SvgNode } from '@/model/nodes/nodeTypes'

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
