import type {
  SvgNode,
  SvgNodeType,
  RootNode,
  GroupNode,
  DefsNode,
  RectNode,
  CircleNode,
  EllipseNode,
  LineNode,
  PolylineNode,
  PolygonNode,
  StarNode,
  PathNode,
  TextNode,
  TspanNode,
  TextPathNode,
  ImageNode,
  SymbolNode,
  UseNode,
  ClipPathNode,
  MaskNode,
  MarkerNode,
  ForeignObjectNode,
  ANode,
  SwitchNode,
  StyleNode
} from './nodeTypes'

// ── Individual node type guards ───────────────────────────────────────────────

export function isRootNode(node: SvgNode): node is RootNode {
  return node.type === 'root'
}

export function isGroupNode(node: SvgNode): node is GroupNode {
  return node.type === 'group'
}

export function isDefsNode(node: SvgNode): node is DefsNode {
  return node.type === 'defs'
}

export function isRectNode(node: SvgNode): node is RectNode {
  return node.type === 'rect'
}

export function isCircleNode(node: SvgNode): node is CircleNode {
  return node.type === 'circle'
}

export function isEllipseNode(node: SvgNode): node is EllipseNode {
  return node.type === 'ellipse'
}

export function isLineNode(node: SvgNode): node is LineNode {
  return node.type === 'line'
}

export function isPolylineNode(node: SvgNode): node is PolylineNode {
  return node.type === 'polyline'
}

export function isPolygonNode(node: SvgNode): node is PolygonNode {
  return node.type === 'polygon'
}

export function isStarNode(node: SvgNode): node is StarNode {
  return node.type === 'star'
}

export function isPathNode(node: SvgNode): node is PathNode {
  return node.type === 'path'
}

export function isTextNode(node: SvgNode): node is TextNode {
  return node.type === 'text'
}

export function isTspanNode(node: SvgNode): node is TspanNode {
  return node.type === 'tspan'
}

export function isTextPathNode(node: SvgNode): node is TextPathNode {
  return node.type === 'textPath'
}

export function isImageNode(node: SvgNode): node is ImageNode {
  return node.type === 'image'
}

export function isSymbolNode(node: SvgNode): node is SymbolNode {
  return node.type === 'symbol'
}

export function isUseNode(node: SvgNode): node is UseNode {
  return node.type === 'use'
}

export function isClipPathNode(node: SvgNode): node is ClipPathNode {
  return node.type === 'clipPath'
}

export function isMaskNode(node: SvgNode): node is MaskNode {
  return node.type === 'mask'
}

export function isMarkerNode(node: SvgNode): node is MarkerNode {
  return node.type === 'marker'
}

export function isForeignObjectNode(node: SvgNode): node is ForeignObjectNode {
  return node.type === 'foreignObject'
}

export function isANode(node: SvgNode): node is ANode {
  return node.type === 'a'
}

export function isSwitchNode(node: SvgNode): node is SwitchNode {
  return node.type === 'switch'
}

export function isStyleNode(node: SvgNode): node is StyleNode {
  return node.type === 'style'
}

// ── Category guards ───────────────────────────────────────────────────────────

const CONTAINER_TYPES = new Set<SvgNodeType>([
  'root', 'group', 'defs', 'symbol', 'a', 'switch', 'clipPath', 'mask', 'marker'
])

/** True for nodes that contain other renderable children. */
export function isContainerNode(node: SvgNode): node is RootNode | GroupNode | DefsNode | SymbolNode | ANode | SwitchNode | ClipPathNode | MaskNode | MarkerNode {
  return CONTAINER_TYPES.has(node.type)
}

const SHAPE_TYPES = new Set<SvgNodeType>([
  'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'star', 'path'
])

/** True for nodes that represent geometric shapes. */
export function isShapeNode(node: SvgNode): node is RectNode | CircleNode | EllipseNode | LineNode | PolylineNode | PolygonNode | StarNode | PathNode {
  return SHAPE_TYPES.has(node.type)
}

const TEXT_TYPES = new Set<SvgNodeType>(['text', 'tspan', 'textPath'])

/** True for text-related nodes. */
export function isTextNodeType(node: SvgNode): node is TextNode | TspanNode | TextPathNode {
  return TEXT_TYPES.has(node.type)
}

const DEFS_LIKE_TYPES = new Set<SvgNodeType>([
  'defs', 'symbol', 'clipPath', 'mask', 'marker'
])

/**
 * True for nodes that live in defs and define reusable resources.
 * These are not rendered directly in the document flow.
 */
export function isDefsLikeNode(node: SvgNode): node is DefsNode | SymbolNode | ClipPathNode | MaskNode | MarkerNode {
  return DEFS_LIKE_TYPES.has(node.type)
}

const NON_RENDERABLE_TYPES = new Set<SvgNodeType>(['defs', 'style'])

/**
 * True for nodes that produce visible output in the SVG viewport.
 * Defs and style blocks are structural — they do not render.
 */
export function isRenderableNode(node: SvgNode): boolean {
  return !NON_RENDERABLE_TYPES.has(node.type)
}

const STRUCTURAL_TYPES = new Set<SvgNodeType>([
  'defs', 'symbol', 'clipPath', 'mask', 'marker'
])

/**
 * True for structural SVG elements that define reusable or referenced content
 * but are not themselves rendered into the viewport.
 */
export function isStructuralNode(node: SvgNode): node is DefsNode | SymbolNode | ClipPathNode | MaskNode | MarkerNode {
  return STRUCTURAL_TYPES.has(node.type)
}

/** True for any node that has a children array (including possibly empty). */
export function hasChildren(node: SvgNode): node is SvgNode & { children: SvgNode[] } {
  return Array.isArray((node as { children?: SvgNode[] }).children)
}
