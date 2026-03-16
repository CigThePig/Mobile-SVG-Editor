import { nanoid } from 'nanoid'
import type {
  SvgNode,
  RootNode,
  GroupNode,
  DefsNode,
  RectNode,
  CircleNode,
  EllipseNode,
  LineNode,
  PolylineNode,
  PolygonNode,
  PathNode,
  ImageNode,
  SymbolNode,
  UseNode,
  ClipPathNode,
  MaskNode,
  MarkerNode,
  ForeignObjectNode,
  ANode,
  SwitchNode,
  StyleNode,
  AppearanceModel,
  PaintModel,
  StrokeModel,
} from '@/model/nodes/nodeTypes'
import type { ParseContext } from './svgImportTypes'
import { DIAG, DISPLAY_ONLY_TAGS } from './svgImportTypes'
import { emitInfo } from './svgImportDiagnostics'
import {
  getEditabilityLevel,
  buildPreservationMeta,
  serializeChildren,
} from './svgImportPreservation'
import { parseTransform } from './svgParseTransforms'
import { resolveElementStyle, parseCssLength } from './svgParseStyles'
import { parseTextElement } from './svgParseText'
import { resolveHref, parseUrlRef } from './svgParseReferences'

// ── Known attribute sets per node type ───────────────────────────────────────

const SHAPE_BASE_ATTRS = new Set([
  'id', 'class', 'style', 'transform', 'visibility', 'display',
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
  'opacity', 'clip-path', 'mask', 'filter',
  'marker-start', 'marker-mid', 'marker-end',
  'mix-blend-mode', 'pointer-events', 'cursor',
])

const RECT_ATTRS = new Set([...SHAPE_BASE_ATTRS, 'x', 'y', 'width', 'height', 'rx', 'ry'])
const CIRCLE_ATTRS = new Set([...SHAPE_BASE_ATTRS, 'cx', 'cy', 'r'])
const ELLIPSE_ATTRS = new Set([...SHAPE_BASE_ATTRS, 'cx', 'cy', 'rx', 'ry'])
const LINE_ATTRS = new Set([...SHAPE_BASE_ATTRS, 'x1', 'y1', 'x2', 'y2'])
const POLY_ATTRS = new Set([...SHAPE_BASE_ATTRS, 'points'])
const PATH_ATTRS = new Set([...SHAPE_BASE_ATTRS, 'd'])
const IMAGE_ATTRS = new Set([...SHAPE_BASE_ATTRS, 'x', 'y', 'width', 'height', 'href', 'xlink:href', 'preserveAspectRatio'])
const USE_ATTRS = new Set([...SHAPE_BASE_ATTRS, 'x', 'y', 'width', 'height', 'href', 'xlink:href'])
const GROUP_ATTRS = new Set([...SHAPE_BASE_ATTRS])
const DEFS_ATTRS = new Set(['id', 'class', 'style'])
const SYMBOL_ATTRS = new Set(['id', 'class', 'style', 'viewBox', 'preserveAspectRatio', 'x', 'y', 'width', 'height', 'refX', 'refY'])
const CLIPPATH_ATTRS = new Set(['id', 'class', 'style', 'transform', 'clipPathUnits'])
const MASK_ATTRS = new Set(['id', 'class', 'style', 'transform', 'x', 'y', 'width', 'height', 'maskUnits', 'maskContentUnits'])
const MARKER_ATTRS = new Set(['id', 'class', 'style', 'transform', 'viewBox', 'refX', 'refY', 'markerWidth', 'markerHeight', 'orient', 'markerUnits', 'preserveAspectRatio'])
const A_ATTRS = new Set([...GROUP_ATTRS, 'href', 'xlink:href', 'target', 'rel', 'hreflang', 'type', 'download'])
const SWITCH_ATTRS = new Set([...GROUP_ATTRS])
const STYLE_ATTRS = new Set(['id', 'type', 'media', 'scoped'])

// ── Main dispatcher ───────────────────────────────────────────────────────────

