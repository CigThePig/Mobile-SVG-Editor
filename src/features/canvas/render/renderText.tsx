import type { ReactNode } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type {
  TextNode,
  TspanNode,
  TextPathNode,
  TextStyleModel,
} from '@/model/nodes/nodeTypes'
import { resolveStyleProps } from './renderStyle'
import { transformToSvgString } from './renderTransform'

// ── TextStyle → SVG attribute helpers ────────────────────────────────────────

function textStyleAttrs(ts?: TextStyleModel): Record<string, unknown> {
  if (!ts) return {}
  return {
    ...(ts.fontFamily && { fontFamily: ts.fontFamily }),
    ...(ts.fontSize != null && { fontSize: ts.fontSize }),
    ...(ts.fontWeight != null && { fontWeight: ts.fontWeight }),
    ...(ts.fontStyle && { fontStyle: ts.fontStyle }),
    ...(ts.letterSpacing != null && { letterSpacing: ts.letterSpacing }),
    ...(ts.textAnchor && { textAnchor: ts.textAnchor }),
    ...(ts.dominantBaseline && { dominantBaseline: ts.dominantBaseline }),
    ...(ts.writingMode && { writingMode: ts.writingMode }),
    ...(ts.textDecoration && { textDecoration: ts.textDecoration }),
  }
}

// ── TextPath rendering ────────────────────────────────────────────────────────

export function renderTextPathNode(
  node: TextPathNode,
  onPointerDown: (event: ReactPointerEvent<SVGElement>, id: string) => void,
  outlineMode: boolean
): ReactNode {
  const styleProps = resolveStyleProps(node, outlineMode)
  const handlePointerDown = (e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation()
    onPointerDown(e, node.id)
  }

  // Normalize href: strip leading '#' if needed and re-add for attribute
  const href = node.href.startsWith('#') ? node.href : `#${node.href}`

  return (
    <textPath
      key={node.id}
      href={href}
      startOffset={node.startOffset ?? undefined}
      method={node.method ?? undefined}
      spacing={node.spacing ?? undefined}
      {...textStyleAttrs(node.textStyle)}
      {...styleProps}
      onPointerDown={handlePointerDown}
    >
      {node.runs?.length
        ? node.runs.map((r) => renderTspanNode(r, onPointerDown, outlineMode))
        : (node.content ?? '')}
    </textPath>
  )
}

// ── Tspan rendering ───────────────────────────────────────────────────────────

export function renderTspanNode(
  node: TspanNode,
  onPointerDown: (event: ReactPointerEvent<SVGElement>, id: string) => void,
  outlineMode: boolean
): ReactNode {
  const styleProps = resolveStyleProps(node, outlineMode)

  return (
    <tspan
      key={node.id}
      x={node.x ?? undefined}
      y={node.y ?? undefined}
      dx={node.dx ?? undefined}
      dy={node.dy ?? undefined}
      rotate={node.rotate ?? undefined}
      textLength={node.textLength ?? undefined}
      {...textStyleAttrs(node.textStyle)}
      {...styleProps}
    >
      {node.runs?.length
        ? node.runs.map((r) => renderTspanNode(r, onPointerDown, outlineMode))
        : (node.content ?? '')}
    </tspan>
  )
}

// ── Text node rendering ───────────────────────────────────────────────────────

export function renderTextNode(
  node: TextNode,
  onPointerDown: (event: ReactPointerEvent<SVGElement>, id: string) => void,
  outlineMode: boolean
): ReactNode {
  const styleProps = resolveStyleProps(node, outlineMode)
  const handlePointerDown = (e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation()
    onPointerDown(e, node.id)
  }

  // Children: prefer rich runs over plain content
  let children: ReactNode
  if (node.runs?.length) {
    children = node.runs.map((run) => {
      if (run.type === 'textPath') {
        return renderTextPathNode(run as unknown as TextPathNode, onPointerDown, outlineMode)
      }
      return renderTspanNode(run, onPointerDown, outlineMode)
    })
  } else {
    children = node.content
  }

  return (
    <text
      key={node.id}
      x={node.x}
      y={node.y}
      transform={transformToSvgString(node.transform)}
      {...textStyleAttrs(node.textStyle)}
      {...styleProps}
      onPointerDown={handlePointerDown}
      style={{ cursor: 'pointer', ...(styleProps.style ?? {}) }}
    >
      {children}
    </text>
  )
}
