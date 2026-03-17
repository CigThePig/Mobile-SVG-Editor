/**
 * StrokeSection.tsx
 *
 * Inspector section for full stroke editing: color, width, opacity, lineCap, lineJoin,
 * miterLimit, dashArray, dashOffset.
 */

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { runCommand } from '@/features/documents/services/commandRunner'
import type { SvgNode, AppearanceModel, StrokeModel } from '@/model/nodes/nodeTypes'
import { S, AccordionSection, ColorEditor, NumberEditor, SelectRow } from '../inspectorShared'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStyle(node: SvgNode): AppearanceModel {
  return (node as { style?: AppearanceModel }).style ?? {}
}

function formatDashArray(arr: number[] | undefined): string {
  if (!arr || arr.length === 0) return ''
  return arr.join(' ')
}

function parseDashArray(s: string): number[] | undefined {
  const trimmed = s.trim()
  if (!trimmed) return undefined
  const parts = trimmed.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n) && n >= 0)
  return parts.length > 0 ? parts : undefined
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StrokeSection({ node }: { node: SvgNode }) {
  const nodeId = node.id
  const style = getStyle(node)
  const stroke = style.stroke

  // Guard: only render for nodes that have a style property
  const styleNodeTypes = new Set(['group', 'rect', 'circle', 'ellipse', 'line', 'polyline',
    'polygon', 'star', 'path', 'text', 'tspan', 'textPath', 'image', 'symbol', 'use', 'marker', 'a'])
  if (!styleNodeTypes.has(node.type)) return null

  const updateStroke = useCallback(
    (patch: Partial<StrokeModel>) => {
      const existing = style.stroke ?? { width: 1, color: '#000000' }
      void runCommand('document.updateNodeStroke', { nodeId, stroke: { ...existing, ...patch } })
    },
    [nodeId, style.stroke]
  )

  const addStroke = () => {
    void runCommand('document.updateNodeStroke', { nodeId, stroke: { width: 1, color: '#000000' } })
  }

  const removeStroke = () => {
    void runCommand('document.updateNodeStyle', { nodeId, style: { stroke: undefined } })
  }

  if (!stroke) {
    return (
      <AccordionSection title="Stroke">
        <button onClick={addStroke} style={{ ...S.actionBtn, marginTop: 4 }}>
          <Plus size={12} /> Add Stroke
        </button>
      </AccordionSection>
    )
  }

  return (
    <AccordionSection title="Stroke" defaultOpen>
      <ColorEditor
        label="Color"
        color={stroke.color ?? '#000000'}
        onChange={(color) => updateStroke({ color })}
      />

      <NumberEditor
        label="Width"
        value={stroke.width}
        min={0}
        max={500}
        step={0.5}
        onCommit={(width) => updateStroke({ width })}
      />

      <NumberEditor
        label="Opacity %"
        value={stroke.opacity !== undefined ? Math.round(stroke.opacity * 100) : 100}
        min={0}
        max={100}
        onCommit={(pct) => updateStroke({ opacity: pct / 100 })}
      />

      <SelectRow
        label="Line cap"
        value={stroke.lineCap ?? 'butt'}
        options={[
          { value: 'butt', label: 'Butt' },
          { value: 'round', label: 'Round' },
          { value: 'square', label: 'Square' }
        ]}
        onChange={(lineCap) => updateStroke({ lineCap: lineCap as StrokeModel['lineCap'] })}
      />

      <SelectRow
        label="Line join"
        value={stroke.lineJoin ?? 'miter'}
        options={[
          { value: 'miter', label: 'Miter' },
          { value: 'round', label: 'Round' },
          { value: 'bevel', label: 'Bevel' }
        ]}
        onChange={(lineJoin) => updateStroke({ lineJoin: lineJoin as StrokeModel['lineJoin'] })}
      />

      {stroke.lineJoin === 'miter' && (
        <NumberEditor
          label="Miter limit"
          value={stroke.miterLimit ?? 4}
          min={1}
          step={0.5}
          onCommit={(miterLimit) => updateStroke({ miterLimit })}
        />
      )}

      <DashArrayEditor
        value={formatDashArray(stroke.dashArray)}
        onCommit={(val) => updateStroke({ dashArray: parseDashArray(val) })}
      />

      {stroke.dashArray && stroke.dashArray.length > 0 && (
        <NumberEditor
          label="Dash offset"
          value={stroke.dashOffset ?? 0}
          onCommit={(dashOffset) => updateStroke({ dashOffset })}
        />
      )}

      <div style={{ paddingTop: 4 }}>
        <button onClick={removeStroke} style={S.actionBtnDanger}>
          Remove Stroke
        </button>
      </div>
    </AccordionSection>
  )
}

function DashArrayEditor({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState<string | null>(null)
  const displayed = local !== null ? local : value

  return (
    <div style={S.row}>
      <span style={S.label}>Dash array</span>
      <input
        type="text"
        value={displayed}
        placeholder='e.g. "5 3 2"'
        style={{ ...S.input, width: 120, textAlign: 'left', ...S.mono }}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => {
          onCommit(e.target.value)
          setLocal(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
    </div>
  )
}
