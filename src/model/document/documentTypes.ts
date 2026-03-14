import type { SvgNode } from '@/model/nodes/nodeTypes'
import type { ResourceStore } from '@/model/resources/resourceTypes'

export interface SvgDocument {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  width: number
  height: number
  viewBox: ViewBox
  background: BackgroundModel
  metadata: DocumentMetadata
  root: SvgNode
  resources: ResourceStore
  editorState?: PerDocumentEditorState
  snapshotIds: string[]
  version: number
}

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

export type BackgroundModel = { type: 'transparent' } | { type: 'solid'; color: string }

export interface DocumentMetadata {
  description?: string
  author?: string
  keywords?: string[]
  accessibilityTitle?: string
  accessibilityDesc?: string
  tags?: string[]
}

export interface PerDocumentEditorState {
  lastZoom?: number
  lastPanX?: number
  lastPanY?: number
  showGrid?: boolean
  showGuides?: boolean
  snapEnabled?: boolean
}
