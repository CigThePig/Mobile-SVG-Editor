/**
 * MultiSelectionInspector.tsx
 *
 * Inspector view for multi-node selections: combined bounds, batch style, bulk actions.
 */

import { useCallback } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { runCommand } from '@/features/documents/services/commandRunner'
import { getNodeBounds, combineBounds } from '@/features/selection/utils/nodeBounds'
import type { SvgNode, AppearanceModel, StrokeModel } from '@/model/nodes/nodeTypes'
import { S, SectionHeader, GeometryGrid, ColorEditor, NumberEditor } from '../inspectorShared'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStyle(node: SvgNode): AppearanceModel {
  return (node as { style?: AppearanceModel }).style ?? {}
}

function getFillColor(node: SvgNode): string {
  const style = getStyle(node)
  if (style.fill?.kind === 'solid') return style.fill.color ?? '#000000'
  return '#000000'
}

function getStrokeColor(node: SvgNode): string {
  return getStyle(node).stroke?.color ?? '#000000'
}

function getStrokeWidth(node: SvgNode): number {
  return getStyle(node).stroke?.width ?? 1
}

const STYLE_NODE_TYPES = new Set(['group', 'rect', 'circle', 'ellipse', 'line', 'polyline',
  'polygon', 'star', 'path', 'text', 'tspan', 'textPath', 'image', 'symbol', 'use', 'marker', 'a'])

function hasStyle(node: SvgNode): boolean {
  return STYLE_NODE_TYPES.has(node.type)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MultiSelectionInspector({ nodes }: { nodes: SvgNode[] }) {
  const bounds = combineBounds(
    nodes.map(getNodeBounds).filter((b): b is NonNullable<ReturnType<typeof getNodeBounds>> => Boolean(b))
  )

  const firstNode = nodes[0]
  const firstStyle = firstNode ? getStyle(firstNode) : {}
  const hasStyleNodes = nodes.some(hasStyle)
  const fillColor = firstNode && hasStyle(firstNode) ? getFillColor(firstNode) : '#000000'
  const strokeColor = firstNode && hasStyle(firstNode) ? getStrokeColor(firstNode) : '#000000'
  const strokeWidth = firstNode && hasStyle(firstNode) ? getStrokeWidth(firstNode) : 1

  const applyFillToAll = useCallback(
    (color: string) => {
      for (const node of nodes) {
        if (hasStyle(node)) {
          void runCommand('document.updateNodeFill', { nodeId: node.id, color })
        }
      }
    },
    [nodes]
  )

  const applyStrokeColorToAll = useCallback(
    (color: string) => {
      for (const node of nodes) {
        if (hasStyle(node)) {
          const style = getStyle(node)
          void runCommand('document.updateNodeStroke', {
            nodeId: node.id,
            stroke: { ...(style.stroke ?? { width: 1 }), color }
          })
        }
      }
    },
    [nodes]
  )

  const applyStrokeWidthToAll = useCallback(
    (width: number) => {
      for (const node of nodes) {
        if (hasStyle(node)) {
          const style = getStyle(node)
          void runCommand('document.updateNodeStroke', {
            nodeId: node.id,
            stroke: { ...(style.stroke ?? { color: '#000000' }), width }
          })
        }
      }
    },
    [nodes]
  )

  const applyOpacityToAll = useCallback(
    (pct: number) => {
      for (const node of nodes) {
        void runCommand('document.updateNodeStyle', { nodeId: node.id, style: { opacity: pct / 100 } })
      }
    },
    [nodes]
  )

  const duplicateAll = useCallback(() => {
    void runCommand('document.duplicateNodes', { nodeIds: nodes.map((n) => n.id) })
  }, [nodes])

  const deleteAll = useCallback(() => {
    void runCommand('document.deleteNodes', { nodeIds: nodes.map((n) => n.id) })
  }, [nodes])

  return (
    <div>
      {/* Selection info */}
      <SectionHeader label="Selection" />
      <div style={S.row}>
        <span style={S.label}>Count</span>
        <span style={{ ...S.value, ...S.accent }}>{nodes.length} objects</span>
      </div>

      {/* Combined bounds */}
      {bounds && (
        <>
          <SectionHeader label="Combined Bounds" />
          <GeometryGrid x={bounds.x} y={bounds.y} w={bounds.width} h={bounds.height} />
        </>
      )}

      {/* Batch style */}
      {hasStyleNodes && (
        <>
          <SectionHeader label="Batch Style" />

          {firstStyle.fill?.kind === 'solid' && (
            <ColorEditor
              label="Fill"
              color={fillColor}
              onChange={applyFillToAll}
            />
          )}

          {firstStyle.stroke && (
            <>
              <ColorEditor
                label="Stroke"
                color={strokeColor}
                onChange={applyStrokeColorToAll}
              />
              <NumberEditor
                label="Stroke width"
                value={strokeWidth}
                min={0}
                max={200}
                onCommit={applyStrokeWidthToAll}
              />
            </>
          )}

          <NumberEditor
            label="Opacity %"
            value={100}
            min={0}
            max={100}
            onCommit={applyOpacityToAll}
          />
        </>
      )}

      {/* Actions */}
      <SectionHeader label="Actions" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
        <button onClick={duplicateAll} style={S.actionBtn}>
          <Copy size={13} /> Duplicate All
        </button>
        <button onClick={deleteAll} style={S.actionBtnDanger}>
          <Trash2 size={13} /> Delete All
        </button>
      </div>
    </div>
  )
}
