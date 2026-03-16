import type { AppearanceModel } from '@/model/nodes/nodeTypes'

/**
 * Resolved SVG presentation attributes derived from a node's AppearanceModel.
 * All fields are safe to spread onto an SVG element.
 */
export interface ResolvedStyleProps {
  fill: string
  stroke: string
  strokeWidth: number
  strokeOpacity?: number
  strokeLinecap?: 'butt' | 'round' | 'square'
  strokeLinejoin?: 'miter' | 'round' | 'bevel'
  strokeMiterlimit?: number
  strokeDasharray?: string
  strokeDashoffset?: number
  /** vectorEffect: 'non-scaling-stroke' when stroke.nonScaling is true */
  vectorEffect?: string
  opacity?: number
  filter?: string
  mask?: string
  clipPath?: string
  markerStart?: string
  markerMid?: string
  markerEnd?: string
  /** Inline style for CSS-only properties (mix-blend-mode) */
  style?: React.CSSProperties
}

/**
 * Resolves the fill string from a PaintModel.
 * Returns 'none', a CSS color, or a url() reference.
 */
function resolveFill(style?: AppearanceModel): string {
  const fill = style?.fill
  if (!fill) return 'transparent'
  switch (fill.kind) {
    case 'none': return 'none'
    case 'solid': return fill.color ?? '#000000'
    case 'gradient': return `url(#${fill.resourceId})`
    case 'pattern': return `url(#${fill.resourceId})`
    default: return 'transparent'
  }
}

/**
 * Converts a node's AppearanceModel (and base opacity) into a flat set of
 * SVG presentation attribute props ready to spread onto any SVG element.
 *
 * In outline mode all fills are suppressed and strokes are forced visible.
 */
export function resolveStyleProps(
  node: { style?: AppearanceModel; opacity?: number },
  outlineMode: boolean
): ResolvedStyleProps {
  const { style, opacity: nodeOpacity } = node

  // ── Fill ────────────────────────────────────────────────────────────────────
  const fill = outlineMode ? 'none' : resolveFill(style)

  // ── Stroke ──────────────────────────────────────────────────────────────────
  let stroke = style?.stroke?.color ?? 'transparent'
  let strokeWidth = style?.stroke?.width ?? 0

  if (outlineMode) {
    if (stroke === 'transparent') stroke = '#888888'
    if (strokeWidth < 1) strokeWidth = 1
  }

  // ── Opacity (node-level × style-level) ─────────────────────────────────────
  const styleOpacity = style?.opacity ?? 1
  const baseOpacity = nodeOpacity ?? 1
  const combined = baseOpacity * styleOpacity
  const opacity = combined < 1 ? combined : undefined

  // ── Stroke sub-properties ───────────────────────────────────────────────────
  const s = style?.stroke
  const strokeOpacity = s?.opacity != null && s.opacity < 1 ? s.opacity : undefined
  const strokeLinecap = s?.lineCap
  const strokeLinejoin = s?.lineJoin
  const strokeMiterlimit = s?.miterLimit
  const strokeDasharray = s?.dashArray?.length ? s.dashArray.join(' ') : undefined
  const strokeDashoffset = s?.dashOffset
  const vectorEffect = s?.nonScaling ? 'non-scaling-stroke' : undefined

  // ── Reference-based appearance ──────────────────────────────────────────────
  const filter = style?.filterRef ? `url(#${style.filterRef})` : undefined
  const mask = style?.maskRef ? `url(#${style.maskRef})` : undefined
  const clipPath = style?.clipPathRef ? `url(#${style.clipPathRef})` : undefined
  const markerStart = style?.markerStartRef ? `url(#${style.markerStartRef})` : undefined
  const markerMid = style?.markerMidRef ? `url(#${style.markerMidRef})` : undefined
  const markerEnd = style?.markerEndRef ? `url(#${style.markerEndRef})` : undefined

  // ── Blend mode (CSS only) ───────────────────────────────────────────────────
  const cssStyle: React.CSSProperties | undefined = style?.blendMode
    ? { mixBlendMode: style.blendMode as React.CSSProperties['mixBlendMode'] }
    : undefined

  return {
    fill,
    stroke,
    strokeWidth,
    ...(strokeOpacity != null && { strokeOpacity }),
    ...(strokeLinecap && { strokeLinecap }),
    ...(strokeLinejoin && { strokeLinejoin }),
    ...(strokeMiterlimit != null && { strokeMiterlimit }),
    ...(strokeDasharray && { strokeDasharray }),
    ...(strokeDashoffset != null && { strokeDashoffset }),
    ...(vectorEffect && { vectorEffect }),
    ...(opacity != null && { opacity }),
    ...(filter && { filter }),
    ...(mask && { mask }),
    ...(clipPath && { clipPath }),
    ...(markerStart && { markerStart }),
    ...(markerMid && { markerMid }),
    ...(markerEnd && { markerEnd }),
    ...(cssStyle && { style: cssStyle }),
  }
}
