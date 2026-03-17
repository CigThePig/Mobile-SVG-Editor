/**
 * GeometrySection.tsx
 *
 * Inspector section for node-type-specific geometry (position, size, radii, etc.)
 * and the computed bounding box.
 */

import { useCallback } from 'react'
import { runCommand } from '@/features/documents/services/commandRunner'
import { getNodeBounds } from '@/features/selection/utils/nodeBounds'
import type {
  SvgNode,
  RectNode,
  CircleNode,
  EllipseNode,
  LineNode,
  StarNode,
  TextNode,
  ImageNode,
  UseNode
} from '@/model/nodes/nodeTypes'
import { S, AccordionSection, NumberEditor, GeometryGrid } from '../inspectorShared'

// ─── Component ────────────────────────────────────────────────────────────────

export function GeometrySection({ node }: { node: SvgNode }) {
  const nodeId = node.id
  const bounds = getNodeBounds(node)

  const commit = useCallback(
    (properties: Record<string, unknown>) => {
      void runCommand('document.updateNodeProperties', { nodeId, properties })
    },
    [nodeId]
  )

  const hasGeometry = [
    'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'path', 'text', 'image', 'use', 'star'
  ].includes(node.type)

  if (!hasGeometry && !bounds) return null

  return (
    <AccordionSection title="Geometry" defaultOpen>
      {/* Computed bounds display */}
      {bounds && (
        <>
          <div style={{ ...S.sectionHeader, marginTop: 4 }}>Bounds</div>
          <GeometryGrid x={bounds.x} y={bounds.y} w={bounds.width} h={bounds.height} />
          <div style={{ height: 8 }} />
        </>
      )}

      {/* Rect */}
      {node.type === 'rect' && <RectGeometry node={node as RectNode} commit={commit} />}
      {/* Circle */}
      {node.type === 'circle' && <CircleGeometry node={node as CircleNode} commit={commit} />}
      {/* Ellipse */}
      {node.type === 'ellipse' && <EllipseGeometry node={node as EllipseNode} commit={commit} />}
      {/* Line */}
      {node.type === 'line' && <LineGeometry node={node as LineNode} commit={commit} />}
      {/* Polyline / polygon */}
      {(node.type === 'polyline' || node.type === 'polygon') && (
        <PolyGeometry node={node as { points: Array<{ x: number; y: number }> }} />
      )}
      {/* Path */}
      {node.type === 'path' && <PathGeometry node={node as { d?: string }} />}
      {/* Text */}
      {node.type === 'text' && <TextGeometry node={node as TextNode} commit={commit} />}
      {/* Image */}
      {node.type === 'image' && <ImageGeometry node={node as ImageNode} commit={commit} />}
      {/* Use */}
      {node.type === 'use' && <UseGeometry node={node as UseNode} commit={commit} />}
      {/* Star */}
      {node.type === 'star' && <StarGeometry node={node as StarNode} commit={commit} />}
    </AccordionSection>
  )
}

// ─── Per-type geometry editors ────────────────────────────────────────────────

function RectGeometry({ node, commit }: { node: RectNode; commit: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <NumberEditor label="X" value={node.x} onCommit={(v) => commit({ x: v })} />
      <NumberEditor label="Y" value={node.y} onCommit={(v) => commit({ y: v })} />
      <NumberEditor label="Width" value={node.width} min={0} onCommit={(v) => commit({ width: v })} />
      <NumberEditor label="Height" value={node.height} min={0} onCommit={(v) => commit({ height: v })} />
      <NumberEditor label="Corner radius" value={node.rx ?? 0} min={0} onCommit={(v) => commit({ rx: v, ry: v })} />
    </>
  )
}

function CircleGeometry({ node, commit }: { node: CircleNode; commit: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <NumberEditor label="Center X" value={node.cx} onCommit={(v) => commit({ cx: v })} />
      <NumberEditor label="Center Y" value={node.cy} onCommit={(v) => commit({ cy: v })} />
      <NumberEditor label="Radius" value={node.r} min={0} onCommit={(v) => commit({ r: v })} />
    </>
  )
}

