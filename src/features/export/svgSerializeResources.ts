/**
 * svgSerializeResources.ts
 *
 * Serialization for SVG resource elements that live in <defs>:
 *   - linearGradient / radialGradient (with stops)
 *   - filter (always raw XML)
 *   - pattern (structured children or raw XML)
 *   - marker (structured children or raw XML)
 *   - style blocks (delegated to svgSerializeStyles)
 *
 * The ResourceStore does not contain symbol resources directly —
 * symbols appear in the document tree as SymbolNode instances.
 */

import type {
  ResourceStore,
  GradientResource,
  FilterResource,
  PatternResource,
  MarkerResource,
  StyleBlockResource,
} from '@/model/resources/resourceTypes'
import type { SerializeMode } from './svgSerializeUtils'
import { xmlEscape, buildAttrs } from './svgSerializeUtils'
import { serializeStyleBlock } from './svgSerializeStyles'

// ── Forward-declared node serializer (injected at call time) ──────────────────
// Avoids circular dependency between resources and nodes

type NodeSerializer = (node: import('@/model/nodes/nodeTypes').SvgNode) => string

// ── Gradient stops ────────────────────────────────────────────────────────────

function serializeGradientStop(stop: GradientResource['stops'][number]): string {
  // Preserve offset as-is (may be a number between 0-1 from the model).
  // The import engine stores offsets as 0–1 floats; we emit as percentages for
  // normalized mode but can also emit as-is when values look like SVG already.
  const offsetStr =
    typeof stop.offset === 'number' && stop.offset <= 1
      ? `${(stop.offset * 100).toFixed(1)}%`
      : String(stop.offset)

  const attrs = buildAttrs({
    offset: offsetStr,
    'stop-color': stop.color,
    'stop-opacity': stop.opacity != null && stop.opacity < 1 ? stop.opacity : undefined,
  })
  return `<stop ${attrs}/>`
}

// ── Gradient ──────────────────────────────────────────────────────────────────

/**
 * Serialize a GradientResource to a <linearGradient> or <radialGradient> element.
 * Both modes produce the same output — gradient structure is always well-typed.
 */
export function serializeGradient(g: GradientResource): string {
  const stops = g.stops.map(serializeGradientStop).join('\n    ')

  const sharedAttrs: Record<string, string | number | undefined | null> = {
    id: g.id,
    gradientUnits: g.gradientUnits ?? 'objectBoundingBox',
    gradientTransform: g.gradientTransform ?? undefined,
    spreadMethod: g.spreadMethod ?? undefined,
    href: g.href ? g.href : undefined,
  }

  if (g.type === 'linearGradient') {
    const attrs = buildAttrs({
      ...sharedAttrs,
      x1: g.x1 ?? '0',
      y1: g.y1 ?? '0',
      x2: g.x2 ?? '1',
      y2: g.y2 ?? '0',
    })
    return `<linearGradient ${attrs}>\n    ${stops}\n  </linearGradient>`
  }

  // radialGradient
  const attrs = buildAttrs({
    ...sharedAttrs,
    cx: g.cx ?? '50%',
    cy: g.cy ?? '50%',
    r: g.r ?? '50%',
    fx: g.fx ?? undefined,
    fy: g.fy ?? undefined,
    fr: g.fr ?? undefined,
  })
  return `<radialGradient ${attrs}>\n    ${stops}\n  </radialGradient>`
}

// ── Filter ────────────────────────────────────────────────────────────────────

/**
 * Serialize a FilterResource.
 * Filters are always stored as raw XML (the import engine does not parse
 * individual filter primitives). The raw XML is emitted verbatim in all modes.
 */
