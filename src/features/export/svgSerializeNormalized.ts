/**
 * svgSerializeNormalized.ts
 *
 * Mode A — Normalized serialization for editor-native SVG documents.
 *
 * Produces clean, consistently formatted SVG output:
 *   - Attributes in canonical order (id, geometry, style, transform)
 *   - Style blocks CSS normalized via css-tree
 *   - Optional pretty-printing via prettier + prettier-plugin-xml
 *   - Optional optimization via svgo (NEVER the default — explicit opt-in only)
 *
 * This mode is used for documents with fidelityTier=1 and serializationMode='normalized'.
 * It does NOT attempt to preserve rawAttributes or rawChildren from preservation metadata,
 * as those are not meaningful for editor-native documents.
 */

import type { SvgDocument } from '@/model/document/documentTypes'
import type {
  SvgNode,
  RectNode,
  CircleNode,
  EllipseNode,
  LineNode,
  PolylineNode,
  PolygonNode,
  StarNode,
  PathNode,
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
  StyleNode,
  ImageNode,
} from '@/model/nodes/nodeTypes'
import {
  xmlEscape,
  xmlEscapeText,
  fillAttrs,
  strokeAttrs,
  appearanceAttrs,
  rawAttrsString,
  serializeNamespaces,
  combineAttrs,
  localFragRef,
} from './svgSerializeUtils'
import { transformAttr } from './svgSerializeTransforms'
import { serializeTextNode, serializeTextPathNode, serializeTspan } from './svgSerializeText'
import { serializeResourceDefs } from './svgSerializeResources'
import { serializeStyleElement } from './svgSerializeStyles'

const MODE = 'normalized' as const

// ── Star helper ───────────────────────────────────────────────────────────────

