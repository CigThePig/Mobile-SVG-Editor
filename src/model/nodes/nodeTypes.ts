// ── Node type discriminants ───────────────────────────────────────────────────

export type SvgNodeType =
  | 'root'
  | 'group'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'polygon'
  | 'star'
  | 'path'
  | 'text'
  | 'image'
  | 'symbol'
  | 'use'
  | 'clipPath'
  | 'mask'
  | 'marker'
  | 'defs'
  | 'tspan'
  | 'textPath'
  | 'foreignObject'
  | 'a'
  | 'switch'
  | 'style'

// ── Preservation metadata ─────────────────────────────────────────────────────
//
// Carried by every node that was imported from raw SVG. Enables the
// loss-aware import engine (Phase 2) and round-trip serializer (Phase 3)
// to reconstruct the original element faithfully.

export interface PreservationMeta {
  /** Original SVG element tag name (e.g. 'linearGradient', 'feBlend') */
  sourceElementName: string
  /**
   * Editability tier:
   *   1 = Full — all properties are editable, round-trip safe
   *   2 = Partial — most properties editable; some may not survive round-trip
   *   3 = Preserved-raw — recognized but not visually editable; source-mode only
   *   4 = Display-only — renders but cannot be selected/edited
   */
  editabilityLevel: 1 | 2 | 3 | 4
  /** Unknown/unsupported SVG attributes preserved verbatim */
  rawAttributes?: Record<string, string>
  /** Raw XML string of unrecognized child elements */
  rawChildren?: string
  /** Byte offset in source document for source-map linking (Phase 3) */
  sourceOffset?: number
  /** IDs of ImportDiagnostic entries relating to this node (Phase 2) */
  importDiagnosticIds?: string[]
}

// ── Transform model ───────────────────────────────────────────────────────────

export interface TransformModel {
  translateX?: number
  translateY?: number
  scaleX?: number
  scaleY?: number
  rotate?: number
  skewX?: number
  skewY?: number
  pivotX?: number
  pivotY?: number
  /** Raw 2D transform matrix [a, b, c, d, e, f] */
  matrix?: [number, number, number, number, number, number]
}

// ── Paint and stroke models ───────────────────────────────────────────────────

export type PaintModel =
  | { kind: 'none' }
  | { kind: 'solid'; color: string; opacity?: number }
  | { kind: 'gradient'; resourceId: string }
  | { kind: 'pattern'; resourceId: string }

export interface StrokeModel {
  color?: string
  width: number
  opacity?: number
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'miter' | 'round' | 'bevel'
  miterLimit?: number
  dashArray?: number[]
  dashOffset?: number
  nonScaling?: boolean
}

export interface AppearanceModel {
  fill?: PaintModel
  stroke?: StrokeModel
  opacity?: number
  blendMode?: string
  filterRef?: string
  maskRef?: string
  clipPathRef?: string
  markerStartRef?: string
  markerMidRef?: string
  markerEndRef?: string
}

// ── Text style model ──────────────────────────────────────────────────────────

export interface TextStyleModel {
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  fontStyle?: 'normal' | 'italic' | 'oblique'
  lineHeight?: number
  letterSpacing?: number
  textAlign?: 'left' | 'center' | 'right'
  textDecoration?: string
  textAnchor?: 'start' | 'middle' | 'end'
  dominantBaseline?: string
  writingMode?: string
}

// ── Base node ─────────────────────────────────────────────────────────────────

export interface BaseNode {
  id: string
  type: SvgNodeType
  name?: string
  visible: boolean
  locked: boolean
  opacity?: number
  className?: string
  /** Raw SVG attributes for pass-through (aria-*, data-*, xml:*, etc.) */
  attributes?: Record<string, string>
  transform?: TransformModel
  children?: SvgNode[]
  /** Import fidelity metadata — present only on nodes from imported SVG */
  preservation?: PreservationMeta
}

// ── Container nodes ───────────────────────────────────────────────────────────

export interface RootNode extends BaseNode {
  type: 'root'
  children: SvgNode[]
}

export interface GroupNode extends BaseNode {
  type: 'group'
  children: SvgNode[]
  style?: AppearanceModel
}

export interface DefsNode extends BaseNode {
  type: 'defs'
  children: SvgNode[]
}

// ── Shape nodes ───────────────────────────────────────────────────────────────

export interface RectNode extends BaseNode {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
  rx?: number
  ry?: number
  style?: AppearanceModel
}

export interface CircleNode extends BaseNode {
  type: 'circle'
  cx: number
  cy: number
  r: number
  style?: AppearanceModel
}

export interface EllipseNode extends BaseNode {
  type: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
  style?: AppearanceModel
}

export interface LineNode extends BaseNode {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  style?: AppearanceModel
}

export interface PolylineNode extends BaseNode {
  type: 'polyline'
  points: Array<{ x: number; y: number }>
  style?: AppearanceModel
}

export interface PolygonNode extends BaseNode {
  type: 'polygon'
  points: Array<{ x: number; y: number }>
  style?: AppearanceModel
}

export interface StarNode extends BaseNode {
  type: 'star'
  cx: number
  cy: number
  outerRadius: number
  innerRadius: number
  numPoints: number
  style?: AppearanceModel
}

export interface PathNode extends BaseNode {
  type: 'path'
  d: string
  style?: AppearanceModel
}

// ── Text nodes ────────────────────────────────────────────────────────────────

/**
 * A tspan run within a text or tspan element.
 * Tspan nodes appear as children of TextNode (via `runs`) or recursively
 * within other TspanNodes for nested spans.
 */
