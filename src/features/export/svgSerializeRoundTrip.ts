/**
 * svgSerializeRoundTrip.ts
 *
 * Mode B — Round-trip-safe serialization for imported SVG documents.
 *
 * Design goals:
 *   - Preserve all imported information: rawAttributes, rawChildren, filter/pattern raw XML
 *   - Respect editabilityLevel from PreservationMeta:
 *       Level 1-2: serialize from typed model fields (same as Mode A)
 *       Level 3 (Preserved-raw): use preservation.sourceElementName + rawAttributes + rawChildren
 *       Level 4 (Display-only): these nodes were not added to the tree; not emitted
 *   - Preserve namespace declarations from doc.namespaces on the SVG root
 *   - Style blocks: CSS text emitted verbatim (no css-tree transformation)
 *   - NEVER apply svgo or any destructive optimization
 *   - Optional: compute a change summary (edit distance from original source) via diff-match-patch
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
  fillAttrs,
  strokeAttrs,
  appearanceAttrs,
  rawAttrsString,
  preservationRawAttrs,
  getPreservationRawChildren,
  hasPreservationRawChildren,
  serializeNamespaces,
  combineAttrs,
  localFragRef,
} from './svgSerializeUtils'
import { transformAttr } from './svgSerializeTransforms'
import { serializeTextNode, serializeTextPathNode, serializeTspan } from './svgSerializeText'
import { serializeResourceDefs } from './svgSerializeResources'
import { serializeStyleElement } from './svgSerializeStyles'

const MODE = 'roundtrip' as const

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

// ── Level-3 node serializer ───────────────────────────────────────────────────

/**
 * Serialize a Level-3 (Preserved-raw) node using its original element name,
 * rawAttributes from preservation metadata, and rawChildren for inner content.
 *
 * This is the core of the round-trip guarantee: nodes that were not recognized
 * (or not fully parseable) during import are faithfully reconstructed from their
 * raw metadata, so no information is lost during export.
 */
function serializePreservedRawNode(node: SvgNode): string {
  const p = node.preservation!
  const tag = p.sourceElementName || 'g' // fallback to <g> if somehow missing

  const parts: string[] = [`<${tag}`]

  // Emit the node's standard typed id if present
  if (node.id && node.id.trim()) parts.push(` id="${xmlEscape(node.id)}"`)

  // Emit all raw attributes from import (the ones we preserved verbatim)
  if (p.rawAttributes) {
    for (const [k, v] of Object.entries(p.rawAttributes)) {
      // Skip id — already emitted above
      if (k === 'id') continue
      parts.push(` ${k}="${xmlEscape(v)}"`)
    }
  }

  // Emit standard pass-through attributes (data-*, aria-*, etc.)
  const raw = rawAttrsString(node)
  if (raw) parts.push(` ${raw}`)

  const innerContent = getPreservationRawChildren(node)

  if (!innerContent.trim()) {
    parts.push('/>')
  } else {
    parts.push('>')
    parts.push(innerContent)
    parts.push(`</${tag}>`)
  }

  return parts.join('')
}

// ── Node serializer ───────────────────────────────────────────────────────────