function EllipseGeometry({ node, commit }: { node: EllipseNode; commit: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <NumberEditor label="Center X" value={node.cx} onCommit={(v) => commit({ cx: v })} />
      <NumberEditor label="Center Y" value={node.cy} onCommit={(v) => commit({ cy: v })} />
      <NumberEditor label="Radius X" value={node.rx} min={0} onCommit={(v) => commit({ rx: v })} />
      <NumberEditor label="Radius Y" value={node.ry} min={0} onCommit={(v) => commit({ ry: v })} />
    </>
  )
}

function LineGeometry({ node, commit }: { node: LineNode; commit: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <NumberEditor label="X1" value={node.x1} onCommit={(v) => commit({ x1: v })} />
      <NumberEditor label="Y1" value={node.y1} onCommit={(v) => commit({ y1: v })} />
      <NumberEditor label="X2" value={node.x2} onCommit={(v) => commit({ x2: v })} />
      <NumberEditor label="Y2" value={node.y2} onCommit={(v) => commit({ y2: v })} />
    </>
  )
}

function PolyGeometry({ node }: { node: { points: Array<{ x: number; y: number }> } }) {
  return (
    <div style={S.row}>
      <span style={S.label}>Points</span>
      <span style={{ ...S.value, color: 'rgba(255,255,255,0.5)' }}>
        {node.points.length} pts (edit in source)
      </span>
    </div>
  )
}

function PathGeometry({ node }: { node: { d?: string } }) {
  const d = node.d ?? ''
  return (
    <div style={{ ...S.row, alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
      <span style={S.label}>Path data</span>
      <div
        style={{
          ...S.mono,
          fontSize: 10,
          color: 'rgba(255,255,255,0.5)',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 6,
          padding: '4px 8px',
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          maxHeight: 48,
          overflowY: 'auto'
        }}
      >
        {d.length > 200 ? d.slice(0, 200) + '…' : d || '—'}
      </div>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Edit path data in Source mode (Phase 14)</span>
    </div>
  )
}

function TextGeometry({ node, commit }: { node: TextNode; commit: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <NumberEditor label="X" value={node.x ?? 0} onCommit={(v) => commit({ x: v })} />
      <NumberEditor label="Y" value={node.y ?? 0} onCommit={(v) => commit({ y: v })} />
    </>
  )
}

function ImageGeometry({ node, commit }: { node: ImageNode; commit: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <NumberEditor label="X" value={node.x ?? 0} onCommit={(v) => commit({ x: v })} />
      <NumberEditor label="Y" value={node.y ?? 0} onCommit={(v) => commit({ y: v })} />
      <NumberEditor label="Width" value={node.width ?? 0} min={0} onCommit={(v) => commit({ width: v })} />
      <NumberEditor label="Height" value={node.height ?? 0} min={0} onCommit={(v) => commit({ height: v })} />
    </>
  )
}

function UseGeometry({ node, commit }: { node: UseNode; commit: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <NumberEditor label="X" value={node.x ?? 0} onCommit={(v) => commit({ x: v })} />
      <NumberEditor label="Y" value={node.y ?? 0} onCommit={(v) => commit({ y: v })} />
      {node.width !== undefined && (
        <NumberEditor label="Width" value={node.width} min={0} onCommit={(v) => commit({ width: v })} />
      )}
      {node.height !== undefined && (
        <NumberEditor label="Height" value={node.height} min={0} onCommit={(v) => commit({ height: v })} />
      )}
    </>
  )
}

function StarGeometry({ node, commit }: { node: StarNode; commit: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <NumberEditor label="Center X" value={node.cx} onCommit={(v) => commit({ cx: v })} />
      <NumberEditor label="Center Y" value={node.cy} onCommit={(v) => commit({ cy: v })} />
      <NumberEditor label="Outer radius" value={node.outerRadius} min={1} onCommit={(v) => commit({ outerRadius: v })} />
      <NumberEditor label="Inner radius" value={node.innerRadius} min={1} onCommit={(v) => commit({ innerRadius: v })} />
      <NumberEditor label="Points" value={node.numPoints} min={3} max={20} step={1} onCommit={(v) => commit({ numPoints: Math.round(v) })} />
    </>
  )
}
