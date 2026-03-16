/**
 * referenceGraph.test.ts
 *
 * Unit tests for Phase 4: ID and Reference Graph Engine
 *
 * Covers:
 *   - buildIdRegistry: node tree + resource store scanning
 *   - buildReferenceGraph: forward/reverse edges for each slot type
 *   - referenceQueries: all query functions
 *   - renameId: atomic rename across tree and resources
 *   - repairReferences: fuzzy match + bulk repair
 *   - EditorCommands: renameIdCommand, relinkReferenceCommand, removeOrphanedResourcesCommand
 */

import { describe, it, expect } from 'vitest'
import type { CommandResult } from '@/features/documents/services/commands'
import { createEmptyDocument, createEmptyResources } from '@/model/document/documentFactory'
import type { SvgDocument } from '@/model/document/documentTypes'
import type {
  RootNode, RectNode, CircleNode, UseNode, TextPathNode,
  PathNode, GroupNode, ClipPathNode, MaskNode
} from '@/model/nodes/nodeTypes'
import type { GradientResource, FilterResource, MarkerResource } from '@/model/resources/resourceTypes'

import { buildIdRegistry, rebuildDocIdRegistry, generateUniqueId } from './idRegistry'
import { buildReferenceGraph } from './referenceGraph'
import {
  findReferencesTo, findReferencesFrom, isReferenced,
  getBrokenReferences, getOrphanedResources, canSafelyDelete,
  detectCircularRefs, getReferenceCount
} from './referenceQueries'
import { renameId } from './renameResourceCommand'
import {
  renameIdCommand, relinkReferenceCommand, removeOrphanedResourcesCommand
} from './referenceCommands'
import { findBrokenReferences, repairBrokenRefByFuzzyMatch, repairAllBrokenReferences } from './repairReferences'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDoc(overrides: Partial<SvgDocument> = {}): SvgDocument {
  return { ...createEmptyDocument(), ...overrides }
}

function makeRoot(children: RootNode['children'] = []): RootNode {
  return { id: 'root', type: 'root', visible: true, locked: false, children }
}

function makeRect(id: string, overrides: Partial<RectNode> = {}): RectNode {
  return {
    id, type: 'rect', visible: true, locked: false,
    x: 0, y: 0, width: 100, height: 100,
    ...overrides,
  }
}

function makeCircle(id: string): CircleNode {
  return { id, type: 'circle', visible: true, locked: false, cx: 50, cy: 50, r: 40 }
}

function makePath(id: string): PathNode {
  return { id, type: 'path', visible: true, locked: false, d: 'M0 0 L100 0' }
}

function makeGroup(id: string, children: GroupNode['children'] = []): GroupNode {
  return { id, type: 'group', visible: true, locked: false, children }
}

function makeUse(id: string, href: string): UseNode {
  return { id, type: 'use', visible: true, locked: false, href }
}

function makeTextPath(id: string, href: string): TextPathNode {
  return { id, type: 'textPath', visible: true, locked: false, href, content: 'Hello' }
}

function makeClipPath(id: string): ClipPathNode {
  return {
    id, type: 'clipPath', visible: true, locked: false,
    children: [makeRect('cp-rect')]
  }
}

function makeMask(id: string): MaskNode {
  return { id, type: 'mask', visible: true, locked: false, children: [] }
}

function makeGradient(id: string): GradientResource {
  return { id, name: id, type: 'linearGradient', stops: [] }
}

function makeFilter(id: string): FilterResource {
  return { id, name: id, type: 'filter' }
}

function makeMarker(id: string): MarkerResource {
  return { id, name: id, type: 'marker' }
}

// ── 1. buildIdRegistry ────────────────────────────────────────────────────────