export interface TspanNode extends BaseNode {
  type: 'tspan'
  /** Absolute x position(s) — comma-separated list allowed in SVG */
  x?: number
  /** Absolute y position(s) */
  y?: number
  /** Relative x shift(s) */
  dx?: number
  /** Relative y shift(s) */
  dy?: number
  /** Per-character rotation values */
  rotate?: number
  /** Target length for the text */
  textLength?: number
  /** Plain text content (used when runs is empty) */
  content?: string
  /** Nested tspan children */
  runs?: TspanNode[]
  textStyle?: TextStyleModel
  style?: AppearanceModel
}

/**
 * Text element. Supports both:
 *   - Simple mode: content string (editor-native, backward-compatible)
 *   - Rich mode: runs array of TspanNode (imported SVG with tspan children)
 *
 * When `runs` is present and non-empty it takes precedence over `content`
 * for rendering purposes.
 */
export interface TextNode extends BaseNode {
  type: 'text'
  x: number
  y: number
  /** Plain text content — used for editor-native text and backward compat */
  content: string
  /** Rich text runs (tspan children) — populated by the import engine */
  runs?: TspanNode[]
  textStyle?: TextStyleModel
  style?: AppearanceModel
}

/**
 * Text laid out along an SVG path via xlink:href / href.
 * Appears as a child of TextNode in the tree.
 */
export interface TextPathNode extends BaseNode {
  type: 'textPath'
  /** Reference to a path element id */
  href: string
  /** Offset along the path (number = user units, string = percentage) */
  startOffset?: number | string
  method?: 'align' | 'stretch'
  spacing?: 'auto' | 'exact'
  /** Plain text content */
  content?: string
  /** Nested tspan runs */
  runs?: TspanNode[]
  textStyle?: TextStyleModel
}

// ── Image node ────────────────────────────────────────────────────────────────

export interface ImageNode extends BaseNode {
  type: 'image'
  x: number
  y: number
  width: number
  height: number
  href: string
  /** Preserve aspect ratio attribute */
  preserveAspectRatio?: string
}

// ── Structural / defs-related nodes ──────────────────────────────────────────

/**
 * SVG symbol element — reusable graphic defined in defs.
 * Instances are created via UseNode.
 */
export interface SymbolNode extends BaseNode {
  type: 'symbol'
  viewBox?: string
  preserveAspectRatio?: string
  children: SvgNode[]
  style?: AppearanceModel
}

/** SVG use element — creates an instance of a symbol or any referenced element. */
export interface UseNode extends BaseNode {
  type: 'use'
  /** Reference to the target element id (may be '#id' or full IRI) */
  href: string
  x?: number
  y?: number
  width?: number
  height?: number
  style?: AppearanceModel
}

/** SVG clipPath element — defines a clipping region. */
export interface ClipPathNode extends BaseNode {
  type: 'clipPath'
  clipPathUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  children: SvgNode[]
}

/** SVG mask element — defines a luminance or alpha mask. */
export interface MaskNode extends BaseNode {
  type: 'mask'
  maskUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  maskContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  x?: number
  y?: number
  width?: number
  height?: number
  children: SvgNode[]
}

/** SVG marker element — defines arrowheads and other path markers. */
export interface MarkerNode extends BaseNode {
  type: 'marker'
  viewBox?: string
  refX?: number | string
  refY?: number | string
  markerWidth?: number | string
  markerHeight?: number | string
  orient?: string
  markerUnits?: 'strokeWidth' | 'userSpaceOnUse'
  preserveAspectRatio?: string
  children: SvgNode[]
  style?: AppearanceModel
}

// ── Passthrough / raw nodes ───────────────────────────────────────────────────

/**
 * SVG foreignObject — embeds HTML or other XML namespaces.
 * Content is stored as raw XML and rendered but not editable in visual mode.
 */
export interface ForeignObjectNode extends BaseNode {
  type: 'foreignObject'
  x?: number
  y?: number
  width?: number
  height?: number
  /** Raw XML content of the foreignObject element */
  rawXml?: string
}

/**
 * SVG anchor element — hyperlink wrapper.
 * Children are rendered normally; href provides navigation target.
 */
export interface ANode extends BaseNode {
  type: 'a'
  href?: string
  target?: string
  children: SvgNode[]
  style?: AppearanceModel
}

/**
 * SVG switch element — renders the first child whose required features match.
 * Treated as a simple container; feature testing is not performed.
 */
export interface SwitchNode extends BaseNode {
  type: 'switch'
  children: SvgNode[]
}

/**
 * Inline SVG style element — holds a CSS text block.
 * Stored in the node tree at its original position; also mirrored
 * in ResourceStore.styleBlocks for CSS cascade processing (Phase 15).
 */
export interface StyleNode extends BaseNode {
  type: 'style'
  cssText: string
  mediaQuery?: string
}

// ── Full union type ───────────────────────────────────────────────────────────

export type SvgNode =
  | RootNode
  | GroupNode
  | DefsNode
  | RectNode
  | CircleNode
  | EllipseNode
  | LineNode
  | PolylineNode
  | PolygonNode
  | StarNode
  | PathNode
  | TextNode
  | TspanNode
  | TextPathNode
  | ImageNode
  | SymbolNode
  | UseNode
  | ClipPathNode
  | MaskNode
  | MarkerNode
  | ForeignObjectNode
  | ANode
  | SwitchNode
  | StyleNode
