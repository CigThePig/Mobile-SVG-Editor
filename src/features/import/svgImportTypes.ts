import type { ImportDiagnostic } from '@/model/document/documentTypes'
import type { ResourceStore } from '@/model/resources/resourceTypes'

// ── ParseContext ──────────────────────────────────────────────────────────────

/**
 * Mutable context object threaded through the entire two-pass parse.
 * Pass 1 populates `idRegistry`, `resources`, `cssRulesBySelector`, and `namespaces`.
 * Pass 2 reads from context and appends additional diagnostics.
 */
export interface ParseContext {
  /** Maps SVG id attribute values → node type string (e.g. 'linearGradient') */
  idRegistry: Map<string, string>

  /** Resource store populated during pass 1 defs scan */
  resources: ResourceStore

  /** Diagnostics collected throughout the parse */
  diagnostics: ImportDiagnostic[]

  /** xmlns:prefix → uri namespace declarations from root <svg> element */
  namespaces: Record<string, string>

  /**
   * CSS rules resolved from <style> blocks.
   * Key: CSS selector string (e.g. '.cls-1', '#myId', 'rect')
   * Value: map of CSS property → value strings
   */
  cssRulesBySelector: Map<string, Record<string, string>>

  /** Original SVG source string (for sourceOffset calculation) */
  sourceSvg: string

  /** IDs encountered so far during pass 1 — used for duplicate detection */
  seenIds: Set<string>

  /** Tracks duplicate IDs found: oldId → newId (for reference repair) */
  duplicateIdRepairs: Map<string, string>

  /** Set to true if any Level 3 (preserved-raw) element was encountered */
  hasPreservedContent: boolean

  /** Set to true if any unknown/unrecognized element was encountered */
  hasUnknownElements: boolean

  /** Set to true if any <style> block was found */
  hasStyleBlocks: boolean

  /** Set to true if any Level 4 (display-only / SMIL) element was encountered */
  hasDisplayOnlyContent: boolean

  /** Set to true if any Level 2 (partial-support) tree node was encountered (text, use, image, etc.) */
  hasLevel2Nodes: boolean

  /** Set to true if any node carries rawAttributes (unknown/custom attributes) */
  hasRawAttributes: boolean
}

// ── Import result ─────────────────────────────────────────────────────────────

/**
 * Result of a successful SVG parse operation.
 * The caller is responsible for wiring `doc` into the editor store and history.
 */
export interface SvgImportResult {
  doc: import('@/model/document/documentTypes').SvgDocument
  diagnosticCount: number
  warningCount: number
  errorCount: number
  fidelityTier: 1 | 2 | 3
  /** Counts of each editability level found in the imported document */
  editabilityBreakdown: Record<1 | 2 | 3 | 4, number>
}

// ── Diagnostic code constants ─────────────────────────────────────────────────

export const DIAG = {
  // Info codes
  UNKNOWN_ELEMENT_PRESERVED: 'UNKNOWN_ELEMENT_PRESERVED',
  ATTRIBUTE_PRESERVED: 'ATTRIBUTE_PRESERVED',
  DISPLAY_ONLY_ELEMENT: 'DISPLAY_ONLY_ELEMENT',
  NAMESPACE_PRESERVED: 'NAMESPACE_PRESERVED',

  // Warning codes
  DUPLICATE_ID_REPAIRED: 'DUPLICATE_ID_REPAIRED',
  MALFORMED_TRANSFORM: 'MALFORMED_TRANSFORM',
  UNRESOLVED_REFERENCE: 'UNRESOLVED_REFERENCE',
  INVALID_CSS: 'INVALID_CSS',
  UNSUPPORTED_PAINT: 'UNSUPPORTED_PAINT',
  MISSING_VIEWBOX: 'MISSING_VIEWBOX',
  FILTER_PRESERVED_RAW: 'FILTER_PRESERVED_RAW',
  PATTERN_PRESERVED_RAW: 'PATTERN_PRESERVED_RAW',

  // Error codes
  PARSE_ERROR: 'PARSE_ERROR',
  INVALID_SVG_ROOT: 'INVALID_SVG_ROOT',
} as const

export type DiagCode = (typeof DIAG)[keyof typeof DIAG]

// ── SVG namespace constants ───────────────────────────────────────────────────

export const SVG_NS = 'http://www.w3.org/2000/svg'
export const XLINK_NS = 'http://www.w3.org/1999/xlink'
export const XML_NS = 'http://www.w3.org/XML/1998/namespace'

/** Element tag names classified as SMIL / display-only (Level 4) */
export const DISPLAY_ONLY_TAGS = new Set([
  'animate',
  'animateTransform',
  'animateMotion',
  'animateColor',
  'set',
  'discard',
  'script',
  'mpath',
])

/** Element tag names with Level 1 (Full) editability */
export const LEVEL_1_TAGS = new Set([
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
  'g',
  'defs',
])

/** Element tag names with Level 2 (Partial) editability */
export const LEVEL_2_TAGS = new Set([
  'text',
  'tspan',
  'textPath',
  'image',
  'symbol',
  'use',
  'clipPath',
  'mask',
  'marker',
  'pattern',
  'filter',
  'style',
  'a',
  'switch',
  'linearGradient',
  'radialGradient',
])

/** Known SVG presentation attributes that map to AppearanceModel */
export const PRESENTATION_ATTRS = new Set([
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-nonscaling',
  'opacity',
  'color',
  'display',
  'visibility',
  'overflow',
  'clip-path',
  'mask',
  'filter',
  'marker-start',
  'marker-mid',
  'marker-end',
  'mix-blend-mode',
  'isolation',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'text-anchor',
  'text-decoration',
  'letter-spacing',
  'word-spacing',
  'line-height',
  'dominant-baseline',
  'writing-mode',
  'direction',
  'unicode-bidi',
  'pointer-events',
  'cursor',
  'color-interpolation',
  'color-interpolation-filters',
  'color-rendering',
  'image-rendering',
  'shape-rendering',
  'text-rendering',
  'vector-effect',
])