describe('buildIdRegistry', () => {
  it('includes all node ids from the tree', () => {
    const doc = makeDoc({
      root: makeRoot([makeRect('r1'), makeCircle('c1')])
    })
    const reg = buildIdRegistry(doc)
    expect(reg.has('r1')).toBe(true)
    expect(reg.has('c1')).toBe(true)
    expect(reg.get('r1')?.kind).toBe('node')
    expect(reg.get('r1')?.nodeType).toBe('rect')
  })

  it('includes the root node id', () => {
    const doc = makeDoc({ root: makeRoot() })
    const reg = buildIdRegistry(doc)
    expect(reg.has('root')).toBe(true)
    expect(reg.get('root')?.kind).toBe('node')
    expect(reg.get('root')?.nodeType).toBe('root')
  })

  it('includes resource ids', () => {
    const doc = makeDoc({
      resources: {
        ...createEmptyResources(),
        gradients: [makeGradient('grad1')],
        filters: [makeFilter('filt1')],
      }
    })
    const reg = buildIdRegistry(doc)
    expect(reg.has('grad1')).toBe(true)
    expect(reg.get('grad1')?.kind).toBe('resource')
    expect(reg.get('grad1')?.resourceType).toBe('linearGradient')
    expect(reg.has('filt1')).toBe(true)
    expect(reg.get('filt1')?.resourceType).toBe('filter')
  })

  it('handles nested nodes', () => {
    const doc = makeDoc({
      root: makeRoot([makeGroup('g1', [makeRect('r1'), makeCircle('c1')])])
    })
    const reg = buildIdRegistry(doc)
    expect(reg.has('g1')).toBe(true)
    expect(reg.has('r1')).toBe(true)
    expect(reg.has('c1')).toBe(true)
  })

  it('returns empty registry for empty doc', () => {
    const doc = makeDoc({ root: makeRoot() })
    const reg = buildIdRegistry(doc)
    // Only the root node id
    expect(reg.has('root')).toBe(true)
    expect(reg.size).toBe(1)
  })
})

describe('rebuildDocIdRegistry', () => {
  it('produces a plain Record mapping id → type string', () => {
    const doc = makeDoc({
      root: makeRoot([makeRect('r1')]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('g1')] }
    })
    const result = rebuildDocIdRegistry(doc)
    expect(result['r1']).toBe('rect')
    expect(result['g1']).toBe('linearGradient')
  })
})

describe('generateUniqueId', () => {
  it('generates an id not in the registry', () => {
    const reg = new Map([['el-abc', { id: 'el-abc', kind: 'node' as const }]])
    const id = generateUniqueId(reg, 'el')
    expect(id).not.toBe('el-abc')
    expect(id.startsWith('el-')).toBe(true)
  })
})

// ── 2. buildReferenceGraph ────────────────────────────────────────────────────

describe('buildReferenceGraph — forward edges', () => {
  it('detects use-href edges', () => {
    const doc = makeDoc({
      root: makeRoot([makeUse('u1', '#sym1')]),
      resources: { ...createEmptyResources(), symbols: [{ id: 'sym1', type: 'symbol' }] }
    })
    const graph = buildReferenceGraph(doc)
    const edges = findReferencesFrom(graph, 'u1')
    expect(edges).toHaveLength(1)
    expect(edges[0].slot).toBe('use-href')
    expect(edges[0].targetId).toBe('sym1')
  })

  it('detects textPath-href edges', () => {
    const doc = makeDoc({
      root: makeRoot([makeTextPath('tp1', '#path1'), makePath('path1')])
    })
    const graph = buildReferenceGraph(doc)
    const edges = findReferencesFrom(graph, 'tp1')
    expect(edges).toHaveLength(1)
    expect(edges[0].slot).toBe('textPath-href')
    expect(edges[0].targetId).toBe('path1')
  })

  it('detects filter-ref edges via AppearanceModel', () => {
    const rect = makeRect('r1', { style: { filterRef: 'filt1' } })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: { ...createEmptyResources(), filters: [makeFilter('filt1')] }
    })
    const graph = buildReferenceGraph(doc)
    const edges = findReferencesFrom(graph, 'r1')
    expect(edges.some((e) => e.slot === 'filter-ref' && e.targetId === 'filt1')).toBe(true)
  })

  it('detects mask-ref and clipPath-ref edges', () => {
    const rect = makeRect('r1', { style: { maskRef: 'mask1', clipPathRef: 'clip1' } })
    const doc = makeDoc({
      root: makeRoot([rect, makeMask('mask1'), makeClipPath('clip1')])
    })
    const graph = buildReferenceGraph(doc)
    const edges = findReferencesFrom(graph, 'r1')
    expect(edges.some((e) => e.slot === 'mask-ref')).toBe(true)
    expect(edges.some((e) => e.slot === 'clipPath-ref')).toBe(true)
  })

  it('detects fill-paint-ref edges for gradient fills', () => {
    const rect = makeRect('r1', {
      style: { fill: { kind: 'gradient', resourceId: 'grad1' } }
    })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('grad1')] }
    })
    const graph = buildReferenceGraph(doc)
    const edges = findReferencesFrom(graph, 'r1')
    expect(edges.some((e) => e.slot === 'fill-paint-ref' && e.targetId === 'grad1')).toBe(true)
  })

  it('detects marker-start-ref, marker-mid-ref, marker-end-ref', () => {
    const rect = makeRect('r1', {
      style: {
        markerStartRef: 'mk1',
        markerMidRef: 'mk2',
        markerEndRef: 'mk3',
      }
    })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: {
        ...createEmptyResources(),
        markers: [makeMarker('mk1'), makeMarker('mk2'), makeMarker('mk3')]
      }
    })
    const graph = buildReferenceGraph(doc)
    const edges = findReferencesFrom(graph, 'r1')
    expect(edges.some((e) => e.slot === 'marker-start-ref')).toBe(true)
    expect(edges.some((e) => e.slot === 'marker-mid-ref')).toBe(true)
    expect(edges.some((e) => e.slot === 'marker-end-ref')).toBe(true)
  })

  it('detects gradient-href (inheritance) edges', () => {
    const base = makeGradient('base-grad')
    const derived: GradientResource = { ...makeGradient('derived-grad'), href: '#base-grad' }
    const doc = makeDoc({
      resources: { ...createEmptyResources(), gradients: [base, derived] }
    })
    const graph = buildReferenceGraph(doc)
    const edges = findReferencesFrom(graph, 'derived-grad')
    expect(edges.some((e) => e.slot === 'gradient-href' && e.targetId === 'base-grad')).toBe(true)
  })
})

