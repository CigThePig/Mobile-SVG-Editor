import type { SvgNode } from '@/model/nodes/nodeTypes'

// ── Base resource ─────────────────────────────────────────────────────────────

export interface BaseResource {
  id: string
  name?: string
}

// ── Color resources ───────────────────────────────────────────────────────────

export interface SwatchResource extends BaseResource {
  type: 'swatch'
  color: string
}

// ── Gradient resources ────────────────────────────────────────────────────────

export interface GradientStop {
  offset: number
  color: string
  opacity?: number
}

/**
 * SVG gradient resource (linearGradient or radialGradient).
 * Fields beyond `stops` correspond directly to SVG gradient attributes
 * and are needed for round-trip-safe serialization (Phase 3).
 */
export interface GradientResource extends BaseResource {
  type: 'linearGradient' | 'radialGradient'
  stops: GradientStop[]

  // Shared gradient attributes
  gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  gradientTransform?: string
  spreadMethod?: 'pad' | 'reflect' | 'repeat'
  /** Inherited gradient reference (xlink:href / href) */
  href?: string

  // Linear gradient specific
  x1?: number | string
  y1?: number | string
  x2?: number | string
  y2?: number | string

  // Radial gradient specific
  cx?: number | string
  cy?: number | string
  r?: number | string
  fx?: number | string
  fy?: number | string
  fr?: number | string
}

// ── Pattern resource ──────────────────────────────────────────────────────────

/**
 * SVG pattern resource.
 * For simple patterns, `children` holds the pattern content as SvgNodes.
 * For complex or unrecognized patterns from import, `rawXml` is used instead.
 */
export interface PatternResource extends BaseResource {
  type: 'pattern'
  x?: number
  y?: number
  width?: number
  height?: number
  patternUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  patternContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  patternTransform?: string
  viewBox?: string
  preserveAspectRatio?: string
  /** Pattern content as structured nodes */
  children?: SvgNode[]
  /** Raw XML fallback for patterns that can't be fully parsed (Phase 2) */
  rawXml?: string
}

// ── Filter resource ───────────────────────────────────────────────────────────

/**
 * SVG filter resource.
 * Filter primitives (feBlend, feGaussianBlur, etc.) are complex and vary
 * widely; they are stored as raw XML until Phase 2 adds structured support.
 */
export interface FilterResource extends BaseResource {
  type: 'filter'
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  filterUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  primitiveUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  /** Complete raw XML of this filter element and its primitives */
  rawXml?: string
}

// ── Marker resource ───────────────────────────────────────────────────────────

/**
 * SVG marker resource (arrowheads, line end decorations).
 * For simple markers, `children` holds the marker content.
 * `rawXml` is used as fallback for complex imported markers.
 */
export interface MarkerResource extends BaseResource {
  type: 'marker'
  viewBox?: string
  refX?: number | string
  refY?: number | string
  markerWidth?: number | string
  markerHeight?: number | string
  orient?: string
  markerUnits?: 'strokeWidth' | 'userSpaceOnUse'
  preserveAspectRatio?: string
  /** Marker content as structured nodes */
  children?: SvgNode[]
  /** Raw XML fallback for complex imported markers */
  rawXml?: string
}

// ── Symbol resource ───────────────────────────────────────────────────────────

export interface SymbolResource extends BaseResource {
  type: 'symbol'
  rootNodeId?: string
}

// ── Style block resource ──────────────────────────────────────────────────────

/**
 * An inline `<style>` block from an imported SVG document.
 * Stored here so the CSS cascade engine (Phase 15) can process selectors
 * independently from the structural node tree.
 */
export interface StyleBlockResource extends BaseResource {
  type: 'styleBlock'
  cssText: string
  media?: string
}

// ── Editor-native resources ───────────────────────────────────────────────────

export interface ComponentResource extends BaseResource {
  type: 'component'
  rootNodeId?: string
}

export interface TextStyleResource extends BaseResource {
  type: 'textStyle'
  style: Record<string, unknown>
}

export interface ExportSliceResource extends BaseResource {
  type: 'exportSlice'
  nodeIds: string[]
}

// ── Resource store ────────────────────────────────────────────────────────────

export interface ResourceStore {
  swatches: SwatchResource[]
  gradients: GradientResource[]
  patterns: PatternResource[]
  filters: FilterResource[]
  markers: MarkerResource[]
  symbols: SymbolResource[]
  styleBlocks: StyleBlockResource[]
  components: ComponentResource[]
  textStyles: TextStyleResource[]
  exportSlices: ExportSliceResource[]
}