/**
 * Convert a DOM Element into an SvgNode.
 * Handles all known SVG element types and preserves unknown ones.
 * Recursively processes children.
 */
export function parseElement(element: Element, ctx: ParseContext): SvgNode | null {
  const localName = element.localName

  // Skip display-only elements (SMIL, script) — they are preserved as info diagnostics
  if (DISPLAY_ONLY_TAGS.has(localName)) {
    ctx.hasDisplayOnlyContent = true
    const elId = element.getAttribute('id') ?? nanoid(8)
    emitInfo(ctx, DIAG.DISPLAY_ONLY_ELEMENT, `<${localName}> is a display-only element (SMIL/script) and cannot be edited`, {
      elementId: elId,
    })
    return null
  }

  switch (localName) {
    case 'g':
      return parseGroup(element, ctx)
    case 'defs':
      return parseDefs(element, ctx)
    case 'rect':
      return parseRect(element, ctx)
    case 'circle':
      return parseCircle(element, ctx)
    case 'ellipse':
      return parseEllipse(element, ctx)
    case 'line':
      return parseLine(element, ctx)
    case 'polyline':
      return parsePolyline(element, ctx)
    case 'polygon':
      return parsePolygon(element, ctx)
    case 'path':
      return parsePath(element, ctx)
    case 'text':
      return parseTextElement(element, ctx)
    case 'image':
      return parseImage(element, ctx)
    case 'use':
      return parseUse(element, ctx)
    case 'symbol':
      return parseSymbol(element, ctx)
    case 'clipPath':
      return parseClipPath(element, ctx)
    case 'mask':
      return parseMask(element, ctx)
    case 'marker':
      return parseMarkerNode(element, ctx)
    case 'foreignObject':
      return parseForeignObject(element, ctx)
    case 'a':
      return parseAnchor(element, ctx)
    case 'switch':
      return parseSwitchNode(element, ctx)
    case 'style':
      return parseStyleNode(element, ctx)
    default:
      return parseUnknownElement(element, ctx)
  }
}

/**
 * Parse all direct child elements of a container element, skipping nulls.
 */
function parseChildren(container: Element, ctx: ParseContext): SvgNode[] {
  const children: SvgNode[] = []
  for (const child of Array.from(container.children)) {
    const node = parseElement(child, ctx)
    if (node) children.push(node)
  }
  return children
}

// ── Appearance model parsing ──────────────────────────────────────────────────

function parseAppearance(resolvedStyle: Record<string, string>, element: Element): AppearanceModel {
  const appearance: AppearanceModel = {}

  // Fill
  const fillVal = resolvedStyle['fill'] ?? element.getAttribute('fill')
  if (fillVal != null) {
    appearance.fill = parsePaint(fillVal, resolvedStyle['fill-opacity'] ?? element.getAttribute('fill-opacity'))
  }

  // Stroke
  const strokeVal = resolvedStyle['stroke'] ?? element.getAttribute('stroke')
  const strokeWidth = resolvedStyle['stroke-width'] ?? element.getAttribute('stroke-width')
  if (strokeVal != null || strokeWidth != null) {
    appearance.stroke = parseStroke(resolvedStyle, element)
  }

  // Opacity
  const opacityVal = resolvedStyle['opacity'] ?? element.getAttribute('opacity')
  if (opacityVal != null) {
    const n = parseFloat(opacityVal)
    if (!isNaN(n)) appearance.opacity = n
  }

  // Blend mode
  const blendMode = resolvedStyle['mix-blend-mode'] ?? element.getAttribute('mix-blend-mode')
  if (blendMode) appearance.blendMode = blendMode

  // References
  const clipPath = resolvedStyle['clip-path'] ?? element.getAttribute('clip-path')
  if (clipPath) {
    const ref = parseUrlRef(clipPath)
    if (ref) appearance.clipPathRef = ref
  }

  const mask = resolvedStyle['mask'] ?? element.getAttribute('mask')
  if (mask) {
    const ref = parseUrlRef(mask)
    if (ref) appearance.maskRef = ref
  }

  const filter = resolvedStyle['filter'] ?? element.getAttribute('filter')
  if (filter) {
    const ref = parseUrlRef(filter)
    if (ref) appearance.filterRef = ref
  }

  // Marker references
  const markerStart = resolvedStyle['marker-start'] ?? element.getAttribute('marker-start')
  if (markerStart) {
    const ref = parseUrlRef(markerStart)
    if (ref) appearance.markerStartRef = ref
  }

  const markerMid = resolvedStyle['marker-mid'] ?? element.getAttribute('marker-mid')
  if (markerMid) {
    const ref = parseUrlRef(markerMid)
    if (ref) appearance.markerMidRef = ref
  }

  const markerEnd = resolvedStyle['marker-end'] ?? element.getAttribute('marker-end')
  if (markerEnd) {
    const ref = parseUrlRef(markerEnd)
    if (ref) appearance.markerEndRef = ref
  }

  return appearance
}

