import type { ReactNode } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
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
  TextNode,
  TspanNode,
  TextPathNode,
  ImageNode,
  GroupNode,
  SymbolNode,
  UseNode,
  ClipPathNode,
  MaskNode,
  MarkerNode,
  DefsNode,
  ANode,
  SwitchNode,
} from '@/model/nodes/nodeTypes'
import type { SvgDocument } from '@/model/document/documentTypes'
import { resolveStyleProps } from './renderStyle'
import { transformToSvgString } from './renderTransform'
import { renderTextNode, renderTspanNode, renderTextPathNode } from './renderText'
import { renderUseNode } from './renderUse'

// ── Render context ─────────────────────────────────────────────────────────────

/**
 * Contextual data passed down through the render tree.
 * Provides document-level information needed for reference resolution.
 */
export interface RenderContext {
  /** Full document — needed for resolving use/symbol hrefs and resources */
  document: SvgDocument
  /** Currently selected node IDs — used for opacity dimming */
  selectedIds: string[]
  /** Outline (wireframe) mode — suppress fill, ensure visible stroke */
  outlineMode: boolean
  /** Pointer down handler for node selection/interaction */
  onPointerDown: (event: ReactPointerEvent<SVGElement>, id: string) => void
}

// ── Star helper ────────────────────────────────────────────────────────────────

function computeStarPoints(cx: number, cy: number, outer: number, inner: number, n: number): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const angle = (Math.PI / n) * i - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return pts.join(' ')
}

// ── Fidelity fallback ─────────────────────────────────────────────────────────

/**
 * Renders a visual placeholder for nodes with editabilityLevel 3 or 4
 * (preserved-raw or display-only) that have no structural rendering path.
 * The placeholder is still selectable via onPointerDown.
 */
function renderFallbackPlaceholder(
  node: SvgNode,
  ctx: RenderContext,
  label?: string
): ReactNode {
  const handlePointerDown = (e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation()
    ctx.onPointerDown(e, node.id)
  }

  const displayLabel = label ?? node.type
  const transform = transformToSvgString(node.transform)

  return (
    <g
      key={node.id}
      transform={transform}
      opacity={node.opacity ?? 1}
      onPointerDown={handlePointerDown}
      style={{ cursor: 'pointer' }}
    >
      {/* Dashed purple outline placeholder */}
      <rect
        x={0} y={0} width={40} height={20}
        fill="rgba(168,85,247,0.05)"
        stroke="#a855f7"
        strokeWidth={1}
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
        style={{ pointerEvents: 'none' }}
      />
      {/* Label */}
      <text
        x={4} y={13}
        fontSize={9}
        fill="#a855f7"
        fontFamily="monospace"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {`<${displayLabel}>`}
      </text>
      <title>{`Preserved element: <${displayLabel}>`}</title>
    </g>
  )
}

// ── Main node dispatcher ───────────────────────────────────────────────────────

/**
 * Renders any SvgNode into React SVG elements.
 *
 * This is the full Phase 5 renderer with coverage for all node types.
 * Unknown / preserved-raw nodes receive a visual fallback placeholder.
 */
