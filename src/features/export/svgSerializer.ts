import type { SvgDocument } from '@/model/document/documentTypes'
import type {
  SvgNode,
  TransformModel,
  CircleNode,
  EllipseNode,
  LineNode,
  PathNode,
  PolygonNode,
  PolylineNode,
  RectNode,
  StarNode,
  TextNode,
  TspanNode,
  TextPathNode,
  ImageNode,
  GroupNode,
  DefsNode,
  SymbolNode,
  UseNode,
  ClipPathNode,
  MaskNode,
  MarkerNode,
  ForeignObjectNode,
  ANode,
  SwitchNode,
  StyleNode
} from '@/model/nodes/nodeTypes'
import type { GradientResource, StyleBlockResource } from '@/model/resources/resourceTypes'

// ── Transform ────────────────────────────────────────────────────────────────

function transformToString(transform?: TransformModel): string {
  if (!transform) return ''
  const parts: string[] = []

  if (transform.translateX || transform.translateY) {
    parts.push(`translate(${transform.translateX ?? 0} ${transform.translateY ?? 0})`)
  }
  if (transform.pivotX != null && transform.pivotY != null) {
    parts.push(`translate(${transform.pivotX} ${transform.pivotY})`)
  }
  if (transform.rotate) {
    parts.push(`rotate(${transform.rotate})`)
  }
  if (transform.scaleX != null || transform.scaleY != null) {
    parts.push(`scale(${transform.scaleX ?? 1} ${transform.scaleY ?? 1})`)
  }
  if (transform.skewX) parts.push(`skewX(${transform.skewX})`)
  if (transform.skewY) parts.push(`skewY(${transform.skewY})`)
  if (transform.pivotX != null && transform.pivotY != null) {
    parts.push(`translate(${-transform.pivotX} ${-transform.pivotY})`)
  }

  return parts.join(' ')
}

// ── Fill / stroke helpers ────────────────────────────────────────────────────

function fillAttr(node: { style?: { fill?: { kind: string; color?: string; resourceId?: string } } }): string {
  const fill = node.style?.fill
  if (!fill || fill.kind === 'none') return 'none'
  if (fill.kind === 'solid') return fill.color ?? '#000000'
  if (fill.kind === 'gradient' && fill.resourceId) return `url(#${fill.resourceId})`
  if (fill.kind === 'pattern' && fill.resourceId) return `url(#${fill.resourceId})`
  return 'none'
}

function strokeAttrs(node: { style?: { stroke?: { color?: string; width: number; opacity?: number; lineCap?: string; lineJoin?: string; dashArray?: number[]; dashOffset?: number } } }): string {
  const s = node.style?.stroke
  if (!s || s.width === 0) return 'stroke="none" stroke-width="0"'
  const parts = [
    `stroke="${s.color ?? '#000000'}"`,
    `stroke-width="${s.width}"`,
  ]
  if (s.opacity != null && s.opacity < 1) parts.push(`stroke-opacity="${s.opacity}"`)
  if (s.lineCap) parts.push(`stroke-linecap="${s.lineCap}"`)
  if (s.lineJoin) parts.push(`stroke-linejoin="${s.lineJoin}"`)
  if (s.dashArray?.length) parts.push(`stroke-dasharray="${s.dashArray.join(' ')}"`)
  if (s.dashOffset) parts.push(`stroke-dashoffset="${s.dashOffset}"`)
  return parts.join(' ')
}

function commonAttrs(node: SvgNode): string {
  const parts: string[] = []
  if (node.transform) {
    const t = transformToString(node.transform)
    if (t) parts.push(`transform="${t}"`)
  }
  const styleNode = node as { style?: { opacity?: number } }
  if (styleNode.style?.opacity != null && styleNode.style.opacity < 1) {
    parts.push(`opacity="${styleNode.style.opacity}"`)
  }
  return parts.join(' ')
}

/** Serialize raw passthrough attributes from node.attributes */
function rawAttrs(node: SvgNode): string {
  if (!node.attributes) return ''
  return Object.entries(node.attributes)
    .map(([k, v]) => `${k}="${e(v)}"`)
    .join(' ')
}