function parsePaint(value: string, opacityStr: string | null | undefined): PaintModel {
  const trimmed = value.trim()
  if (trimmed === 'none') return { kind: 'none' }

  const urlRef = parseUrlRef(trimmed)
  if (urlRef) {
    // Could be gradient or pattern — we don't know until we check the registry
    // Default to gradient; the serializer handles both the same way
    return { kind: 'gradient', resourceId: urlRef }
  }

  // Solid color
  const opacity = opacityStr ? parseFloat(opacityStr) : undefined
  return {
    kind: 'solid',
    color: trimmed,
    opacity: opacity != null && !isNaN(opacity) && opacity < 1 ? opacity : undefined,
  }
}

function parseStroke(style: Record<string, string>, element: Element): StrokeModel {
  const strokeVal = style['stroke'] ?? element.getAttribute('stroke') ?? 'none'

  if (strokeVal === 'none') {
    return { width: 0 }
  }

  const widthStr = style['stroke-width'] ?? element.getAttribute('stroke-width') ?? '1'
  const width = parseFloat(widthStr)

  const stroke: StrokeModel = {
    color: strokeVal,
    width: isNaN(width) ? 1 : width,
  }

  const opacity = style['stroke-opacity'] ?? element.getAttribute('stroke-opacity')
  if (opacity) {
    const n = parseFloat(opacity)
    if (!isNaN(n)) stroke.opacity = n
  }

  const lineCap = style['stroke-linecap'] ?? element.getAttribute('stroke-linecap')
  if (lineCap) stroke.lineCap = lineCap as StrokeModel['lineCap']

  const lineJoin = style['stroke-linejoin'] ?? element.getAttribute('stroke-linejoin')
  if (lineJoin) stroke.lineJoin = lineJoin as StrokeModel['lineJoin']

  const miterLimit = style['stroke-miterlimit'] ?? element.getAttribute('stroke-miterlimit')
  if (miterLimit) {
    const n = parseFloat(miterLimit)
    if (!isNaN(n)) stroke.miterLimit = n
  }

  const dashArray = style['stroke-dasharray'] ?? element.getAttribute('stroke-dasharray')
  if (dashArray && dashArray !== 'none') {
    const parts = dashArray.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n))
    if (parts.length > 0) stroke.dashArray = parts
  }

  const dashOffset = style['stroke-dashoffset'] ?? element.getAttribute('stroke-dashoffset')
  if (dashOffset) {
    const n = parseFloat(dashOffset)
    if (!isNaN(n)) stroke.dashOffset = n
  }

  return stroke
}

// ── Base node helpers ─────────────────────────────────────────────────────────

function getNodeId(element: Element): string {
  return element.getAttribute('id') ?? nanoid(8)
}

function isVisible(element: Element, resolvedStyle: Record<string, string>): boolean {
  const vis = resolvedStyle['visibility'] ?? element.getAttribute('visibility')
  const disp = resolvedStyle['display'] ?? element.getAttribute('display')
  return vis !== 'hidden' && disp !== 'none'
}

// ── Shape parsers ─────────────────────────────────────────────────────────────

