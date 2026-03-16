import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type {
  ResourceStore,
  GradientResource,
  PatternResource,
  FilterResource,
  MarkerResource,
} from '@/model/resources/resourceTypes'

// ── Raw XML injector ──────────────────────────────────────────────────────────

/**
 * Injects raw SVG XML strings (filters, complex patterns, complex markers)
 * into a <g> element that lives inside <defs>. Elements defined here remain
 * referenceable by ID regardless of their position in the DOM.
 */
function RawXmlDefsInjector({ rawXmls }: { rawXmls: string[] }): ReactNode {
  const ref = useRef<SVGGElement>(null)
  const joined = rawXmls.join('\n')

  useEffect(() => {
    const el = ref.current
    if (!el || !joined) return
    el.innerHTML = joined
  }, [joined])

  return <g ref={ref} />
}

// ── Gradient rendering ────────────────────────────────────────────────────────

function renderGradient(g: GradientResource): ReactNode {
  const stops = g.stops.map((s, i) => (
    <stop
      key={i}
      offset={`${(s.offset * 100).toFixed(2)}%`}
      stopColor={s.color}
      stopOpacity={s.opacity ?? 1}
    />
  ))

  if (g.type === 'linearGradient') {
    return (
      <linearGradient
        key={g.id}
        id={g.id}
        x1={g.x1 ?? '0%'}
        y1={g.y1 ?? '0%'}
        x2={g.x2 ?? '100%'}
        y2={g.y2 ?? '0%'}
        gradientUnits={g.gradientUnits ?? 'objectBoundingBox'}
        gradientTransform={g.gradientTransform ?? undefined}
        spreadMethod={g.spreadMethod ?? undefined}
        href={g.href ?? undefined}
      >
        {stops}
      </linearGradient>
    )
  }

  // radialGradient
  return (
    <radialGradient
      key={g.id}
      id={g.id}
      cx={g.cx ?? '50%'}
      cy={g.cy ?? '50%'}
      r={g.r ?? '50%'}
      fx={g.fx ?? undefined}
      fy={g.fy ?? undefined}
      gradientUnits={g.gradientUnits ?? 'objectBoundingBox'}
      gradientTransform={g.gradientTransform ?? undefined}
      spreadMethod={g.spreadMethod ?? undefined}
      href={g.href ?? undefined}
    >
      {stops}
    </radialGradient>
  )
}

// ── Pattern rendering ─────────────────────────────────────────────────────────

/**
 * Renders structured patterns (those with `children`).
 * Patterns with only `rawXml` are handled by RawXmlDefsInjector.
 */
function renderPattern(p: PatternResource): ReactNode {
  if (!p.children?.length) return null

  return (
    <pattern
      key={p.id}
      id={p.id}
      x={p.x ?? 0}
      y={p.y ?? 0}
      width={p.width ?? 1}
      height={p.height ?? 1}
      patternUnits={p.patternUnits ?? 'objectBoundingBox'}
      patternContentUnits={p.patternContentUnits ?? undefined}
      patternTransform={p.patternTransform ?? undefined}
      viewBox={p.viewBox ?? undefined}
      preserveAspectRatio={p.preserveAspectRatio ?? undefined}
    >
      {/* Pattern child nodes are simple shapes; render as raw SVG via innerHTML
          to avoid circular dependency with renderNode */}
      {p.children.map((child) => {
        // Minimal inline renderer for pattern content (Phase 5 scope)
        if (child.type === 'rect') {
          const n = child as import('@/model/nodes/nodeTypes').RectNode
          return <rect key={n.id} x={n.x} y={n.y} width={n.width} height={n.height} fill={n.style?.fill?.kind === 'solid' ? n.style.fill.color : 'currentColor'} />
        }
        if (child.type === 'circle') {
          const n = child as import('@/model/nodes/nodeTypes').CircleNode
          return <circle key={n.id} cx={n.cx} cy={n.cy} r={n.r} fill={n.style?.fill?.kind === 'solid' ? n.style.fill.color : 'currentColor'} />
        }
        if (child.type === 'path') {
          const n = child as import('@/model/nodes/nodeTypes').PathNode
          return <path key={n.id} d={n.d} fill={n.style?.fill?.kind === 'solid' ? n.style.fill.color : 'currentColor'} />
        }
        return null
      })}
    </pattern>
  )
}

