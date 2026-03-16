/**
 * svgSerializeText.ts
 *
 * Serialization for SVG text elements: <text>, <tspan>, <textPath>.
 *
 * Text serialization is shared between normalized (Mode A) and round-trip (Mode B)
 * modes, with Mode B emitting preservation.rawAttributes for unknown attrs on tspan nodes.
 */

import type { TextNode, TspanNode, TextPathNode } from '@/model/nodes/nodeTypes'
import type { SerializeMode } from './svgSerializeUtils'
import {
  xmlEscape,
  xmlEscapeText,
  fillAttrs,
  strokeAttrs,
  appearanceAttrs,
  preservationRawAttrs,
  rawAttrsString,
  combineAttrs,
  localFragRef,
} from './svgSerializeUtils'
import { transformAttr } from './svgSerializeTransforms'

// ── tspan ─────────────────────────────────────────────────────────────────────

/**
 * Serialize a TspanNode to an SVG <tspan> element string.
 * Recursively serializes nested tspan runs.
 */
export function serializeTspan(tspan: TspanNode, mode: SerializeMode): string {
  const attrs: string[] = ['<tspan']

  if (tspan.id && tspan.id.trim()) attrs.push(` id="${xmlEscape(tspan.id)}"`)
  if (tspan.x != null) attrs.push(` x="${tspan.x}"`)
  if (tspan.y != null) attrs.push(` y="${tspan.y}"`)
  if (tspan.dx != null) attrs.push(` dx="${tspan.dx}"`)
  if (tspan.dy != null) attrs.push(` dy="${tspan.dy}"`)
  if (tspan.rotate != null) attrs.push(` rotate="${tspan.rotate}"`)
  if (tspan.textLength != null) attrs.push(` textLength="${tspan.textLength}"`)
  if (tspan.textStyle?.fontFamily) attrs.push(` font-family="${xmlEscape(tspan.textStyle.fontFamily)}"`)
  if (tspan.textStyle?.fontSize != null) attrs.push(` font-size="${tspan.textStyle.fontSize}"`)
  if (tspan.textStyle?.fontWeight != null) attrs.push(` font-weight="${tspan.textStyle.fontWeight}"`)
  if (tspan.textStyle?.fontStyle) attrs.push(` font-style="${tspan.textStyle.fontStyle}"`)
  if (tspan.textStyle?.textAnchor) attrs.push(` text-anchor="${tspan.textStyle.textAnchor}"`)
  if (tspan.textStyle?.dominantBaseline) attrs.push(` dominant-baseline="${tspan.textStyle.dominantBaseline}"`)
  if (tspan.textStyle?.letterSpacing != null) attrs.push(` letter-spacing="${tspan.textStyle.letterSpacing}"`)
  if (tspan.textStyle?.textDecoration) attrs.push(` text-decoration="${tspan.textStyle.textDecoration}"`)

  // Pass-through attributes (aria-*, data-*, etc.)
  const raw = rawAttrsString(tspan as unknown as import('@/model/nodes/nodeTypes').SvgNode)
  if (raw) attrs.push(` ${raw}`)

  // Round-trip mode: emit unknown attributes from preservation metadata
  if (mode === 'roundtrip') {
    const pRaw = preservationRawAttrs(tspan as unknown as import('@/model/nodes/nodeTypes').SvgNode)
    if (pRaw) attrs.push(` ${pRaw}`)
  }

  attrs.push('>')

  // Recurse into nested tspans, or emit text content
  let innerContent: string
  if (tspan.runs?.length) {
    innerContent = tspan.runs.map((r) => serializeTspan(r, mode)).join('')
  } else {
    innerContent = xmlEscapeText(tspan.content ?? '')
  }

  return `${attrs.join('')}${innerContent}</tspan>`
}

// ── text ──────────────────────────────────────────────────────────────────────

/**
 * Serialize a TextNode to an SVG <text> element string.
 */
