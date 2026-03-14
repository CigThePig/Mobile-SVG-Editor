import { describe, it, expect } from 'vitest'
import { groupSelectionCommand, ungroupSelectionCommand } from './documentCommands'
import type { SvgDocument } from '@/model/document/documentTypes'
import type { GroupNode, RectNode, RootNode, SvgNode } from '@/model/nodes/nodeTypes'
import { getNodeBounds } from '@/features/selection/utils/nodeBounds'

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

function rootChildren(doc: SvgDocument): SvgNode[] {
  return (doc.root as RootNode).children
}

function runCommand<T>(command: { run: (ctx: { document: SvgDocument }, payload: T) => { document: SvgDocument; selectionIds?: string[] } }, doc: SvgDocument, payload: T) {
  return command.run({ document: doc }, payload)
}

describe('groupSelectionCommand', () => {
  it('groups two sibling rects into a single group', () => {
    const doc = makeDoc([makeRect('r1', 0, 0), makeRect('r2', 200, 0)])
    const { document: result, selectionIds } = runCommand(groupSelectionCommand, doc, { nodeIds: ['r1', 'r2'] })
    expect(rootChildren(result)).toHaveLength(1)
    expect(rootChildren(result)[0].type).toBe('group')
    expect(selectionIds).toHaveLength(1)
  })

  it('preserves child order within the group', () => {
    const doc = makeDoc([makeRect('r1', 0, 0), makeRect('r2', 100, 0), makeRect('r3', 200, 0)])
    const { document: result } = runCommand(groupSelectionCommand, doc, { nodeIds: ['r1', 'r3'] })
    const group = rootChildren(result)[0] as GroupNode
    const ids = group.children.map((c) => c.id)
    expect(ids).toContain('r1')
    expect(ids).toContain('r3')
    // r2 should remain outside the group
    const topIds = rootChildren(result).map((c) => c.id)
    expect(topIds).toContain('r2')
  })

  it('returns the original doc unchanged when fewer than 2 nodes selected', () => {
    const doc = makeDoc([makeRect('r1', 0, 0)])
    const { document: result } = runCommand(groupSelectionCommand, doc, { nodeIds: ['r1'] })
    expect(result).toBe(doc)
  })
})

describe('ungroupSelectionCommand', () => {
  it('restores children to parent level', () => {
    const doc = makeDoc([makeRect('r1', 0, 0), makeRect('r2', 200, 0)])
    const { document: grouped, selectionIds: groupedSels } = runCommand(groupSelectionCommand, doc, { nodeIds: ['r1', 'r2'] })
    const [groupId] = groupedSels!
    const { document: ungrouped, selectionIds } = runCommand(ungroupSelectionCommand, grouped, { nodeIds: [groupId] })
    expect(rootChildren(ungrouped)).toHaveLength(2)
    expect(selectionIds).toContain('r1')
    expect(selectionIds).toContain('r2')
  })

  it('preserves child positions when group has no transform (translate-only case)', () => {
    // Group two rects at known positions, then move the group via translate,
    // then ungroup — children should appear where they were rendered.
    const r1 = makeRect('r1', 10, 20, 80, 60)
    const r2 = makeRect('r2', 150, 20, 80, 60)
    const doc = makeDoc([r1, r2])

    // Group them
    const { document: grouped, selectionIds: groupedSels2 } = runCommand(groupSelectionCommand, doc, { nodeIds: ['r1', 'r2'] })
    const [groupId] = groupedSels2!

    // Simulate the group having been moved by 100, 50 (translate only, no rotation)
    const movedGrouped: SvgDocument = {
      ...grouped,
      root: {
        ...grouped.root,
        children: (grouped.root as RootNode).children.map((n) =>
          n.id === groupId
            ? { ...n, transform: { translateX: 100, translateY: 50 } }
            : n
        )
      }
    }

    // Capture world bounds before ungroup
    const groupNode = (movedGrouped.root as RootNode).children.find((n) => n.id === groupId)!
    const childR1 = (groupNode as GroupNode).children.find((c) => c.id === 'r1')!
    const childR2 = (groupNode as GroupNode).children.find((c) => c.id === 'r2')!
    // The group's transform should push children's world position by (100, 50)
    const b1Before = getNodeBounds(groupNode)! // group world bounds
    const expectedR1x = 10 + 100  // child x + group translateX
    const expectedR1y = 20 + 50

    // Ungroup
    const { document: ungrouped } = runCommand(ungroupSelectionCommand, movedGrouped, { nodeIds: [groupId] })
    const children = rootChildren(ungrouped)
    const ur1 = children.find((c) => c.id === 'r1') as RectNode
    const ur2 = children.find((c) => c.id === 'r2') as RectNode

    expect(ur1).toBeDefined()
    expect(ur2).toBeDefined()

    // Children should have been moved by the group's translate baked into coordinates
    expect(ur1.x).toBeCloseTo(expectedR1x)
    expect(ur1.y).toBeCloseTo(expectedR1y)
    expect(ur2.x).toBeCloseTo(150 + 100)
    expect(ur2.y).toBeCloseTo(20 + 50)

    // No leftover transform on children (translate was baked into coords)
    expect(ur1.transform?.translateX ?? 0).toBeCloseTo(0)
    expect(ur1.transform?.translateY ?? 0).toBeCloseTo(0)
  })

  it('selects ungrouped children after ungroup', () => {
    const doc = makeDoc([makeRect('r1', 0, 0), makeRect('r2', 100, 0)])
    const { document: grouped, selectionIds: groupedSels3 } = runCommand(groupSelectionCommand, doc, { nodeIds: ['r1', 'r2'] })
    const [groupId] = groupedSels3!
    const { selectionIds } = runCommand(ungroupSelectionCommand, grouped, { nodeIds: [groupId] })
    expect(selectionIds).toContain('r1')
    expect(selectionIds).toContain('r2')
  })

  it('does nothing when given a non-group node id', () => {
    const doc = makeDoc([makeRect('r1', 0, 0)])
    const { document: result } = runCommand(ungroupSelectionCommand, doc, { nodeIds: ['r1'] })
    // Should return unchanged (no groups to expand)
    expect(rootChildren(result)).toHaveLength(1)
  })
})
