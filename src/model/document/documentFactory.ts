import { nanoid } from 'nanoid'
import type { SvgDocument } from './documentTypes'
import type { RootNode } from '@/model/nodes/nodeTypes'
import type { ResourceStore } from '@/model/resources/resourceTypes'

export function createEmptyResources(): ResourceStore {
  return {
    swatches: [],
    gradients: [],
    patterns: [],
    filters: [],
    markers: [],
    symbols: [],
    components: [],
    textStyles: [],
    exportSlices: []
  }
}

export function createEmptyRoot(): RootNode {
  return {
    id: nanoid(),
    type: 'root',
    visible: true,
    locked: false,
    children: []
  }
}

export function createEmptyDocument(title = 'Untitled SVG'): SvgDocument {
  const now = new Date().toISOString()

  return {
    id: nanoid(),
    title,
    createdAt: now,
    updatedAt: now,
    width: 1080,
    height: 1080,
    viewBox: { x: 0, y: 0, width: 1080, height: 1080 },
    background: { type: 'transparent' },
    metadata: {},
    root: createEmptyRoot(),
    resources: createEmptyResources(),
    editorState: {
      lastZoom: 1,
      lastPanX: 0,
      lastPanY: 0,
      showGrid: false,
      showGuides: true,
      snapEnabled: true
    },
    snapshotIds: [],
    version: 1
  }
}
