/**
 * svgSerializeUtils.ts
 *
 * Shared utility helpers for all SVG serializer modules.
 * XML escaping, attribute building, paint/stroke serialization,
 * and preservation-metadata accessors.
 */

import type { SvgNode, AppearanceModel, PaintModel, StrokeModel } from '@/model/nodes/nodeTypes'

// ── Serialization mode ────────────────────────────────────────────────────────

export type SerializeMode = 'normalized' | 'roundtrip'

// ── XML escaping ──────────────────────────────────────────────────────────────

/** Escape XML special characters for use in attribute values and text content. */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escape for XML text content only (no need to escape quotes in text nodes). */
export function xmlEscapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Attribute building ────────────────────────────────────────────────────────

/**
 * Build an SVG attribute string from a plain object.
 * Skips entries where the value is null, undefined, or empty string.
 * Values are XML-escaped automatically.
 *
 * @example
 *   buildAttrs({ id: 'foo', cx: 50, ry: undefined }) → 'id="foo" cx="50"'
 */
export function buildAttrs(attrs: Record<string, string | number | boolean | undefined | null>): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === '') continue
    parts.push(`${k}="${xmlEscape(String(v))}"`)
  }
  return parts.join(' ')
}

/**
 * Emit `node.attributes` — the pass-through attribute map that holds
 * aria-*, data-*, xml:*, and other attrs the model doesn't have typed fields for.
 * These are emitted in both normalized and round-trip modes.
 */
export function rawAttrsString(node: SvgNode): string {
  if (!node.attributes || Object.keys(node.attributes).length === 0) return ''
  return Object.entries(node.attributes)
    .map(([k, v]) => `${k}="${xmlEscape(v)}"`)
    .join(' ')
}

/**
 * Emit `node.preservation.rawAttributes` — attributes that were present in
 * the original SVG source but are not recognized or typed in the model.
 * Only emitted in round-trip mode to preserve fidelity of imported SVG.
 */
export function preservationRawAttrs(node: SvgNode): string {
  const rawAttributes = node.preservation?.rawAttributes
  if (!rawAttributes || Object.keys(rawAttributes).length === 0) return ''
  return Object.entries(rawAttributes)
    .map(([k, v]) => `${k}="${xmlEscape(v)}"`)
    .join(' ')
}

/** Whether a node has unrecognized child XML to preserve. */
export function hasPreservationRawChildren(node: SvgNode): boolean {
  return !!(node.preservation?.rawChildren && node.preservation.rawChildren.length > 0)
}

/**
 * Get the raw XML children string from preservation metadata.
 * Returns empty string if not present.
 */
export function getPreservationRawChildren(node: SvgNode): string {
  return node.preservation?.rawChildren ?? ''
}

// ── Namespace helpers ─────────────────────────────────────────────────────────

/**
 * Build xmlns:prefix="uri" attribute string from namespace map.
 * Used to preserve non-standard namespace declarations on the SVG root.
 */
export function serializeNamespaces(namespaces?: Record<string, string>): string {
  if (!namespaces || Object.keys(namespaces).length === 0) return ''
  return Object.entries(namespaces)
    .map(([prefix, uri]) => `xmlns:${prefix}="${xmlEscape(uri)}"`)
    .join(' ')
}

// ── Paint serialization ───────────────────────────────────────────────────────

/** Serialize a PaintModel to an SVG fill/stroke color value string. */
export function paintValue(paint: PaintModel | undefined): string {
  if (!paint || paint.kind === 'none') return 'none'
  if (paint.kind === 'solid') return paint.color ?? '#000000'
  if (paint.kind === 'gradient') return `url(#${paint.resourceId})`
  if (paint.kind === 'pattern') return `url(#${paint.resourceId})`
  return 'none'
}