function serializeNode(node: SvgNode): string {
  if (node.visible === false) return ''

  // Level 3: Preserved-raw — use raw reconstruction
  if (node.preservation?.editabilityLevel === 3) {
    return serializePreservedRawNode(node)
  }

  // Level 4: Display-only — these were not added to the tree during import;
  // if somehow present, omit them to preserve the import contract
  if (node.preservation?.editabilityLevel === 4) {
    return ''
  }

  // Level 1 or 2: serialize from typed model fields, plus preservation rawAttributes
  const transform = transformAttr(node.transform)
  const raw = rawAttrsString(node)
  const pRaw = preservationRawAttrs(node)

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
        raw,
        pRaw
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
        raw,
        pRaw
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
        raw,
        pRaw
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
        raw,
        pRaw
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
        raw,
        pRaw
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
        raw,
        pRaw
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
        raw,
        pRaw
      )
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
        raw,
        pRaw
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
        raw,
        pRaw
      )
      return `<image ${attrs}/>`
    }

    case 'group': {
      const n = node as GroupNode
      const t = transformAttr(n.transform)
      const idAttr = n.id ? `id="${xmlEscape(n.id)}"` : ''
      const appearance = appearanceAttrs(n.style, MODE)
      const openAttrs = combineAttrs(idAttr, appearance, t, raw, pRaw)

      // In round-trip mode, if there are rawChildren and no typed children, emit raw content
      if (!n.children?.length && hasPreservationRawChildren(n)) {
        return `<g ${openAttrs}>${getPreservationRawChildren(n)}</g>`
      }

      const children = (n.children ?? []).map(serializeNode).filter(Boolean)
      if (!children.length && !openAttrs.trim()) return ''
      if (!children.length) return `<g ${openAttrs}/>`
      return `<g ${openAttrs}>\n  ${children.join('\n  ')}\n</g>`
    }

    case 'defs': {
      const n = node as DefsNode
      const idAttr = n.id ? ` id="${xmlEscape(n.id)}"` : ''
      const rawPart = raw ? ` ${raw}` : ''
      const pRawPart = pRaw ? ` ${pRaw}` : ''
      const children = (n.children ?? []).map(serializeNode).filter(Boolean)
      if (!children.length) return `<defs${idAttr}${rawPart}${pRawPart}/>`
      return `<defs${idAttr}${rawPart}${pRawPart}>\n  ${children.join('\n  ')}\n</defs>`
    }

    case 'symbol': {
      const n = node as SymbolNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        n.viewBox ? `viewBox="${n.viewBox}"` : '',
        n.preserveAspectRatio ? `preserveAspectRatio="${n.preserveAspectRatio}"` : '',
        raw,
        pRaw
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
        raw,
        pRaw
      )
      return `<use ${attrs}/>`
    }

    case 'clipPath': {
      const n = node as ClipPathNode
      const attrs = combineAttrs(
        n.id ? `id="${xmlEscape(n.id)}"` : '',
        n.clipPathUnits ? `clipPathUnits="${n.clipPathUnits}"` : '',
        raw,
        pRaw
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
        raw,
        pRaw
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
        raw,
        pRaw
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
        raw,
        pRaw
      )
      if (n.rawXml) return `<foreignObject ${attrs}>${n.rawXml}</foreignObject>`
      // Check preservation rawChildren as fallback
      const rawChildren = getPreservationRawChildren(n)
      if (rawChildren) return `<foreignObject ${attrs}>${rawChildren}</foreignObject>`
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
        raw,
        pRaw
      )
      const children = (n.children ?? []).map(serializeNode).filter(Boolean)
      if (!children.length) return `<a ${attrs}/>`
      return `<a ${attrs}>\n  ${children.join('\n  ')}\n</a>`
    }

    case 'switch': {
      const n = node as SwitchNode
      const idAttr = n.id ? ` id="${xmlEscape(n.id)}"` : ''
      const rawPart = raw ? ` ${raw}` : ''
      const pRawPart = pRaw ? ` ${pRaw}` : ''
      const children = (n.children ?? []).map(serializeNode).filter(Boolean)
      if (!children.length) return `<switch${idAttr}${rawPart}${pRawPart}/>`
      return `<switch${idAttr}${rawPart}${pRawPart}>\n  ${children.join('\n  ')}\n</switch>`
    }

    case 'style': {
      const n = node as StyleNode
      return serializeStyleElement(n.cssText, n.mediaQuery, MODE)
    }

    default:
      return ''
  }
}

// ── Change summary ────────────────────────────────────────────────────────────

export interface RoundTripChangeSummary {
  /** Number of single-character edit operations (insertions + deletions) */
  editDistance: number
  /** Number of distinct change regions */
  changeCount: number
}

