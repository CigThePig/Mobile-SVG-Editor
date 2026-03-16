import type { SvgNode } from '@/model/nodes/nodeTypes'
import type { ResourceStore } from '@/model/resources/resourceTypes'
import type { Guide } from '@/model/view/viewTypes'

// ── Import diagnostics ────────────────────────────────────────────────────────

/**
 * A diagnostic message produced during SVG import (Phase 2).
 * Stored on the document so the UI can surface warnings to the user.
 */
export interface ImportDiagnostic {
  id: string
  severity: 'info' | 'warning' | 'error'
  /** Short machine-readable code for programmatic filtering */
  code: string
  message: string
  /** ID of the affected SvgNode, if applicable */
  elementId?: string
  /** Byte offset in the source SVG string for source-map linking */
  sourceOffset?: number
  /** Name of the attribute that triggered this diagnostic */
  attributeName?: string
}

// ── Document model ────────────────────────────────────────────────────────────

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

  // ── SVG-native fields (Phase 1+) ──────────────────────────────────────────

  /**
   * Fidelity tier for this document:
   *   1 = Fully normalized — editor-native, Mode A serialization
   *   2 = Mostly normalized — imported but mostly clean
   *   3 = Raw-preserved — imported with full preservation, Mode B serialization
   * Defaults to 1 for editor-created documents.
   */
  fidelityTier?: 1 | 2 | 3

  /**
   * Serialization mode to use when exporting:
   *   'normalized' — Mode A: clean, consistently formatted SVG (default for new docs)
   *   'roundtrip'  — Mode B: preserve structure, minimize diff, keep defs order
   * Set automatically by the import engine (Phase 2); can be overridden by user.
   */
  serializationMode?: 'normalized' | 'roundtrip'

  /**
   * Document-level ID registry: maps SVG `id` attribute values → node type.
   * Built by the import engine and maintained by the ID graph engine (Phase 4).
   * Used to validate references (url(#id), href, xlink:href) before serialization.
   */
  idRegistry?: Record<string, string>

  /**
   * Import-time diagnostics produced by the loss-aware import engine (Phase 2).
   * Nodes reference these by ID via PreservationMeta.importDiagnosticIds.
   */
  diagnostics?: ImportDiagnostic[]

  /**
   * xmlns namespace declarations from the root `<svg>` element.
   * Preserved for round-trip serialization.
   * Example: { 'xlink': 'http://www.w3.org/1999/xlink', 'dc': 'http://purl.org/dc/elements/1.1/' }
   */
  namespaces?: Record<string, string>
}

// ── Supporting types ──────────────────────────────────────────────────────────

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
  guides?: Guide[]
}