function computeStarPoints(cx: number, cy: number, outer: number, inner: number, n: number): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const angle = (Math.PI / n) * i - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`)
  }
  return pts.join(' ')
}

// ── Node serializer ───────────────────────────────────────────────────────────

function serializeNode(node: SvgNode): string {
  if (node.visible === false) return ''

  const transform = transformAttr(node.transform)
  const raw = rawAttrsString(node)

  switch (node.type) {
    case 'rect': {
      const n = node as RectNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        `x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}"`,
        n.rx != null ? `rx="${n.rx}"` : '',
        n.ry != null ? `ry="${n.ry}"` : '',
        fillAttrs(n.style),
        strokeAttrs(n.style?.stroke),
        appearanceAttrs(n.style, MODE),
        transform,
        raw
      )
      return `<rect ${attrs}/>`
    }

    case 'circle': {
      const n = node as CircleNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        `cx="${n.cx}" cy="${n.cy}" r="${n.r}"`,
        fillAttrs(n.style),
        strokeAttrs(n.style?.stroke),
        appearanceAttrs(n.style, MODE),
        transform,
        raw
      )
      return `<circle ${attrs}/>`
    }

    case 'ellipse': {
      const n = node as EllipseNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        `cx="${n.cx}" cy="${n.cy}" rx="${n.rx}" ry="${n.ry}"`,
        fillAttrs(n.style),
        strokeAttrs(n.style?.stroke),
        appearanceAttrs(n.style, MODE),
        transform,
        raw
      )
      return `<ellipse ${attrs}/>`
    }

    case 'line': {
      const n = node as LineNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        `x1="${n.x1}" y1="${n.y1}" x2="${n.x2}" y2="${n.y2}"`,
        strokeAttrs(n.style?.stroke),
        appearanceAttrs(n.style, MODE),
        transform,
        raw
      )
      return `<line ${attrs}/>`
    }

    case 'polyline': {
      const n = node as PolylineNode
      const pts = n.points.map((p) => `${p.x},${p.y}`).join(' ')
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        `points="${pts}"`,
        'fill="none"',
        strokeAttrs(n.style?.stroke),
        appearanceAttrs(n.style, MODE),
        transform,
        raw
      )
      return `<polyline ${attrs}/>`
    }

    case 'polygon': {
      const n = node as PolygonNode
      const pts = n.points.map((p) => `${p.x},${p.y}`).join(' ')
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        `points="${pts}"`,
        fillAttrs(n.style),
        strokeAttrs(n.style?.stroke),
        appearanceAttrs(n.style, MODE),
        transform,
        raw
      )
      return `<polygon ${attrs}/>`
    }

    case 'star': {
      const n = node as StarNode
      const pts = computeStarPoints(n.cx, n.cy, n.outerRadius, n.innerRadius, n.numPoints)
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        `points="${pts}"`,
        fillAttrs(n.style),
        strokeAttrs(n.style?.stroke),
        appearanceAttrs(n.style, MODE),
        transform,
        raw
      )
      // Stars are serialized as polygons (they're editor-native)
      return `<polygon ${attrs}/>`
    }

    case 'path': {
      const n = node as PathNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        `d="${xmlEscape(n.d)}"`,
        fillAttrs(n.style),
        strokeAttrs(n.style?.stroke),
        appearanceAttrs(n.style, MODE),
        transform,
        raw
      )
      return `<path ${attrs}/>`
    }

    case 'text':
      return serializeTextNode(node, MODE)

    case 'tspan':
      return serializeTspan(node, MODE)

    case 'textPath':
      return serializeTextPathNode(node, MODE)

    case 'image': {
      const n = node as ImageNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        `x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}"`,
        `href="${xmlEscape(n.href)}"`,
        n.preserveAspectRatio ? `preserveAspectRatio="${n.preserveAspectRatio}"` : '',
        transform,
        raw
      )
      return `<image ${attrs}/>`
    }

    case 'group': {
      const n = node as GroupNode
      const t = transformAttr(n.transform)
      const idAttr = n.id ? `id="${xmlEscape(n.id)}"` : ''
      const appearance = appearanceAttrs(n.style, MODE)
      const openAttrs = combineAttrs(idAttr, appearance, t, raw)
      const children = (n.children ?? []).map(serializeNode).filter(Boolean)
      if (!children.length) return `<g ${openAttrs}/>`
      return `<g ${openAttrs}>\n  ${children.join('\n  ')}\n</g>`
    }

    case 'defs': {
      const n = node as DefsNode
      const idAttr = n.id ? ` id="${xmlEscape(n.id)}"` : ''
      const children = (n.children ?? []).map(serializeNode).filter(Boolean)
      if (!children.length) return `<defs${idAttr}/>`
      return `<defs${idAttr}>\n  ${children.join('\n  ')}\n</defs>`
    }

    case 'symbol': {
      const n = node as SymbolNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        n.viewBox ? `viewBox="${n.viewBox}"` : '',
        n.preserveAspectRatio ? `preserveAspectRatio="${n.preserveAspectRatio}"` : '',
        raw
      )
      const children = (n.children ?? []).map(serializeNode).filter(Boolean)
      if (!children.length) return `<symbol ${attrs}/>`
      return `<symbol ${attrs}>\n  ${children.join('\n  ')}\n</symbol>`
    }

    case 'use': {
      const n = node as UseNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        `href="${xmlEscape(localFragRef(n.href))}"`,
        n.x != null ? `x="${n.x}"` : '',
        n.y != null ? `y="${n.y}"` : '',
        n.width != null ? `width="${n.width}"` : '',
        n.height != null ? `height="${n.height}"` : '',
        appearanceAttrs(n.style, MODE),
        transform,
        raw
      )
      return `<use ${attrs}/>`
    }

    case 'clipPath': {
      const n = node as ClipPathNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        n.clipPathUnits ? `clipPathUnits="${n.clipPathUnits}"` : '',
        raw
      )
      const children = (n.children ?? []).map(serializeNode).filter(Boolean)
      if (!children.length) return `<clipPath ${attrs}/>`
      return `<clipPath ${attrs}>\n  ${children.join('\n  ')}\n</clipPath>`
    }

    case 'mask': {
      const n = node as MaskNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        n.maskUnits ? `maskUnits="${n.maskUnits}"` : '',
        n.maskContentUnits ? `maskContentUnits="${n.maskContentUnits}"` : '',
        n.x != null ? `x="${n.x}"` : '',
        n.y != null ? `y="${n.y}"` : '',
        n.width != null ? `width="${n.width}"` : '',
        n.height != null ? `height="${n.height}"` : '',
        raw
      )
      const children = (n.children ?? []).map(serializeNode).filter(Boolean)
      if (!children.length) return `<mask ${attrs}/>`
      return `<mask ${attrs}>\n  ${children.join('\n  ')}\n</mask>`
    }

    case 'marker': {
      const n = node as MarkerNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        n.viewBox ? `viewBox="${n.viewBox}"` : '',
        n.refX != null ? `refX="${n.refX}"` : '',
        n.refY != null ? `refY="${n.refY}"` : '',
        n.markerWidth != null ? `markerWidth="${n.markerWidth}"` : '',
        n.markerHeight != null ? `markerHeight="${n.markerHeight}"` : '',
        n.orient ? `orient="${n.orient}"` : '',
        n.markerUnits ? `markerUnits="${n.markerUnits}"` : '',
        n.preserveAspectRatio ? `preserveAspectRatio="${n.preserveAspectRatio}"` : '',
        raw
      )
      const children = (n.children ?? []).map(serializeNode).filter(Boolean)
      if (!children.length) return `<marker ${attrs}/>`
      return `<marker ${attrs}>\n  ${children.join('\n  ')}\n</marker>`
    }

    case 'foreignObject': {
      const n = node as ForeignObjectNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        n.x != null ? `x="${n.x}"` : '',
        n.y != null ? `y="${n.y}"` : '',
        n.width != null ? `width="${n.width}"` : '',
        n.height != null ? `height="${n.height}"` : '',
        transform,
        raw
      )
      if (n.rawXml) return `<foreignObject ${attrs}>${n.rawXml}</foreignObject>`
      return `<foreignObject ${attrs}/>`
    }

    case 'a': {
      const n = node as ANode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        n.href ? `href="${xmlEscape(n.href)}"` : '',
        n.target ? `target="${xmlEscape(n.target)}"` : '',
        appearanceAttrs(n.style, MODE),
        transform,
        raw
      )
      const children = (n.children ?? []).map(serializeNode).filter(Boolean)
      if (!children.length) return `<a ${attrs}/>`
      return `<a ${attrs}>\n  ${children.join('\n  ')}\n</a>`
    }

    case 'switch': {
      const n = node as SwitchNode
      const idAttr = n.id ? ` id="${xmlEscape(n.id)}"` : ''
      const children = (n.children ?? []).map(serializeNode).filter(Boolean)
      if (!children.length) return `<switch${idAttr}/>`
      return `<switch${idAttr}>\n  ${children.join('\n  ')}\n</switch>`
    }

    case 'style': {
      const n = node as StyleNode
      return serializeStyleElement(n.cssText, n.mediaQuery, MODE)
    }

    default:
      return ''
  }
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface NormalizedSerializeOpts {
  /** Run output through prettier + prettier-plugin-xml for clean formatting. Default: false. */
  prettify?: boolean
  /**
   * Run output through svgo for optimization.
   * NEVER the default — explicit opt-in only per architectural contract.
   */
  applyOptimizations?: boolean
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Serialize an SvgDocument to SVG XML using normalized (Mode A) output.
 *
 * Produces clean, consistently formatted SVG. Suitable for editor-native
 * documents (fidelityTier=1). Does not preserve rawAttributes or rawChildren.
 */
export function serializeDocumentNormalized(
  doc: SvgDocument,
  opts: NormalizedSerializeOpts = {}
): string {
  const { width, height, viewBox, background, root, resources } = doc

  // Resource defs content
  const defsContent = serializeResourceDefs(resources, MODE, serializeNode)

  // Background rect (if solid color)
  const bgRect =
    background.type === 'solid'
      ? `<rect width="${width}" height="${height}" fill="${background.color}"/>`
      : ''

  // Root children (skip the root node itself, just serialize its children)
  const children = (root.children ?? []).map(serializeNode).filter(Boolean)

  // Assemble defs block
  const defsBlock = defsContent.trim()
    ? `<defs>\n  ${defsContent}\n</defs>`
    : ''

  // Standard SVG namespaces only in normalized mode
  const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`

  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBoxStr}">`,
    defsBlock,
    bgRect,
    ...children,
    '</svg>',
  ].filter(Boolean)

  let output = parts.join('\n')

  // Optional: pretty-print via prettier + prettier-plugin-xml
  if (opts.prettify) {
    output = prettifyXml(output)
  }

  // Optional: optimize via svgo (NEVER default — opt-in only)
  if (opts.applyOptimizations) {
    output = optimizeSvgo(output)
  }

  return output
}