/**
 * Compute a change summary between the original SVG source and the
 * round-trip serialized output using diff-match-patch.
 *
 * This is informational — it does not modify the output in any way.
 * Useful for Phase 7 source-visual sync and diagnostic display.
 */
export function computeRoundTripDiff(original: string, serialized: string): RoundTripChangeSummary {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const DiffMatchPatch = require('diff-match-patch') as
      | { default: new () => DmpInstance }
      | (new () => DmpInstance)

    interface DmpInstance {
      diff_main: (a: string, b: string) => Array<[number, string]>
      diff_levenshtein: (diffs: Array<[number, string]>) => number
    }

    const DmpClass = 'default' in DiffMatchPatch ? DiffMatchPatch.default : DiffMatchPatch
    const dmp = new DmpClass()
    const diffs = dmp.diff_main(original, serialized)
    const editDistance = dmp.diff_levenshtein(diffs)

    // Count change regions (consecutive non-equal ops form one change)
    let changeCount = 0
    let inChange = false
    for (const [op] of diffs) {
      if (op !== 0) {
        if (!inChange) { changeCount++; inChange = true }
      } else {
        inChange = false
      }
    }

    return { editDistance, changeCount }
  } catch {
    // diff-match-patch not available or failed — return unknown
    return { editDistance: -1, changeCount: -1 }
  }
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface RoundTripSerializeOpts {
  /**
   * If true, compute a change summary comparing the output to doc.sourceSvg.
   * Requires doc.sourceSvg to be set (populated during import).
   * Default: false (skip for performance).
   */
  computeChangeSummary?: boolean
}

export interface RoundTripSerializeResult {
  svg: string
  changeSummary?: RoundTripChangeSummary
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Serialize an SvgDocument to SVG XML using round-trip (Mode B) output.
 *
 * Designed for imported documents (fidelityTier=2 or 3).
 * Preserves rawAttributes, rawChildren, filter/pattern raw XML, and namespaces.
 *
 * Returns just the SVG string unless computeChangeSummary is requested.
 */
export function serializeDocumentRoundTrip(
  doc: SvgDocument,
  opts: RoundTripSerializeOpts = {}
): string {
  const result = serializeDocumentRoundTripFull(doc, opts)
  return result.svg
}

/**
 * Like serializeDocumentRoundTrip but returns the full result object including
 * an optional change summary.
 */
export function serializeDocumentRoundTripFull(
  doc: SvgDocument,
  opts: RoundTripSerializeOpts = {}
): RoundTripSerializeResult {
  const { width, height, viewBox, background, root, resources } = doc

  // Resource defs content
  const defsContent = serializeResourceDefs(resources, MODE, serializeNode)

  // Background rect
  const bgRect =
    background.type === 'solid'
      ? `<rect width="${width}" height="${height}" fill="${background.color}"/>`
      : ''

  // Root children
  const children = (root.children ?? []).map(serializeNode).filter(Boolean)

  // Assemble defs block
  const defsBlock = defsContent.trim()
    ? `<defs>\n  ${defsContent}\n</defs>`
    : ''

  // Preserve namespace declarations on the SVG root
  const nsStr = serializeNamespaces(doc.namespaces)
  const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
  const svgRootAttrs = [`xmlns="http://www.w3.org/2000/svg"`]
  svgRootAttrs.push(`width="${width}"`)
  svgRootAttrs.push(`height="${height}"`)
  svgRootAttrs.push(`viewBox="${viewBoxStr}"`)
  if (nsStr) svgRootAttrs.push(nsStr)

  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg ${svgRootAttrs.join(' ')}>`,
    defsBlock,
    bgRect,
    ...children,
    '</svg>',
  ].filter(Boolean)

  const svg = parts.join('\n')

  // Optionally compute change summary
  let changeSummary: RoundTripChangeSummary | undefined
  if (opts.computeChangeSummary && doc.sourceSvg) {
    changeSummary = computeRoundTripDiff(doc.sourceSvg, svg)
  }

  return { svg, changeSummary }
}