function e(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Star ─────────────────────────────────────────────────────────────────────

function computeStarPoints(cx: number, cy: number, outer: number, inner: number, n: number): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const angle = (Math.PI / n) * i - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`)
  }
  return pts.join(' ')
}

// ── Text helpers ──────────────────────────────────────────────────────────────

function serializeTspan(tspan: TspanNode): string {
  const parts: string[] = ['<tspan']
  if (tspan.x != null) parts.push(` x="${tspan.x}"`)
  if (tspan.y != null) parts.push(` y="${tspan.y}"`)
  if (tspan.dx != null) parts.push(` dx="${tspan.dx}"`)
  if (tspan.dy != null) parts.push(` dy="${tspan.dy}"`)
  if (tspan.rotate != null) parts.push(` rotate="${tspan.rotate}"`)
  if (tspan.textLength != null) parts.push(` textLength="${tspan.textLength}"`)
  if (tspan.textStyle?.fontFamily) parts.push(` font-family="${e(tspan.textStyle.fontFamily)}"`)
  if (tspan.textStyle?.fontSize) parts.push(` font-size="${tspan.textStyle.fontSize}"`)
  if (tspan.textStyle?.fontWeight) parts.push(` font-weight="${tspan.textStyle.fontWeight}"`)
  if (tspan.textStyle?.textAnchor) parts.push(` text-anchor="${tspan.textStyle.textAnchor}"`)
  if (rawAttrs(tspan as unknown as SvgNode)) parts.push(` ${rawAttrs(tspan as unknown as SvgNode)}`)
  parts.push('>')

  if (tspan.runs?.length) {
    parts.push(tspan.runs.map(serializeTspan).join(''))
  } else {
    parts.push(e(tspan.content ?? ''))
  }
  parts.push('</tspan>')
  return parts.join('')
}

// ── Node serializer ──────────────────────────────────────────────────────────

function serializeNode(node: SvgNode): string {
  if (node.visible === false) return ''

  const common = commonAttrs(node)
  const raw = rawAttrs(node)
  const rawPart = raw ? ` ${raw}` : ''

  switch (node.type) {
    case 'rect': {
      const n = node as RectNode
      const rx = n.rx ? ` rx="${n.rx}"` : ''
      const ry = n.ry ? ` ry="${n.ry}"` : ''
      return `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}"${rx}${ry} fill="${fillAttr(n)}" ${strokeAttrs(n)} ${common}${rawPart}/>`
    }
    case 'circle': {
      const n = node as CircleNode
      return `<circle cx="${n.cx}" cy="${n.cy}" r="${n.r}" fill="${fillAttr(n)}" ${strokeAttrs(n)} ${common}${rawPart}/>`
    }
    case 'ellipse': {
      const n = node as EllipseNode
      return `<ellipse cx="${n.cx}" cy="${n.cy}" rx="${n.rx}" ry="${n.ry}" fill="${fillAttr(n)}" ${strokeAttrs(n)} ${common}${rawPart}/>`
    }
    case 'line': {
      const n = node as LineNode
      return `<line x1="${n.x1}" y1="${n.y1}" x2="${n.x2}" y2="${n.y2}" ${strokeAttrs(n)} ${common}${rawPart}/>`
    }
    case 'polyline': {
      const n = node as PolylineNode
      const pts = n.points.map((p) => `${p.x},${p.y}`).join(' ')
      return `<polyline points="${pts}" fill="none" ${strokeAttrs(n)} ${common}${rawPart}/>`
    }
    case 'polygon': {
      const n = node as PolygonNode
      const pts = n.points.map((p) => `${p.x},${p.y}`).join(' ')
      return `<polygon points="${pts}" fill="${fillAttr(n)}" ${strokeAttrs(n)} ${common}${rawPart}/>`
    }
    case 'star': {
      const n = node as StarNode
      const pts = computeStarPoints(n.cx, n.cy, n.outerRadius, n.innerRadius, n.numPoints)
      return `<polygon points="${pts}" fill="${fillAttr(n)}" ${strokeAttrs(n)} ${common}${rawPart}/>`
    }
    case 'path': {
      const n = node as PathNode
      return `<path d="${e(n.d)}" fill="${fillAttr(n)}" ${strokeAttrs(n)} ${common}${rawPart}/>`
    }
    case 'text': {
      const n = node as TextNode
      const fontFamily = n.textStyle?.fontFamily ? ` font-family="${e(n.textStyle.fontFamily)}"` : ''
      const fontSize = n.textStyle?.fontSize ? ` font-size="${n.textStyle.fontSize}"` : ''
      const fontWeight = n.textStyle?.fontWeight ? ` font-weight="${n.textStyle.fontWeight}"` : ''
      const textAnchor = n.textStyle?.textAnchor ? ` text-anchor="${n.textStyle.textAnchor}"` : ''
      const innerContent = n.runs?.length
        ? n.runs.map(serializeTspan).join('')
        : e(n.content)
      return `<text x="${n.x}" y="${n.y}" fill="${fillAttr(n)}" ${strokeAttrs(n)}${fontFamily}${fontSize}${fontWeight}${textAnchor} ${common}${rawPart}>${innerContent}</text>`
    }
    case 'tspan': {
      // Tspans inside the document tree are serialized standalone (rare but valid)
      return serializeTspan(node as TspanNode)
    }
    case 'textPath': {
      const n = node as TextPathNode
      const startOffset = n.startOffset != null ? ` startOffset="${n.startOffset}"` : ''
      const method = n.method ? ` method="${n.method}"` : ''
      const spacing = n.spacing ? ` spacing="${n.spacing}"` : ''
      const innerContent = n.runs?.length
        ? n.runs.map(serializeTspan).join('')
        : e(n.content ?? '')
      return `<textPath href="#${e(n.href)}"${startOffset}${method}${spacing}>${innerContent}</textPath>`
    }
    case 'image': {
      const n = node as ImageNode
      const preserveAR = n.preserveAspectRatio ? ` preserveAspectRatio="${n.preserveAspectRatio}"` : ''
      return `<image x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" href="${n.href}"${preserveAR} ${common}${rawPart}/>`
    }
    case 'group': {
      const n = node as GroupNode
      const t = n.transform ? transformToString(n.transform) : ''
      const transformPart = t ? ` transform="${t}"` : ''
      const children = (n.children ?? []).map(serializeNode).join('\n  ')
      return `<g${transformPart}${rawPart}>\n  ${children}\n</g>`
    }
    case 'defs': {
      const n = node as DefsNode
      const children = (n.children ?? []).map(serializeNode).join('\n  ')
      return `<defs${rawPart}>\n  ${children}\n</defs>`
    }
    case 'symbol': {
      const n = node as SymbolNode
      const viewBox = n.viewBox ? ` viewBox="${n.viewBox}"` : ''
      const pAR = n.preserveAspectRatio ? ` preserveAspectRatio="${n.preserveAspectRatio}"` : ''
      const children = (n.children ?? []).map(serializeNode).join('\n  ')
      return `<symbol id="${n.id}"${viewBox}${pAR}${rawPart}>\n  ${children}\n</symbol>`
    }
    case 'use': {
      const n = node as UseNode
      const x = n.x != null ? ` x="${n.x}"` : ''
      const y = n.y != null ? ` y="${n.y}"` : ''
      const w = n.width != null ? ` width="${n.width}"` : ''
      const h = n.height != null ? ` height="${n.height}"` : ''
      return `<use href="${e(n.href)}"${x}${y}${w}${h} ${common}${rawPart}/>`
    }
    case 'clipPath': {
      const n = node as ClipPathNode
      const units = n.clipPathUnits ? ` clipPathUnits="${n.clipPathUnits}"` : ''
      const children = (n.children ?? []).map(serializeNode).join('\n  ')
      return `<clipPath id="${n.id}"${units}${rawPart}>\n  ${children}\n</clipPath>`
    }
    case 'mask': {
      const n = node as MaskNode
      const attrs: string[] = [`id="${n.id}"`]
      if (n.maskUnits) attrs.push(`maskUnits="${n.maskUnits}"`)
      if (n.maskContentUnits) attrs.push(`maskContentUnits="${n.maskContentUnits}"`)
      if (n.x != null) attrs.push(`x="${n.x}"`)
      if (n.y != null) attrs.push(`y="${n.y}"`)
      if (n.width != null) attrs.push(`width="${n.width}"`)
      if (n.height != null) attrs.push(`height="${n.height}"`)
      const children = (n.children ?? []).map(serializeNode).join('\n  ')
      return `<mask ${attrs.join(' ')}${rawPart}>\n  ${children}\n</mask>`
    }
    case 'marker': {
      const n = node as MarkerNode
      const attrs: string[] = [`id="${n.id}"`]
      if (n.viewBox) attrs.push(`viewBox="${n.viewBox}"`)
      if (n.refX != null) attrs.push(`refX="${n.refX}"`)
      if (n.refY != null) attrs.push(`refY="${n.refY}"`)
      if (n.markerWidth != null) attrs.push(`markerWidth="${n.markerWidth}"`)
      if (n.markerHeight != null) attrs.push(`markerHeight="${n.markerHeight}"`)
      if (n.orient) attrs.push(`orient="${n.orient}"`)
      if (n.markerUnits) attrs.push(`markerUnits="${n.markerUnits}"`)
      if (n.preserveAspectRatio) attrs.push(`preserveAspectRatio="${n.preserveAspectRatio}"`)
      const children = (n.children ?? []).map(serializeNode).join('\n  ')
      return `<marker ${attrs.join(' ')}${rawPart}>\n  ${children}\n</marker>`
    }
    case 'foreignObject': {
      const n = node as ForeignObjectNode
      const attrs: string[] = []
      if (n.x != null) attrs.push(`x="${n.x}"`)
      if (n.y != null) attrs.push(`y="${n.y}"`)
      if (n.width != null) attrs.push(`width="${n.width}"`)
      if (n.height != null) attrs.push(`height="${n.height}"`)
      const attrStr = attrs.length ? ` ${attrs.join(' ')}` : ''
      if (n.rawXml) {
        return `<foreignObject${attrStr}${rawPart}>${n.rawXml}</foreignObject>`
      }
      return `<foreignObject${attrStr}${rawPart}/>`
    }
    case 'a': {
      const n = node as ANode
      const href = n.href ? ` href="${e(n.href)}"` : ''
      const target = n.target ? ` target="${e(n.target)}"` : ''
      const children = (n.children ?? []).map(serializeNode).join('\n  ')
      return `<a${href}${target} ${common}${rawPart}>\n  ${children}\n</a>`
    }
    case 'switch': {
      const n = node as SwitchNode
      const children = (n.children ?? []).map(serializeNode).join('\n  ')
      return `<switch${rawPart}>\n  ${children}\n</switch>`
    }
    case 'style': {
      const n = node as StyleNode
      const media = n.mediaQuery ? ` media="${e(n.mediaQuery)}"` : ''
      return `<style type="text/css"${media}>${n.cssText}</style>`
    }
    default:
      return ''
  }
}