export function renderNode(node: SvgNode, ctx: RenderContext): ReactNode {
  // All invisible nodes are skipped
  if (node.visible === false) return null

  const { selectedIds, outlineMode, onPointerDown } = ctx

  // Selection dimming (applied at the container level for groups/root)
  const isSelected = selectedIds.includes(node.id)
  const opacity = isSelected ? 0.9 : undefined

  const handlePointerDown = (e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation()
    onPointerDown(e, node.id)
  }

  // Common props shared by most leaf elements
  const commonProps = {
    key: node.id,
    onPointerDown: handlePointerDown,
    style: { cursor: 'pointer' },
    ...(opacity != null && { opacity }),
    transform: transformToSvgString(node.transform),
  }

  switch (node.type) {

    // ── Basic shapes ──────────────────────────────────────────────────────────

    case 'rect': {
      const n = node as RectNode
      const sp = resolveStyleProps(n, outlineMode)
      return (
        <rect
          {...commonProps}
          x={n.x} y={n.y}
          width={n.width} height={n.height}
          rx={n.rx ?? undefined} ry={n.ry ?? undefined}
          {...sp}
        />
      )
    }

    case 'circle': {
      const n = node as CircleNode
      const sp = resolveStyleProps(n, outlineMode)
      return <circle {...commonProps} cx={n.cx} cy={n.cy} r={n.r} {...sp} />
    }

    case 'ellipse': {
      const n = node as EllipseNode
      const sp = resolveStyleProps(n, outlineMode)
      return <ellipse {...commonProps} cx={n.cx} cy={n.cy} rx={n.rx} ry={n.ry} {...sp} />
    }

    case 'line': {
      const n = node as LineNode
      const sp = resolveStyleProps(n, outlineMode)
      // Lines always need a visible stroke
      const strokeWidth = outlineMode
        ? Math.max(1, sp.strokeWidth)
        : (sp.strokeWidth || 2)
      return (
        <line
          {...commonProps}
          x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2}
          {...sp}
          strokeWidth={strokeWidth}
        />
      )
    }

    case 'polyline': {
      const n = node as PolylineNode
      const sp = resolveStyleProps(n, outlineMode)
      // polylines are always open paths — force fill to none regardless of style
      return (
        <polyline
          {...commonProps}
          points={n.points.map((p) => `${p.x},${p.y}`).join(' ')}
          {...sp}
          fill="none"
        />
      )
    }

    case 'polygon': {
      const n = node as PolygonNode
      const sp = resolveStyleProps(n, outlineMode)
      return (
        <polygon
          {...commonProps}
          points={n.points.map((p) => `${p.x},${p.y}`).join(' ')}
          {...sp}
        />
      )
    }

    case 'star': {
      const n = node as StarNode
      const sp = resolveStyleProps(n, outlineMode)
      const pts = computeStarPoints(n.cx, n.cy, n.outerRadius, n.innerRadius, n.numPoints)
      return <polygon {...commonProps} points={pts} {...sp} />
    }

    case 'path': {
      const n = node as PathNode
      const sp = resolveStyleProps(n, outlineMode)
      return <path {...commonProps} d={n.d} {...sp} />
    }

    // ── Text ──────────────────────────────────────────────────────────────────

    case 'text':
      return renderTextNode(node as TextNode, onPointerDown, outlineMode)

    case 'tspan':
      return renderTspanNode(node as TspanNode, onPointerDown, outlineMode)

    case 'textPath':
      return renderTextPathNode(node as TextPathNode, onPointerDown, outlineMode)

    // ── Image ─────────────────────────────────────────────────────────────────

    case 'image': {
      const n = node as ImageNode
      const sp = resolveStyleProps(n as { style?: import('@/model/nodes/nodeTypes').AppearanceModel; opacity?: number }, outlineMode)
      return (
        <image
          {...commonProps}
          href={n.href}
          x={n.x} y={n.y}
          width={n.width} height={n.height}
          preserveAspectRatio={n.preserveAspectRatio ?? undefined}
          {...sp}
        />
      )
    }

    // ── Containers ────────────────────────────────────────────────────────────

    case 'group': {
      const n = node as GroupNode
      const sp = resolveStyleProps(n, outlineMode)
      return (
        <g
          key={node.id}
          transform={transformToSvgString(n.transform)}
          onPointerDown={handlePointerDown}
          style={{ cursor: 'pointer', ...(sp.style ?? {}) }}
          {...(opacity != null && { opacity })}
          {...(sp.filter && { filter: sp.filter })}
          {...(sp.mask && { mask: sp.mask })}
          {...(sp.clipPath && { clipPath: sp.clipPath })}
          {...(sp.opacity != null && { opacity: sp.opacity })}
        >
          {n.children?.map((child) => renderNode(child, ctx))}
        </g>
      )
    }

    case 'root':
      return (
        <g key={node.id}>
          {node.children?.map((child) => renderNode(child, ctx))}
        </g>
      )

    case 'defs': {
      const n = node as DefsNode
      // Render defs inline — browser handles referenceability regardless of position
      return (
        <defs key={node.id}>
          {n.children?.map((child) => renderNode(child, ctx))}
        </defs>
      )
    }

    // ── Symbol (definition, usable via <use>) ─────────────────────────────────

    case 'symbol': {
      const n = node as SymbolNode
      return (
        <symbol
          key={node.id}
          id={node.id}
          viewBox={n.viewBox ?? undefined}
          preserveAspectRatio={n.preserveAspectRatio ?? undefined}
        >
          {n.children?.map((child) => renderNode(child, ctx))}
        </symbol>
      )
    }

    // ── Use ───────────────────────────────────────────────────────────────────

    case 'use':
      return renderUseNode(node as UseNode, onPointerDown, outlineMode)

    // ── Clip path (definition) ────────────────────────────────────────────────

    case 'clipPath': {
      const n = node as ClipPathNode
      return (
        <clipPath
          key={node.id}
          id={node.id}
          clipPathUnits={n.clipPathUnits ?? undefined}
        >
          {n.children?.map((child) => renderNode(child, ctx))}
        </clipPath>
      )
    }

    // ── Mask (definition) ─────────────────────────────────────────────────────

    case 'mask': {
      const n = node as MaskNode
      return (
        <mask
          key={node.id}
          id={node.id}
          maskUnits={n.maskUnits ?? undefined}
          maskContentUnits={n.maskContentUnits ?? undefined}
          x={n.x ?? undefined}
          y={n.y ?? undefined}
          width={n.width ?? undefined}
          height={n.height ?? undefined}
        >
          {n.children?.map((child) => renderNode(child, ctx))}
        </mask>
      )
    }

    // ── Marker (definition) ───────────────────────────────────────────────────

    case 'marker': {
      const n = node as MarkerNode
      const sp = resolveStyleProps(n, outlineMode)
      return (
        <marker
          key={node.id}
          id={node.id}
          viewBox={n.viewBox ?? undefined}
          refX={n.refX ?? undefined}
          refY={n.refY ?? undefined}
          markerWidth={n.markerWidth ?? undefined}
          markerHeight={n.markerHeight ?? undefined}
          orient={n.orient ?? undefined}
          markerUnits={n.markerUnits ?? undefined}
          preserveAspectRatio={n.preserveAspectRatio ?? undefined}
          {...sp}
        >
          {n.children?.map((child) => renderNode(child, ctx))}
        </marker>
      )
    }

    // ── Anchor (render as group — href not navigable in editor) ───────────────

    case 'a': {
      const n = node as ANode
      const sp = resolveStyleProps(n, outlineMode)
      return (
        <g
          key={node.id}
          transform={transformToSvgString(n.transform)}
          onPointerDown={handlePointerDown}
          style={{ cursor: 'pointer', ...(sp.style ?? {}) }}
          {...(opacity != null && { opacity })}
        >
          {n.children?.map((child) => renderNode(child, ctx))}
        </g>
      )
    }

    // ── Switch (render all children — no feature testing) ─────────────────────

    case 'switch': {
      const n = node as SwitchNode
      return (
        <g
          key={node.id}
          transform={transformToSvgString(n.transform)}
          onPointerDown={handlePointerDown}
          style={{ cursor: 'pointer' }}
          {...(opacity != null && { opacity })}
        >
          {n.children?.map((child) => renderNode(child, ctx))}
        </g>
      )
    }

    // ── Style (already handled by SvgDefsLayer — skip in tree render) ─────────

    case 'style':
      return null

    // ── ForeignObject — visual placeholder only ───────────────────────────────

    case 'foreignObject':
      return renderFallbackPlaceholder(node, ctx, 'foreignObject')

    // ── Fallback for any unrecognized or preserved-raw node ───────────────────

    default:
      // Only show placeholder for nodes with preservation metadata
      if ((node as SvgNode & { preservation?: { editabilityLevel?: number } }).preservation) {
        return renderFallbackPlaceholder(node, ctx)
      }
      return null
  }
}