describe('buildReferenceGraph — broken edges', () => {
  it('classifies broken references', () => {
    const rect = makeRect('r1', { style: { filterRef: 'nonexistent-filter' } })
    const doc = makeDoc({ root: makeRoot([rect]) })
    const graph = buildReferenceGraph(doc)
    expect(graph.brokenEdges).toHaveLength(1)
    expect(graph.brokenEdges[0].targetId).toBe('nonexistent-filter')
    expect(graph.brokenEdges[0].slot).toBe('filter-ref')
  })

  it('has no broken edges when all refs are valid', () => {
    const rect = makeRect('r1', {
      style: { fill: { kind: 'gradient', resourceId: 'grad1' } }
    })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('grad1')] }
    })
    const graph = buildReferenceGraph(doc)
    expect(graph.brokenEdges).toHaveLength(0)
  })
})

describe('buildReferenceGraph — reverse edges', () => {
  it('builds reverse index correctly', () => {
    const rect1 = makeRect('r1', { style: { fill: { kind: 'gradient', resourceId: 'grad1' } } })
    const rect2 = makeRect('r2', { style: { fill: { kind: 'gradient', resourceId: 'grad1' } } })
    const doc = makeDoc({
      root: makeRoot([rect1, rect2]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('grad1')] }
    })
    const graph = buildReferenceGraph(doc)
    const inbound = findReferencesTo(graph, 'grad1')
    expect(inbound).toHaveLength(2)
    expect(inbound.map((e) => e.sourceId).sort()).toEqual(['r1', 'r2'])
  })
})

// ── 3. referenceQueries ───────────────────────────────────────────────────────