// ── Marker rendering ──────────────────────────────────────────────────────────

/**
 * Renders structured markers (those with `children`).
 * Markers with only `rawXml` are handled by RawXmlDefsInjector.
 */
function renderMarker(m: MarkerResource): ReactNode {
  if (!m.children?.length) return null

  return (
    <marker
      key={m.id}
      id={m.id}
      viewBox={m.viewBox ?? undefined}
      refX={m.refX ?? undefined}
      refY={m.refY ?? undefined}
      markerWidth={m.markerWidth ?? undefined}
      markerHeight={m.markerHeight ?? undefined}
      orient={m.orient ?? undefined}
      markerUnits={m.markerUnits ?? undefined}
      preserveAspectRatio={m.preserveAspectRatio ?? undefined}
    >
      {m.children.map((child) => {
        if (child.type === 'path') {
          const n = child as import('@/model/nodes/nodeTypes').PathNode
          return <path key={n.id} d={n.d} fill={n.style?.fill?.kind === 'solid' ? n.style.fill.color : 'currentColor'} />
        }
        if (child.type === 'rect') {
          const n = child as import('@/model/nodes/nodeTypes').RectNode
          return <rect key={n.id} x={n.x} y={n.y} width={n.width} height={n.height} fill={n.style?.fill?.kind === 'solid' ? n.style.fill.color : 'currentColor'} />
        }
        if (child.type === 'circle') {
          const n = child as import('@/model/nodes/nodeTypes').CircleNode
          return <circle key={n.id} cx={n.cx} cy={n.cy} r={n.r} fill={n.style?.fill?.kind === 'solid' ? n.style.fill.color : 'currentColor'} />
        }
        return null
      })}
    </marker>
  )
}

// ── Style block rendering ─────────────────────────────────────────────────────

function renderStyleBlock(id: string, cssText: string): ReactNode {
  return (
    <style key={id}>
      {cssText}
    </style>
  )
}

// ── Main defs layer ───────────────────────────────────────────────────────────

interface SvgDefsLayerProps {
  resources: ResourceStore
}

/**
 * Renders the complete SVG <defs> block from a document's ResourceStore.
 *
 * Handles:
 * - Linear and radial gradients (full attribute set)
 * - Patterns (structured children rendered inline; rawXml injected via DOM)
 * - Filters (always rawXml — injected via DOM)
 * - Markers (structured children rendered inline; rawXml injected via DOM)
 * - Inline style blocks from imported SVG <style> elements
 */
export function SvgDefsLayer({ resources }: SvgDefsLayerProps): ReactNode {
  const {
    gradients = [],
    patterns = [],
    filters = [],
    markers = [],
    styleBlocks = [],
  } = resources

  const hasStructured =
    gradients.length > 0 ||
    patterns.some((p) => p.children?.length) ||
    markers.some((m) => m.children?.length) ||
    styleBlocks.length > 0

  // Collect all raw XML for injection
  const rawXmls: string[] = [
    ...filters.filter((f): f is FilterResource & { rawXml: string } => Boolean(f.rawXml)).map((f) => f.rawXml),
    ...patterns.filter((p): p is PatternResource & { rawXml: string } => Boolean(p.rawXml) && !p.children?.length).map((p) => p.rawXml),
    ...markers.filter((m): m is MarkerResource & { rawXml: string } => Boolean(m.rawXml) && !m.children?.length).map((m) => m.rawXml),
  ]

  if (!hasStructured && rawXmls.length === 0) return null

  return (
    <defs>
      {/* Gradient definitions — full attribute fidelity */}
      {gradients.map(renderGradient)}

      {/* Pattern definitions — structured children only */}
      {patterns.map(renderPattern)}

      {/* Marker definitions — structured children only */}
      {markers.map(renderMarker)}

      {/* Inline CSS style blocks from imported SVG */}
      {styleBlocks.map((sb) => renderStyleBlock(sb.id, sb.cssText))}

      {/* Raw XML injection for filters, complex patterns, complex markers */}
      {rawXmls.length > 0 && <RawXmlDefsInjector rawXmls={rawXmls} />}
    </defs>
  )
}