export function serializeTextNode(node: TextNode, mode: SerializeMode): string {
  const attrParts: string[] = []

  if (node.id && node.id.trim()) attrParts.push(`id="${xmlEscape(node.id)}"`)
  attrParts.push(`x="${node.x}"`)
  attrParts.push(`y="${node.y}"`)

  if (node.textStyle?.fontFamily) attrParts.push(`font-family="${xmlEscape(node.textStyle.fontFamily)}"`)
  if (node.textStyle?.fontSize != null) attrParts.push(`font-size="${node.textStyle.fontSize}"`)
  if (node.textStyle?.fontWeight != null) attrParts.push(`font-weight="${node.textStyle.fontWeight}"`)
  if (node.textStyle?.fontStyle) attrParts.push(`font-style="${node.textStyle.fontStyle}"`)
  if (node.textStyle?.textAnchor) attrParts.push(`text-anchor="${node.textStyle.textAnchor}"`)
  if (node.textStyle?.dominantBaseline) attrParts.push(`dominant-baseline="${node.textStyle.dominantBaseline}"`)
  if (node.textStyle?.letterSpacing != null) attrParts.push(`letter-spacing="${node.textStyle.letterSpacing}"`)
  if (node.textStyle?.writingMode) attrParts.push(`writing-mode="${node.textStyle.writingMode}"`)
  if (node.textStyle?.textDecoration) attrParts.push(`text-decoration="${node.textStyle.textDecoration}"`)

  const fill = fillAttrs(node.style)
  if (fill) attrParts.push(fill)

  const stroke = strokeAttrs(node.style?.stroke)
  if (stroke) attrParts.push(stroke)

  const appearance = appearanceAttrs(node.style, mode)
  if (appearance) attrParts.push(appearance)

  const transform = transformAttr(node.transform)
  if (transform) attrParts.push(transform)

  const raw = rawAttrsString(node)
  if (raw) attrParts.push(raw)

  if (mode === 'roundtrip') {
    const pRaw = preservationRawAttrs(node)
    if (pRaw) attrParts.push(pRaw)
  }

  const openTag = `<text ${combineAttrs(...attrParts)}>`

  let innerContent: string
  if (node.runs?.length) {
    innerContent = node.runs.map((r) => serializeTspan(r, mode)).join('')
  } else {
    innerContent = xmlEscapeText(node.content ?? '')
  }

  return `${openTag}${innerContent}</text>`
}

// ── textPath ──────────────────────────────────────────────────────────────────

/**
 * Serialize a TextPathNode to an SVG <textPath> element string.
 */
export function serializeTextPathNode(node: TextPathNode, mode: SerializeMode): string {
  const attrParts: string[] = []

  if (node.id && node.id.trim()) attrParts.push(`id="${xmlEscape(node.id)}"`)
  attrParts.push(`href="${xmlEscape(localFragRef(node.href))}"`)

  if (node.startOffset != null) attrParts.push(`startOffset="${node.startOffset}"`)
  if (node.method) attrParts.push(`method="${node.method}"`)
  if (node.spacing) attrParts.push(`spacing="${node.spacing}"`)

  if (node.textStyle?.fontFamily) attrParts.push(`font-family="${xmlEscape(node.textStyle.fontFamily)}"`)
  if (node.textStyle?.fontSize != null) attrParts.push(`font-size="${node.textStyle.fontSize}"`)
  if (node.textStyle?.fontWeight != null) attrParts.push(`font-weight="${node.textStyle.fontWeight}"`)

  const raw = rawAttrsString(node)
  if (raw) attrParts.push(raw)

  if (mode === 'roundtrip') {
    const pRaw = preservationRawAttrs(node)
    if (pRaw) attrParts.push(pRaw)
  }

  const openTag = `<textPath ${combineAttrs(...attrParts)}>`

  let innerContent: string
  if (node.runs?.length) {
    innerContent = node.runs.map((r) => serializeTspan(r, mode)).join('')
  } else {
    innerContent = xmlEscapeText(node.content ?? '')
  }

  return `${openTag}${innerContent}</textPath>`
}