// ── Optional formatting ───────────────────────────────────────────────────────

function prettifyXml(xml: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const prettier = require('prettier') as typeof import('prettier')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const xmlPlugin = require('prettier-plugin-xml') as { default: unknown }

    // prettier v3 formatSync is not available in all environments — use format and handle sync
    // For browser/Vite environments, fall back to xml-formatter if prettier is async-only
    const prettierAny = prettier as unknown as { formatSync?: (code: string, opts: object) => string }
    if (typeof prettierAny.formatSync === 'function') {
      return prettierAny.formatSync(xml, {
        parser: 'xml',
        plugins: [xmlPlugin.default ?? xmlPlugin],
        xmlWhitespaceSensitivity: 'ignore',
        printWidth: 120,
      })
    }

    // Fallback to xml-formatter if prettier formatSync not available
    return xmlFormatter(xml)
  } catch {
    // If prettier fails, fall back to xml-formatter
    return xmlFormatter(xml)
  }
}

function xmlFormatter(xml: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fmt = require('xml-formatter') as { default: Function } | Function
    const fn = typeof fmt === 'function' ? fmt : (fmt as { default: Function }).default
    return fn(xml, { indentation: '  ', collapseContent: true, lineSeparator: '\n' }) as string
  } catch {
    return xml
  }
}

function optimizeSvgo(svg: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const svgo = require('svgo') as { optimize: Function }
    const result = svgo.optimize(svg, { multipass: true }) as { data: string }
    return result.data
  } catch {
    return svg
  }
}