function parseRect(el: Element, ctx: ParseContext): RectNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  const transform = parseTransform(el.getAttribute('transform'), ctx, id)
  const style = parseAppearance(resolved, el)

  const rx = el.getAttribute('rx')
  const ry = el.getAttribute('ry')

  return {
    id,
    type: 'rect',
    visible: isVisible(el, resolved),
    locked: false,
    x: parseFloat(el.getAttribute('x') ?? '0'),
    y: parseFloat(el.getAttribute('y') ?? '0'),
    width: parseFloat(el.getAttribute('width') ?? '0'),
    height: parseFloat(el.getAttribute('height') ?? '0'),
    rx: rx != null ? parseFloat(rx) : undefined,
    ry: ry != null ? parseFloat(ry) : undefined,
    style,
    transform,
    className: el.getAttribute('class') ?? undefined,
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 1, knownAttrs: RECT_ATTRS }),
  }
}

function parseCircle(el: Element, ctx: ParseContext): CircleNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  return {
    id,
    type: 'circle',
    visible: isVisible(el, resolved),
    locked: false,
    cx: parseFloat(el.getAttribute('cx') ?? '0'),
    cy: parseFloat(el.getAttribute('cy') ?? '0'),
    r: parseFloat(el.getAttribute('r') ?? '0'),
    style: parseAppearance(resolved, el),
    transform: parseTransform(el.getAttribute('transform'), ctx, id),
    className: el.getAttribute('class') ?? undefined,
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 1, knownAttrs: CIRCLE_ATTRS }),
  }
}

function parseEllipse(el: Element, ctx: ParseContext): EllipseNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  return {
    id,
    type: 'ellipse',
    visible: isVisible(el, resolved),
    locked: false,
    cx: parseFloat(el.getAttribute('cx') ?? '0'),
    cy: parseFloat(el.getAttribute('cy') ?? '0'),
    rx: parseFloat(el.getAttribute('rx') ?? '0'),
    ry: parseFloat(el.getAttribute('ry') ?? '0'),
    style: parseAppearance(resolved, el),
    transform: parseTransform(el.getAttribute('transform'), ctx, id),
    className: el.getAttribute('class') ?? undefined,
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 1, knownAttrs: ELLIPSE_ATTRS }),
  }
}

function parseLine(el: Element, ctx: ParseContext): LineNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  return {
    id,
    type: 'line',
    visible: isVisible(el, resolved),
    locked: false,
    x1: parseFloat(el.getAttribute('x1') ?? '0'),
    y1: parseFloat(el.getAttribute('y1') ?? '0'),
    x2: parseFloat(el.getAttribute('x2') ?? '0'),
    y2: parseFloat(el.getAttribute('y2') ?? '0'),
    style: parseAppearance(resolved, el),
    transform: parseTransform(el.getAttribute('transform'), ctx, id),
    className: el.getAttribute('class') ?? undefined,
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 1, knownAttrs: LINE_ATTRS }),
  }
}

function parsePoints(pointsStr: string | null): Array<{ x: number; y: number }> {
  if (!pointsStr) return []
  const nums = pointsStr.trim().split(/[\s,]+/).map(Number)
  const points: Array<{ x: number; y: number }> = []
  for (let i = 0; i < nums.length - 1; i += 2) {
    points.push({ x: nums[i], y: nums[i + 1] })
  }
  return points
}

function parsePolyline(el: Element, ctx: ParseContext): PolylineNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  return {
    id,
    type: 'polyline',
    visible: isVisible(el, resolved),
    locked: false,
    points: parsePoints(el.getAttribute('points')),
    style: parseAppearance(resolved, el),
    transform: parseTransform(el.getAttribute('transform'), ctx, id),
    className: el.getAttribute('class') ?? undefined,
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 1, knownAttrs: POLY_ATTRS }),
  }
}

function parsePolygon(el: Element, ctx: ParseContext): PolygonNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  return {
    id,
    type: 'polygon',
    visible: isVisible(el, resolved),
    locked: false,
    points: parsePoints(el.getAttribute('points')),
    style: parseAppearance(resolved, el),
    transform: parseTransform(el.getAttribute('transform'), ctx, id),
    className: el.getAttribute('class') ?? undefined,
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 1, knownAttrs: POLY_ATTRS }),
  }
}

