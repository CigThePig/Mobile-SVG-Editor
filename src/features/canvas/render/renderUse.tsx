import type { ReactNode } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { UseNode } from '@/model/nodes/nodeTypes'
import { resolveStyleProps } from './renderStyle'
import { transformToSvgString } from './renderTransform'

/**
 * Renders a <use> element that references a symbol or any other element by ID.
 *
 * The referenced element (symbol, group, shape) must already be defined
 * somewhere in the SVG DOM for the browser to render it. Symbol definitions
 * are placed in the tree and rendered by renderNode's 'symbol' case, which
 * emits a native <symbol> element. All other referenced elements are present
 * in the rendered content tree.
 *
 * This renderer simply emits the <use> element with the correct href and
 * any positional/size overrides, allowing the browser to handle instantiation.
 */
export function renderUseNode(
  node: UseNode,
  onPointerDown: (event: ReactPointerEvent<SVGElement>, id: string) => void,
  outlineMode: boolean
): ReactNode {
  const styleProps = resolveStyleProps(node, outlineMode)
  const handlePointerDown = (e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation()
    onPointerDown(e, node.id)
  }

  // Normalize href — SVG <use> requires '#id' format
  const href = node.href.startsWith('#') ? node.href : `#${node.href}`

  return (
    <use
      key={node.id}
      href={href}
      x={node.x ?? undefined}
      y={node.y ?? undefined}
      width={node.width ?? undefined}
      height={node.height ?? undefined}
      transform={transformToSvgString(node.transform)}
      {...styleProps}
      onPointerDown={handlePointerDown}
      style={{ cursor: 'pointer', ...(styleProps.style ?? {}) }}
    />
  )
}