// ── Gradient defs ────────────────────────────────────────────────────────────

function serializeGradient(g: GradientResource): string {
  const stops = g.stops
    .map((s) => `<stop offset="${(s.offset * 100).toFixed(1)}%" stop-color="${s.color}" stop-opacity="${s.opacity ?? 1}"/>`)
    .join('\n    ')

  if (g.type === 'linearGradient') {
    const x1 = g.x1 != null ? ` x1="${g.x1}"` : ' x1="0"'
    const y1 = g.y1 != null ? ` y1="${g.y1}"` : ' y1="0"'
    const x2 = g.x2 != null ? ` x2="${g.x2}"` : ' x2="1"'
    const y2 = g.y2 != null ? ` y2="${g.y2}"` : ' y2="0"'
    const units = g.gradientUnits ? ` gradientUnits="${g.gradientUnits}"` : ' gradientUnits="objectBoundingBox"'
    const spread = g.spreadMethod ? ` spreadMethod="${g.spreadMethod}"` : ''
    const xform = g.gradientTransform ? ` gradientTransform="${g.gradientTransform}"` : ''
    return `<linearGradient id="${g.id}"${x1}${y1}${x2}${y2}${units}${spread}${xform}>
    ${stops}
  </linearGradient>`
  }
  const cx = g.cx != null ? ` cx="${g.cx}"` : ' cx="50%"'
  const cy = g.cy != null ? ` cy="${g.cy}"` : ' cy="50%"'
  const r = g.r != null ? ` r="${g.r}"` : ' r="50%"'
  const fx = g.fx != null ? ` fx="${g.fx}"` : ''
  const fy = g.fy != null ? ` fy="${g.fy}"` : ''
  const units = g.gradientUnits ? ` gradientUnits="${g.gradientUnits}"` : ' gradientUnits="objectBoundingBox"'
  const spread = g.spreadMethod ? ` spreadMethod="${g.spreadMethod}"` : ''
  const xform = g.gradientTransform ? ` gradientTransform="${g.gradientTransform}"` : ''
  return `<radialGradient id="${g.id}"${cx}${cy}${r}${fx}${fy}${units}${spread}${xform}>
    ${stops}
  </radialGradient>`
}