function parsePath(el: Element, ctx: ParseContext): PathNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  return {
    id,
    type: 'path',
    visible: isVisible(el, resolved),
    locked: false,
    d: el.getAttribute('d') ?? '',
    style: parseAppearance(resolved, el),
    transform: parseTransform(el.getAttribute('transform'), ctx, id),
    className: el.getAttribute('class') ?? undefined,
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 1, knownAttrs: PATH_ATTRS }),
  }
}

// ── Container parsers ─────────────────────────────────────────────────────────

function parseGroup(el: Element, ctx: ParseContext): GroupNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  return {
    id,
    type: 'group',
    name: el.getAttribute('data-name') ?? el.getAttribute('inkscape:label') ?? undefined,
    visible: isVisible(el, resolved),
    locked: false,
    children: parseChildren(el, ctx),
    style: parseAppearance(resolved, el),
    transform: parseTransform(el.getAttribute('transform'), ctx, id),
    className: el.getAttribute('class') ?? undefined,
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 1, knownAttrs: GROUP_ATTRS }),
  }
}

function parseDefs(el: Element, ctx: ParseContext): DefsNode {
  const id = getNodeId(el)
  // For defs, we parse children for structural nodes (clipPath, mask, symbol, etc.)
  // Resources (gradients, filters, etc.) were already collected in pass 1
  return {
    id,
    type: 'defs',
    visible: true,
    locked: false,
    children: parseChildren(el, ctx),
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 1, knownAttrs: DEFS_ATTRS }),
  }
}

function parseSymbol(el: Element, ctx: ParseContext): SymbolNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  return {
    id,
    type: 'symbol',
    visible: isVisible(el, resolved),
    locked: false,
    viewBox: el.getAttribute('viewBox') ?? undefined,
    preserveAspectRatio: el.getAttribute('preserveAspectRatio') ?? undefined,
    children: parseChildren(el, ctx),
    style: parseAppearance(resolved, el),
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 2, knownAttrs: SYMBOL_ATTRS }),
  }
}

function parseClipPath(el: Element, ctx: ParseContext): ClipPathNode {
  const id = getNodeId(el)
  return {
    id,
    type: 'clipPath',
    visible: true,
    locked: false,
    clipPathUnits: (el.getAttribute('clipPathUnits') as ClipPathNode['clipPathUnits']) ?? undefined,
    children: parseChildren(el, ctx),
    transform: parseTransform(el.getAttribute('transform'), ctx, id),
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 2, knownAttrs: CLIPPATH_ATTRS }),
  }
}

function parseMask(el: Element, ctx: ParseContext): MaskNode {
  const id = getNodeId(el)
  const xStr = el.getAttribute('x')
  const yStr = el.getAttribute('y')
  const wStr = el.getAttribute('width')
  const hStr = el.getAttribute('height')
  return {
    id,
    type: 'mask',
    visible: true,
    locked: false,
    maskUnits: (el.getAttribute('maskUnits') as MaskNode['maskUnits']) ?? undefined,
    maskContentUnits: (el.getAttribute('maskContentUnits') as MaskNode['maskContentUnits']) ?? undefined,
    x: xStr != null ? parseFloat(xStr) : undefined,
    y: yStr != null ? parseFloat(yStr) : undefined,
    width: wStr != null ? parseFloat(wStr) : undefined,
    height: hStr != null ? parseFloat(hStr) : undefined,
    children: parseChildren(el, ctx),
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 2, knownAttrs: MASK_ATTRS }),
  }
}