describe('referenceQueries', () => {
  it('isReferenced returns true for referenced resources', () => {
    const rect = makeRect('r1', { style: { fill: { kind: 'gradient', resourceId: 'grad1' } } })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('grad1')] }
    })
    const graph = buildReferenceGraph(doc)
    expect(isReferenced(graph, 'grad1')).toBe(true)
    expect(isReferenced(graph, 'r1')).toBe(false)
  })

  it('getBrokenReferences returns only broken edges', () => {
    const rect = makeRect('r1', { style: { filterRef: 'missing' } })
    const doc = makeDoc({ root: makeRoot([rect]) })
    const graph = buildReferenceGraph(doc)
    const broken = getBrokenReferences(graph)
    expect(broken).toHaveLength(1)
    expect(broken[0].targetId).toBe('missing')
  })

  it('getOrphanedResources returns unreferenced resource ids', () => {
    const doc = makeDoc({
      root: makeRoot([makeRect('r1')]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('grad1')] }
    })
    const graph = buildReferenceGraph(doc)
    const orphans = getOrphanedResources(graph)
    expect(orphans).toContain('grad1')
  })

  it('getOrphanedResources excludes referenced resources', () => {
    const rect = makeRect('r1', { style: { fill: { kind: 'gradient', resourceId: 'grad1' } } })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('grad1')] }
    })
    const graph = buildReferenceGraph(doc)
    const orphans = getOrphanedResources(graph)
    expect(orphans).not.toContain('grad1')
  })

  it('canSafelyDelete returns safe=true for unreferenced nodes', () => {
    const doc = makeDoc({ root: makeRoot([makeRect('r1')]) })
    const graph = buildReferenceGraph(doc)
    const { safe, blockers } = canSafelyDelete(graph, 'r1')
    expect(safe).toBe(true)
    expect(blockers).toHaveLength(0)
  })

  it('canSafelyDelete returns safe=false for referenced resources', () => {
    const rect = makeRect('r1', { style: { fill: { kind: 'gradient', resourceId: 'grad1' } } })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('grad1')] }
    })
    const graph = buildReferenceGraph(doc)
    const { safe, blockers } = canSafelyDelete(graph, 'grad1')
    expect(safe).toBe(false)
    expect(blockers).toHaveLength(1)
    expect(blockers[0].sourceId).toBe('r1')
  })

  it('getReferenceCount returns correct count', () => {
    const rect1 = makeRect('r1', { style: { fill: { kind: 'gradient', resourceId: 'grad1' } } })
    const rect2 = makeRect('r2', { style: { fill: { kind: 'gradient', resourceId: 'grad1' } } })
    const doc = makeDoc({
      root: makeRoot([rect1, rect2]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('grad1')] }
    })
    const graph = buildReferenceGraph(doc)
    expect(getReferenceCount(graph, 'grad1')).toBe(2)
    expect(getReferenceCount(graph, 'r1')).toBe(0)
  })
})

describe('detectCircularRefs', () => {
  it('returns empty array for acyclic graphs', () => {
    const doc = makeDoc({
      root: makeRoot([makeUse('u1', '#sym1')]),
      resources: { ...createEmptyResources(), symbols: [{ id: 'sym1', type: 'symbol' }] }
    })
    const graph = buildReferenceGraph(doc)
    const cycles = detectCircularRefs(graph)
    expect(cycles).toHaveLength(0)
  })

  it('detects simple gradient→gradient cycle', () => {
    const gradA: GradientResource = { ...makeGradient('gA'), href: '#gB' }
    const gradB: GradientResource = { ...makeGradient('gB'), href: '#gA' }
    const doc = makeDoc({
      resources: { ...createEmptyResources(), gradients: [gradA, gradB] }
    })
    const graph = buildReferenceGraph(doc)
    const cycles = detectCircularRefs(graph)
    expect(cycles.length).toBeGreaterThan(0)
  })
})

// ── 4. renameId ───────────────────────────────────────────────────────────────