/** Serialize a fill PaintModel (with optional fill-opacity). */
export function fillAttrs(style: AppearanceModel | undefined): string {
  const fill = style?.fill
  const parts: string[] = [`fill="${paintValue(fill)}"`]
  if (fill?.kind === 'solid' && fill.opacity != null && fill.opacity < 1) {
    parts.push(`fill-opacity="${fill.opacity}"`)
  }
  return parts.join(' ')
}

/** Serialize stroke model attributes. Returns 'stroke="none"' if no stroke or width=0. */
export function strokeAttrs(stroke: StrokeModel | undefined): string {
  if (!stroke || stroke.width === 0) return 'stroke="none" stroke-width="0"'
  const parts = [
    `stroke="${stroke.color ?? '#000000'}"`,
    `stroke-width="${stroke.width}"`,
  ]
  if (stroke.opacity != null && stroke.opacity < 1) parts.push(`stroke-opacity="${stroke.opacity}"`)
  if (stroke.lineCap) parts.push(`stroke-linecap="${stroke.lineCap}"`)
  if (stroke.lineJoin) parts.push(`stroke-linejoin="${stroke.lineJoin}"`)
  if (stroke.miterLimit != null) parts.push(`stroke-miterlimit="${stroke.miterLimit}"`)
  if (stroke.dashArray?.length) parts.push(`stroke-dasharray="${stroke.dashArray.join(' ')}"`)
  if (stroke.dashOffset != null) parts.push(`stroke-dashoffset="${stroke.dashOffset}"`)
  if (stroke.nonScaling) parts.push('vector-effect="non-scaling-stroke"')
  return parts.join(' ')
}

/** Serialize appearance model attributes common to all shapes. */
export function appearanceAttrs(style: AppearanceModel | undefined, mode: SerializeMode): string {
  if (!style) return ''
  const parts: string[] = []
  if (style.opacity != null && style.opacity < 1) parts.push(`opacity="${style.opacity}"`)
  if (style.blendMode) parts.push(`mix-blend-mode="${style.blendMode}"`)
  if (style.filterRef) parts.push(`filter="url(#${style.filterRef})"`)
  if (style.maskRef) parts.push(`mask="url(#${style.maskRef})"`)
  if (style.clipPathRef) parts.push(`clip-path="url(#${style.clipPathRef})"`)
  if (style.markerStartRef) parts.push(`marker-start="url(#${style.markerStartRef})"`)
  if (style.markerMidRef) parts.push(`marker-mid="url(#${style.markerMidRef})"`)
  if (style.markerEndRef) parts.push(`marker-end="url(#${style.markerEndRef})"`)
  return parts.join(' ')
}

// ── Reference helpers ─────────────────────────────────────────────────────────

/**
 * Ensure a href value is a valid SVG fragment reference.
 *
 * The import engine (resolveHref) strips the '#' from local fragment refs like '#myId',
 * storing only 'myId'. The serializer must add '#' back for local references.
 *
 * Rule: if the href does not look like an absolute URL (no '://') and does not
 * start with '/', './', or '../', treat it as a local fragment ID and prefix with '#'.
 */
export function localFragRef(href: string): string {
  if (!href) return href
  if (href.startsWith('#')) return href // already has #
  if (href.includes('://') || href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
    return href // absolute or relative URL — emit as-is
  }
  return `#${href}` // local fragment ID — add #
}

// ── Indentation helpers ───────────────────────────────────────────────────────

/** Indent each non-empty line of a block of XML by `n` spaces. */
export function indent(xml: string, n: number): string {
  const pad = ' '.repeat(n)
  return xml
    .split('\n')
    .map((line) => (line.trim() ? pad + line : line))
    .join('\n')
}

/** Join an array of non-empty strings with a newline, dropping empty entries. */
export function joinLines(parts: string[]): string {
  return parts.filter(Boolean).join('\n')
}

// ── Attribute-set builder ─────────────────────────────────────────────────────

/**
 * Combine multiple attribute string fragments into a single string.
 * Automatically de-duplicates empty strings and joins with spaces.
 */
export function combineAttrs(...parts: (string | undefined | null)[]): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(' ')
}