function parseMarkerNode(el: Element, ctx: ParseContext): MarkerNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)

  const parseCoord = (v: string | null): number | string | undefined => {
    if (v == null) return undefined
    const n = parseFloat(v)
    return isNaN(n) ? v : n
  }

  return {
    id,
    type: 'marker',
    visible: true,
    locked: false,
    viewBox: el.getAttribute('viewBox') ?? undefined,
    refX: parseCoord(el.getAttribute('refX')),
    refY: parseCoord(el.getAttribute('refY')),
    markerWidth: parseCoord(el.getAttribute('markerWidth')),
    markerHeight: parseCoord(el.getAttribute('markerHeight')),
    orient: el.getAttribute('orient') ?? undefined,
    markerUnits: (el.getAttribute('markerUnits') as MarkerNode['markerUnits']) ?? undefined,
    preserveAspectRatio: el.getAttribute('preserveAspectRatio') ?? undefined,
    children: parseChildren(el, ctx),
    style: parseAppearance(resolved, el),
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 2, knownAttrs: MARKER_ATTRS }),
  }
}

function parseForeignObject(el: Element, ctx: ParseContext): ForeignObjectNode {
  const id = getNodeId(el)
  ctx.hasPreservedContent = true

  const rawXml = serializeChildren(el)
  const diagId = emitInfo(ctx, DIAG.UNKNOWN_ELEMENT_PRESERVED, `<foreignObject> content preserved as raw XML`, {
    elementId: id,
  })

  const xStr = el.getAttribute('x')
  const yStr = el.getAttribute('y')
  const wStr = el.getAttribute('width')
  const hStr = el.getAttribute('height')

  return {
    id,
    type: 'foreignObject',
    visible: true,
    locked: false,
    x: xStr != null ? parseFloat(xStr) : undefined,
    y: yStr != null ? parseFloat(yStr) : undefined,
    width: wStr != null ? parseFloat(wStr) : undefined,
    height: hStr != null ? parseFloat(hStr) : undefined,
    rawXml: rawXml || undefined,
    preservation: buildPreservationMeta({
      element: el,
      editabilityLevel: 3,
      knownAttrs: new Set(['id', 'x', 'y', 'width', 'height']),
      diagnosticIds: [diagId],
      captureRawChildren: false, // rawXml is handled above
    }),
  }
}

function parseAnchor(el: Element, ctx: ParseContext): ANode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  const href = el.getAttribute('href') ??
    el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ??
    undefined
  return {
    id,
    type: 'a',
    visible: isVisible(el, resolved),
    locked: false,
    href,
    target: el.getAttribute('target') ?? undefined,
    children: parseChildren(el, ctx),
    style: parseAppearance(resolved, el),
    transform: parseTransform(el.getAttribute('transform'), ctx, id),
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 2, knownAttrs: A_ATTRS }),
  }
}

function parseSwitchNode(el: Element, ctx: ParseContext): SwitchNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  return {
    id,
    type: 'switch',
    visible: isVisible(el, resolved),
    locked: false,
    children: parseChildren(el, ctx),
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 2, knownAttrs: SWITCH_ATTRS }),
  }
}

function parseStyleNode(el: Element, ctx: ParseContext): StyleNode {
  const id = getNodeId(el)
  return {
    id,
    type: 'style',
    visible: true,
    locked: false,
    cssText: el.textContent ?? '',
    mediaQuery: el.getAttribute('media') ?? undefined,
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 2, knownAttrs: STYLE_ATTRS }),
  }
}

function parseImage(el: Element, ctx: ParseContext): ImageNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  const href = resolveHref(el) ??
    el.getAttribute('href') ??
    el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ??
    ''
  return {
    id,
    type: 'image',
    visible: isVisible(el, resolved),
    locked: false,
    x: parseFloat(el.getAttribute('x') ?? '0'),
    y: parseFloat(el.getAttribute('y') ?? '0'),
    width: parseFloat(el.getAttribute('width') ?? '0'),
    height: parseFloat(el.getAttribute('height') ?? '0'),
    href,
    preserveAspectRatio: el.getAttribute('preserveAspectRatio') ?? undefined,
    transform: parseTransform(el.getAttribute('transform'), ctx, id),
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 2, knownAttrs: IMAGE_ATTRS }),
  }
}