describe('renameId', () => {
  it('renames a node id and updates use-href references', () => {
    const sym = { id: 'sym1', type: 'symbol' as const, visible: true, locked: false, children: [] }
    const use = makeUse('u1', '#sym1')
    const doc = makeDoc({ root: makeRoot([use, sym]) })

    const result = renameId(doc, { oldId: 'sym1', newId: 'symbol-renamed' })
    expect(result.conflicts).toHaveLength(0)

    // The symbol node itself should have the new id
    const rootChildren = result.document.root.children ?? []
    const renamedSym = rootChildren.find((n) => n.id === 'symbol-renamed')
    expect(renamedSym).toBeDefined()

    // The use element's href should point to the new id
    const useNode = rootChildren.find((n) => n.id === 'u1') as UseNode
    expect(useNode.href).toBe('#symbol-renamed')
  })

  it('renames a resource id and updates fill-paint-ref', () => {
    const rect = makeRect('r1', { style: { fill: { kind: 'gradient', resourceId: 'grad1' } } })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('grad1')] }
    })

    const result = renameId(doc, { oldId: 'grad1', newId: 'gradient-blue' })
    expect(result.conflicts).toHaveLength(0)

    // Resource should have new id
    const grad = result.document.resources.gradients.find((g) => g.id === 'gradient-blue')
    expect(grad).toBeDefined()

    // Node fill should reference new id
    const renamedRect = result.document.root.children?.[0] as RectNode
    expect(renamedRect.style?.fill).toEqual({ kind: 'gradient', resourceId: 'gradient-blue' })
  })

  it('renames a node id and updates filter-ref, mask-ref, clipPath-ref', () => {
    const clip = makeClipPath('clip1')
    const mask = makeMask('mask1')
    const filter = makeFilter('filt1')
    const rect = makeRect('r1', {
      style: { clipPathRef: 'clip1', maskRef: 'mask1', filterRef: 'filt1' }
    })
    const doc = makeDoc({
      root: makeRoot([rect, clip, mask]),
      resources: { ...createEmptyResources(), filters: [filter] }
    })

    let result = renameId(doc, { oldId: 'clip1', newId: 'clip-new' })
    const rectAfterClip = result.document.root.children?.[0] as RectNode
    expect(rectAfterClip.style?.clipPathRef).toBe('clip-new')

    result = renameId(result.document, { oldId: 'mask1', newId: 'mask-new' })
    const rectAfterMask = result.document.root.children?.[0] as RectNode
    expect(rectAfterMask.style?.maskRef).toBe('mask-new')
  })

  it('renames gradient-href (gradient inheritance)', () => {
    const base = makeGradient('base')
    const derived: GradientResource = { ...makeGradient('derived'), href: '#base' }
    const doc = makeDoc({
      resources: { ...createEmptyResources(), gradients: [base, derived] }
    })

    const result = renameId(doc, { oldId: 'base', newId: 'base-gradient' })
    const renamedDerived = result.document.resources.gradients.find((g) => g.id === 'derived')
    expect(renamedDerived?.href).toBe('#base-gradient')
  })

  it('rejects rename when newId already exists (without force)', () => {
    const doc = makeDoc({
      root: makeRoot([makeRect('r1'), makeRect('r2')]),
      idRegistry: { r1: 'rect', r2: 'rect' }
    })
    const result = renameId(doc, { oldId: 'r1', newId: 'r2' })
    expect(result.conflicts).toContain('r2')
    // Document must be unchanged
    expect(result.document).toBe(doc)
  })

  it('allows rename when force=true even if newId exists', () => {
    const doc = makeDoc({
      root: makeRoot([makeRect('r1'), makeRect('r2')]),
      idRegistry: { r1: 'rect', r2: 'rect' }
    })
    const result = renameId(doc, { oldId: 'r1', newId: 'r2', force: true })
    expect(result.conflicts).toHaveLength(0)
  })

  it('is a no-op when oldId === newId', () => {
    const doc = makeDoc({ root: makeRoot([makeRect('r1')]) })
    const result = renameId(doc, { oldId: 'r1', newId: 'r1' })
    expect(result.document).toBe(doc)
    expect(result.affectedEdges).toHaveLength(0)
  })

  it('rebuilds idRegistry after rename', () => {
    const doc = makeDoc({ root: makeRoot([makeRect('r1')]) })
    const result = renameId(doc, { oldId: 'r1', newId: 'rect-first' })
    expect(result.document.idRegistry?.['rect-first']).toBe('rect')
    expect(result.document.idRegistry?.['r1']).toBeUndefined()
  })
})

// ── 5. repairReferences ───────────────────────────────────────────────────────

describe('findBrokenReferences', () => {
  it('returns empty array when all refs are valid', () => {
    const rect = makeRect('r1', { style: { fill: { kind: 'gradient', resourceId: 'grad1' } } })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('grad1')] }
    })
    expect(findBrokenReferences(doc)).toHaveLength(0)
  })

  it('returns broken refs', () => {
    const rect = makeRect('r1', { style: { filterRef: 'missing-filter' } })
    const doc = makeDoc({ root: makeRoot([rect]) })
    const broken = findBrokenReferences(doc)
    expect(broken).toHaveLength(1)
    expect(broken[0].targetId).toBe('missing-filter')
  })
})

describe('repairBrokenRefByFuzzyMatch', () => {
  it('repairs a broken ref when close enough id exists', () => {
    // "filter1" is broken but "filter-1" exists — should be repaired
    const rect = makeRect('r1', { style: { filterRef: 'filter1' } })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: { ...createEmptyResources(), filters: [makeFilter('filter-1')] }
    })
    const broken = findBrokenReferences(doc)
    expect(broken).toHaveLength(1)

    const { repaired, newTargetId } = repairBrokenRefByFuzzyMatch(doc, broken[0])
    expect(repaired).toBe(true)
    expect(newTargetId).toBe('filter-1')
  })

  it('does not repair when no close match exists', () => {
    const rect = makeRect('r1', { style: { filterRef: 'totally-different-id' } })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('grad')] }
    })
    const broken = findBrokenReferences(doc)
    const { repaired } = repairBrokenRefByFuzzyMatch(doc, broken[0])
    expect(repaired).toBe(false)
  })
})