export function serializeFilter(f: FilterResource): string {
  if (f.rawXml) {
    return f.rawXml
  }
  // Fallback: emit a minimal filter shell with id/bounds only
  const attrs = buildAttrs({
    id: f.id,
    x: f.x ?? undefined,
    y: f.y ?? undefined,
    width: f.width ?? undefined,
    height: f.height ?? undefined,
    filterUnits: f.filterUnits ?? undefined,
    primitiveUnits: f.primitiveUnits ?? undefined,
  })
  return `<filter ${attrs}/>`
}

// ── Pattern ───────────────────────────────────────────────────────────────────

/**
 * Serialize a PatternResource.
 * If rawXml is present (complex/unrecognized pattern), emit verbatim.
 * Otherwise serialize the typed structure.
 */
export function serializePattern(
  p: PatternResource,
  mode: SerializeMode,
  serializeNode: NodeSerializer
): string {
  if (p.rawXml) {
    return p.rawXml
  }

  const attrs = buildAttrs({
    id: p.id,
    x: p.x ?? undefined,
    y: p.y ?? undefined,
    width: p.width ?? undefined,
    height: p.height ?? undefined,
    patternUnits: p.patternUnits ?? undefined,
    patternContentUnits: p.patternContentUnits ?? undefined,
    patternTransform: p.patternTransform ?? undefined,
    viewBox: p.viewBox ?? undefined,
    preserveAspectRatio: p.preserveAspectRatio ?? undefined,
  })

  if (p.children?.length) {
    const children = p.children.map(serializeNode).join('\n    ')
    return `<pattern ${attrs}>\n    ${children}\n  </pattern>`
  }

  return `<pattern ${attrs}/>`
}

// ── Marker ────────────────────────────────────────────────────────────────────

/**
 * Serialize a MarkerResource.
 * If rawXml is present, emit verbatim.
 * Otherwise serialize the typed structure.
 */
export function serializeMarker(
  m: MarkerResource,
  mode: SerializeMode,
  serializeNode: NodeSerializer
): string {
  if (m.rawXml) {
    return m.rawXml
  }

  const attrs = buildAttrs({
    id: m.id,
    viewBox: m.viewBox ?? undefined,
    refX: m.refX ?? undefined,
    refY: m.refY ?? undefined,
    markerWidth: m.markerWidth ?? undefined,
    markerHeight: m.markerHeight ?? undefined,
    orient: m.orient ?? undefined,
    markerUnits: m.markerUnits ?? undefined,
    preserveAspectRatio: m.preserveAspectRatio ?? undefined,
  })

  if (m.children?.length) {
    const children = m.children.map(serializeNode).join('\n    ')
    return `<marker ${attrs}>\n    ${children}\n  </marker>`
  }

  return `<marker ${attrs}/>`
}

// ── Style block ───────────────────────────────────────────────────────────────

export { serializeStyleBlock }

// ── Unified resource defs block ───────────────────────────────────────────────

/**
 * Serialize the entire ResourceStore into a <defs> block content string.
 * Only includes resources that are not already serialized in the node tree
 * (symbols and clip paths are serialized inline as part of the tree walk).
 *
 * Returns the content to go inside <defs>…</defs> (not including the defs tags).
 * Returns empty string if there is nothing to put in defs.
 */
export function serializeResourceDefs(
  resources: ResourceStore,
  mode: SerializeMode,
  serializeNode: NodeSerializer
): string {
  const parts: string[] = []

  // Style blocks first (per SVG spec, style should come early)
  for (const sb of resources.styleBlocks) {
    parts.push(serializeStyleBlock(sb, mode))
  }

  // Gradients
  for (const g of resources.gradients) {
    parts.push(serializeGradient(g))
  }

  // Filters (always raw)
  for (const f of resources.filters) {
    parts.push(serializeFilter(f))
  }

  // Patterns
  for (const p of resources.patterns) {
    parts.push(serializePattern(p, mode, serializeNode))
  }

  // Markers
  for (const m of resources.markers) {
    parts.push(serializeMarker(m, mode, serializeNode))
  }

  return parts.filter(Boolean).join('\n  ')
}