function serializeStyleBlock(sb: StyleBlockResource): string {
  const media = sb.media ? ` media="${e(sb.media)}"` : ''
  return `<style type="text/css"${media}>${sb.cssText}</style>`
}

// ── Namespace helpers ────────────────────────────────────────────────────────

function serializeNamespaces(namespaces?: Record<string, string>): string {
  if (!namespaces) return ''
  return Object.entries(namespaces)
    .map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`)
    .join(' ')
}

// ── Main export ──────────────────────────────────────────────────────────────

export function serializeDocumentToSvg(doc: SvgDocument): string {
  const { width, height, viewBox, background, root, resources } = doc

  const gradientDefs = resources.gradients.map(serializeGradient).join('\n  ')
  const styleBlockDefs = resources.styleBlocks.map(serializeStyleBlock).join('\n  ')
  const defsContent = [gradientDefs, styleBlockDefs].filter(Boolean).join('\n  ')
  const hasDefs = defsContent.trim().length > 0

  const bgRect =
    background.type === 'solid'
      ? `<rect width="${width}" height="${height}" fill="${background.color}"/>`
      : ''

  const children = (root.children ?? []).map(serializeNode).join('\n  ')

  const defsBlock = hasDefs ? `<defs>\n  ${defsContent}\n</defs>\n` : ''

  const extraNamespaces = serializeNamespaces(doc.namespaces)
  const nsPart = extraNamespaces ? ` ${extraNamespaces}` : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}"${nsPart}>
${defsBlock}  ${bgRect}
  ${children}
</svg>`
}