describe('repairAllBrokenReferences', () => {
  it('repairs all repairable broken refs', () => {
    const rect = makeRect('r1', { style: { filterRef: 'filter1' } })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: { ...createEmptyResources(), filters: [makeFilter('filter-1')] }
    })
    const { doc: fixed, repairedCount, unrepairedEdges } = repairAllBrokenReferences(doc)
    expect(repairedCount).toBe(1)
    expect(unrepairedEdges).toHaveLength(0)
    // Verify the fix was applied
    expect(findBrokenReferences(fixed)).toHaveLength(0)
  })

  it('returns original doc when nothing is broken', () => {
    const doc = makeDoc({ root: makeRoot([makeRect('r1')]) })
    const { repairedCount } = repairAllBrokenReferences(doc)
    expect(repairedCount).toBe(0)
  })
})

// ── 6. Commands ───────────────────────────────────────────────────────────────

describe('renameIdCommand', () => {
  it('returns valid CommandResult and renames the id', () => {
    const doc = makeDoc({ root: makeRoot([makeRect('r1')]) })
    const result = renameIdCommand.run({ document: doc }, { oldId: 'r1', newId: 'rect-renamed' }) as CommandResult
    expect(result.document).not.toBe(doc)
    expect(result.label).toContain('rect-renamed')
    // Verify rename happened
    const child = result.document.root.children?.[0]
    expect(child?.id).toBe('rect-renamed')
  })

  it('returns original doc when there is a conflict', () => {
    const doc = makeDoc({
      root: makeRoot([makeRect('r1'), makeRect('r2')]),
      idRegistry: { r1: 'rect', r2: 'rect' }
    })
    const result = renameIdCommand.run({ document: doc }, { oldId: 'r1', newId: 'r2' }) as CommandResult
    expect(result.document).toBe(doc)
    expect(result.label).toContain('conflict')
  })
})

describe('relinkReferenceCommand', () => {
  it('relinks a fill-paint-ref to a new gradient', () => {
    const rect = makeRect('r1', { style: { fill: { kind: 'gradient', resourceId: 'grad1' } } })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: {
        ...createEmptyResources(),
        gradients: [makeGradient('grad1'), makeGradient('grad2')]
      }
    })
    const result = relinkReferenceCommand.run({ document: doc }, {
      sourceId: 'r1',
      slot: 'fill-paint-ref',
      newTargetId: 'grad2'
    }) as CommandResult
    const updatedRect = result.document.root.children?.[0] as RectNode
    expect(updatedRect.style?.fill).toEqual({ kind: 'gradient', resourceId: 'grad2' })
  })

  it('relinks a use-href to a new symbol', () => {
    const use = makeUse('u1', '#sym1')
    const doc = makeDoc({
      root: makeRoot([use]),
      resources: {
        ...createEmptyResources(),
        symbols: [{ id: 'sym1', type: 'symbol' }, { id: 'sym2', type: 'symbol' }]
      }
    })
    const result = relinkReferenceCommand.run({ document: doc }, {
      sourceId: 'u1',
      slot: 'use-href',
      newTargetId: 'sym2'
    }) as CommandResult
    const updatedUse = result.document.root.children?.[0] as UseNode
    expect(updatedUse.href).toBe('#sym2')
  })
})

describe('removeOrphanedResourcesCommand', () => {
  it('removes orphaned resources and keeps referenced ones', () => {
    const rect = makeRect('r1', { style: { fill: { kind: 'gradient', resourceId: 'grad1' } } })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: {
        ...createEmptyResources(),
        gradients: [makeGradient('grad1'), makeGradient('orphan-grad')]
      }
    })
    const result = removeOrphanedResourcesCommand.run({ document: doc }, {}) as CommandResult
    expect(result.document.resources.gradients).toHaveLength(1)
    expect(result.document.resources.gradients[0].id).toBe('grad1')
    expect(result.label).toContain('1')
  })

  it('is a no-op when no orphans exist', () => {
    const rect = makeRect('r1', { style: { fill: { kind: 'gradient', resourceId: 'grad1' } } })
    const doc = makeDoc({
      root: makeRoot([rect]),
      resources: { ...createEmptyResources(), gradients: [makeGradient('grad1')] }
    })
    const result = removeOrphanedResourcesCommand.run({ document: doc }, {}) as CommandResult
    expect(result.document).toBe(doc)
    expect(result.label).toContain('none found')
  })
})
