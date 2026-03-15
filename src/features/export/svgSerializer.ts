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
  ImageNode,
  GroupNode
} from '@/model/nodes/nodeTypes'
import type { GradientResource } from '@/model/resources/resourceTypes'

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

// ── Node serializer ──────────────────────────────────────────────────────────

function serializeNode(node: SvgNode): string {
  if (node.visible === false) return ''

  const common = commonAttrs(node)

  switch (node.type) {
    case 'rect': {
      const n = node as RectNode
      const rx = n.rx ? ` rx="${n.rx}"` : ''
      const ry = n.ry ? ` ry="${n.ry}"` : ''
      return `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}"${rx}${ry} fill="${fillAttr(n)}" ${strokeAttrs(n)} ${common}/>`
    }
    case 'circle': {
      const n = node as CircleNode
      return `<circle cx="${n.cx}" cy="${n.cy}" r="${n.r}" fill="${fillAttr(n)}" ${strokeAttrs(n)} ${common}/>`
    }
    case 'ellipse': {
      const n = node as EllipseNode
      return `<ellipse cx="${n.cx}" cy="${n.cy}" rx="${n.rx}" ry="${n.ry}" fill="${fillAttr(n)}" ${strokeAttrs(n)} ${common}/>`
    }
    case 'line': {
      const n = node as LineNode
      return `<line x1="${n.x1}" y1="${n.y1}" x2="${n.x2}" y2="${n.y2}" ${strokeAttrs(n)} ${common}/>`
    }
    case 'polyline': {
      const n = node as PolylineNode
      const pts = n.points.map((p) => `${p.x},${p.y}`).join(' ')
      return `<polyline points="${pts}" fill="none" ${strokeAttrs(n)} ${common}/>`
    }
    case 'polygon': {
      const n = node as PolygonNode
      const pts = n.points.map((p) => `${p.x},${p.y}`).join(' ')
      return `<polygon points="${pts}" fill="${fillAttr(n)}" ${strokeAttrs(n)} ${common}/>`
    }
    case 'star': {
      const n = node as StarNode
      const pts = computeStarPoints(n.cx, n.cy, n.outerRadius, n.innerRadius, n.numPoints)
      return `<polygon points="${pts}" fill="${fillAttr(n)}" ${strokeAttrs(n)} ${common}/>`
    }
    case 'path': {
      const n = node as PathNode
      return `<path d="${e(n.d)}" fill="${fillAttr(n)}" ${strokeAttrs(n)} ${common}/>`
    }
    case 'text': {
      const n = node as TextNode
      const fontFamily = n.textStyle?.fontFamily ? ` font-family="${e(n.textStyle.fontFamily)}"` : ''
      const fontSize = n.textStyle?.fontSize ? ` font-size="${n.textStyle.fontSize}"` : ''
      const fontWeight = n.textStyle?.fontWeight ? ` font-weight="${n.textStyle.fontWeight}"` : ''
      return `<text x="${n.x}" y="${n.y}" fill="${fillAttr(n)}" ${strokeAttrs(n)}${fontFamily}${fontSize}${fontWeight} ${common}>${e(n.content)}</text>`
    }
    case 'image': {
      const n = node as ImageNode
      return `<image x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" href="${n.href}" ${common}/>`
    }
    case 'group': {
      const n = node as GroupNode
      const t = n.transform ? transformToString(n.transform) : ''
      const transformPart = t ? ` transform="${t}"` : ''
      const children = (n.children ?? []).map(serializeNode).join('\n  ')
      return `<g${transformPart}>\n  ${children}\n</g>`
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
    return `<linearGradient id="${g.id}" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
    ${stops}
  </linearGradient>`
  }
  return `<radialGradient id="${g.id}" cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
    ${stops}
  </radialGradient>`
}

// ── Main export ──────────────────────────────────────────────────────────────

export function serializeDocumentToSvg(doc: SvgDocument): string {
  const { width, height, viewBox, background, root, resources } = doc

  const gradientDefs = resources.gradients.map(serializeGradient).join('\n  ')
  const hasDefs = gradientDefs.trim().length > 0

  const bgRect =
    background.type === 'solid'
      ? `<rect width="${width}" height="${height}" fill="${background.color}"/>`
      : ''

  const children = (root.children ?? []).map(serializeNode).join('\n  ')

  const defsBlock = hasDefs ? `<defs>\n  ${gradientDefs}\n</defs>\n` : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}">
${defsBlock}  ${bgRect}
  ${children}
</svg>`
}