function parseUse(el: Element, ctx: ParseContext): UseNode {
  const id = getNodeId(el)
  const resolved = resolveElementStyle(el, ctx)
  const href = resolveHref(el) ?? ''

  const xStr = el.getAttribute('x')
  const yStr = el.getAttribute('y')
  const wStr = el.getAttribute('width')
  const hStr = el.getAttribute('height')

  return {
    id,
    type: 'use',
    visible: isVisible(el, resolved),
    locked: false,
    href,
    x: xStr != null ? parseFloat(xStr) : undefined,
    y: yStr != null ? parseFloat(yStr) : undefined,
    width: wStr != null ? parseFloat(wStr) : undefined,
    height: hStr != null ? parseFloat(hStr) : undefined,
    style: parseAppearance(resolved, el),
    transform: parseTransform(el.getAttribute('transform'), ctx, id),
    preservation: buildPreservationMeta({ element: el, editabilityLevel: 2, knownAttrs: USE_ATTRS }),
  }
}

// ── Unknown element preservation ──────────────────────────────────────────────

function parseUnknownElement(el: Element, ctx: ParseContext): SvgNode | null {
  const localName = el.localName
  ctx.hasUnknownElements = true

  // Determine if it's a namespaced element (Inkscape, Sodipodi, etc.)
  const hasNonSvgNamespace = el.namespaceURI !== null && el.namespaceURI !== 'http://www.w3.org/2000/svg'
  const editabilityLevel = hasNonSvgNamespace ? 3 : 3

  const diagId = emitInfo(
    ctx,
    DIAG.UNKNOWN_ELEMENT_PRESERVED,
    `<${localName}> is not a recognized SVG element; preserved as raw content`,
    { elementId: el.getAttribute('id') ?? undefined }
  )

  // Check if this element has children that contain known SVG (e.g. Inkscape extensions)
  // In that case, we can try to parse the children and group them
  const svgChildren = Array.from(el.children).filter(
    (child) => child.namespaceURI === 'http://www.w3.org/2000/svg'
  )

  if (svgChildren.length > 0) {
    // Wrap known SVG children in a group with preservation metadata
    const groupId = el.getAttribute('id') ?? nanoid(8)
    ctx.hasPreservedContent = true
    return {
      id: groupId,
      type: 'group',
      visible: true,
      locked: false,
      children: svgChildren.map((child) => parseElement(child, ctx)).filter(Boolean) as SvgNode[],
      preservation: {
        sourceElementName: localName,
        editabilityLevel,
        rawAttributes: collectRawAttrsFromElement(el),
        rawChildren: serializeChildren(el),
        importDiagnosticIds: [diagId],
      },
    }
  }

  // Fully unknown — store as a group with rawChildren
  ctx.hasPreservedContent = true
  return {
    id: el.getAttribute('id') ?? nanoid(8),
    type: 'group',
    visible: true,
    locked: false,
    children: [],
    preservation: {
      sourceElementName: localName,
      editabilityLevel,
      rawAttributes: collectRawAttrsFromElement(el),
      rawChildren: serializeChildren(el) || undefined,
      importDiagnosticIds: [diagId],
    },
  }
}

function collectRawAttrsFromElement(el: Element): Record<string, string> | undefined {
  const raw: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) {
    if (!attr.name.startsWith('xmlns')) {
      raw[attr.name] = attr.value
    }
  }
  return Object.keys(raw).length > 0 ? raw : undefined
}

// ── Root node builder ─────────────────────────────────────────────────────────

/**
 * Build the root SvgNode tree from the `<svg>` element's children.
 * This is called during pass 2 of the parse.
 */
export function buildRootNode(svgElement: Element, ctx: ParseContext): RootNode {
  const children: SvgNode[] = []

  for (const child of Array.from(svgElement.children)) {
    // Skip <style> elements at root level (already in resources.styleBlocks)
    // but we DO include them as StyleNode in the tree for structural accuracy
    const node = parseElement(child, ctx)
    if (node) children.push(node)
  }

  return {
    id: 'root',
    type: 'root',
    visible: true,
    locked: false,
    children,
  }
}
