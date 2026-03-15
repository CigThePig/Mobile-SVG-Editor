import { useState } from 'react'
import { Drawer } from 'vaul'
import { Plus, Trash2, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { runCommand } from '@/features/documents/services/commandRunner'
import type { GradientResource, GradientStop } from '@/model/resources/resourceTypes'

const S = {
  sectionHeader: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 4, marginTop: 12
  } as React.CSSProperties,
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
    minHeight: 36, gap: 8
  } as React.CSSProperties,
  label: { fontSize: 12, color: 'rgba(255,255,255,0.5)', flexShrink: 0, minWidth: 64 } as React.CSSProperties,
  input: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, color: 'rgba(255,255,255,0.9)', fontSize: 12,
    padding: '4px 8px', outline: 'none', fontVariantNumeric: 'tabular-nums' as const,
    width: 64, textAlign: 'right' as const
  } as React.CSSProperties,
  select: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, color: 'rgba(255,255,255,0.9)', fontSize: 12,
    padding: '4px 6px', outline: 'none'
  } as React.CSSProperties,
  btn: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 8,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.9)', fontSize: 12, cursor: 'pointer', flexShrink: 0
  } as React.CSSProperties
}

function GradientStopEditor({
  stop,
  onUpdate,
  onDelete,
  canDelete
}: {
  stop: GradientStop
  onUpdate: (patch: Partial<GradientStop>) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const [localOffset, setLocalOffset] = useState<string | null>(null)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      {/* Color swatch */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <span
          style={{
            width: 22, height: 22, borderRadius: 4,
            background: stop.color,
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'inline-block', flexShrink: 0
          }}
        />
        <input
          type="color"
          value={stop.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          tabIndex={-1}
        />
      </label>

      {/* Offset */}
      <span style={S.label}>At</span>
      <input
        type="number"
        value={localOffset !== null ? localOffset : Math.round(stop.offset * 100)}
        min={0} max={100} step={1}
        style={{ ...S.input, width: 52 }}
        onChange={(e) => setLocalOffset(e.target.value)}
        onBlur={(e) => {
          setLocalOffset(null)
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onUpdate({ offset: Math.min(1, Math.max(0, v / 100)) })
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>%</span>

      {/* Opacity */}
      <input
        type="range"
        min={0} max={1} step={0.01}
        value={stop.opacity ?? 1}
        onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
        style={{ flex: 1, accentColor: '#3b82f6' }}
      />

      {/* Delete */}
      {canDelete && (
        <button
          onClick={onDelete}
          style={{ ...S.btn, padding: '4px 6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(252,165,165,0.8)' }}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  )
}

function GradientCard({
  gradient,
  selectedNodeIds
}: {
  gradient: GradientResource
  selectedNodeIds: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [applied, setApplied] = useState(false)

  const updateStops = (stops: GradientStop[]) => {
    void runCommand('document.updateGradient', { id: gradient.id, stops })
  }

  const handleStopUpdate = (index: number, patch: Partial<GradientStop>) => {
    const next = gradient.stops.map((s, i) => (i === index ? { ...s, ...patch } : s))
    updateStops(next)
  }

  const handleAddStop = () => {
    const midOffset = gradient.stops.length >= 2 ? 0.5 : 1
    const next = [...gradient.stops, { offset: midOffset, color: '#888888', opacity: 1 }]
      .sort((a, b) => a.offset - b.offset)
    updateStops(next)
  }

  const handleDeleteStop = (index: number) => {
    const next = gradient.stops.filter((_, i) => i !== index)
    updateStops(next)
  }

  const handleApply = async () => {
    for (const id of selectedNodeIds) {
      await runCommand('document.applyGradientToNode', { nodeId: id, gradientId: gradient.id })
    }
    setApplied(true)
    setTimeout(() => setApplied(false), 1500)
  }

  // Preview strip
  const stopStr = gradient.stops
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.color} ${(s.offset * 100).toFixed(0)}%`)
    .join(', ')
  const gradientCSS = `linear-gradient(to right, ${stopStr})`

  return (
    <div
      style={{
        marginBottom: 8,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden'
      }}
    >
      {/* Header row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Color preview */}
        <div style={{ width: 36, height: 20, borderRadius: 4, background: gradientCSS, flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {gradient.name || gradient.type}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            {gradient.type === 'linearGradient' ? 'Linear' : 'Radial'} · {gradient.stops.length} stops
          </div>
        </div>
        {selectedNodeIds.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); void handleApply() }}
            style={{ ...S.btn, background: applied ? 'rgba(74,222,128,0.15)' : 'rgba(96,165,250,0.15)', border: `1px solid ${applied ? 'rgba(74,222,128,0.3)' : 'rgba(96,165,250,0.25)'}`, color: applied ? '#4ade80' : '#93c5fd', fontSize: 11, padding: '4px 8px' }}
          >
            {applied ? <Check size={11} /> : null}
            {applied ? 'Applied' : 'Apply'}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            void runCommand('document.deleteGradient', { id: gradient.id })
          }}
          style={{ ...S.btn, padding: '4px 6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(252,165,165,0.8)' }}
        >
          <Trash2 size={11} />
        </button>
        {expanded ? <ChevronDown size={14} color="rgba(255,255,255,0.3)" /> : <ChevronRight size={14} color="rgba(255,255,255,0.3)" />}
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Name + type */}
          <div style={{ ...S.row, marginTop: 6 }}>
            <span style={S.label}>Name</span>
            <input
              type="text"
              value={gradient.name ?? ''}
              style={{ ...S.input, width: 140, textAlign: 'left' }}
              onChange={(e) => void runCommand('document.updateGradient', { id: gradient.id, name: e.target.value })}
            />
          </div>
          <div style={S.row}>
            <span style={S.label}>Type</span>
            <select
              value={gradient.type}
              style={S.select}
              onChange={(e) => void runCommand('document.updateGradient', { id: gradient.id, type: e.target.value as 'linearGradient' | 'radialGradient' })}
            >
              <option value="linearGradient">Linear</option>
              <option value="radialGradient">Radial</option>
            </select>
          </div>

          {/* Stops */}
          <div style={{ ...S.sectionHeader, marginTop: 8 }}>Stops</div>
          {gradient.stops.map((stop, i) => (
            <GradientStopEditor
              key={i}
              stop={stop}
              onUpdate={(patch) => handleStopUpdate(i, patch)}
              onDelete={() => handleDeleteStop(i)}
              canDelete={gradient.stops.length > 2}
            />
          ))}
          <button onClick={handleAddStop} style={{ ...S.btn, marginTop: 8, fontSize: 11 }}>
            <Plus size={11} />
            Add Stop
          </button>
        </div>
      )}
    </div>
  )
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GradientEditorSheet({ open, onOpenChange }: Props) {
  const gradients = useEditorStore((s) => s.activeDocument.resources.gradients)
  const selectedNodeIds = useEditorStore((s) => s.selection.selectedNodeIds)

  const handleAdd = (type: 'linearGradient' | 'radialGradient') => {
    void runCommand('document.addGradient', { type })
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
        <Drawer.Content
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            maxHeight: '82dvh',
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            background: 'rgba(18,18,18,0.98)', backdropFilter: 'blur(16px)',
            paddingBottom: 'calc(var(--sai-bottom, 0px) + 8px)',
            zIndex: 50, display: 'flex', flexDirection: 'column', outline: 'none',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.5)'
          }}
        >
          <Drawer.Handle style={{ background: 'rgba(255,255,255,0.2)', marginTop: 8 }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 8px', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Gradients</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleAdd('linearGradient')} style={{ ...S.btn, color: '#93c5fd', border: '1px solid rgba(96,165,250,0.25)', background: 'rgba(96,165,250,0.12)' }}>
                <Plus size={12} />
                Linear
              </button>
              <button onClick={() => handleAdd('radialGradient')} style={{ ...S.btn, color: '#c4b5fd', border: '1px solid rgba(196,181,253,0.25)', background: 'rgba(196,181,253,0.1)' }}>
                <Plus size={12} />
                Radial
              </button>
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 16px' }}>
            {gradients.length === 0 && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: '20px 0', textAlign: 'center' }}>
                No gradients yet. Add one above.
              </div>
            )}
            {gradients.map((g) => (
              <GradientCard key={g.id} gradient={g} selectedNodeIds={selectedNodeIds} />
            ))}
            {selectedNodeIds.length > 0 && gradients.length > 0 && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingBottom: 8 }}>
                Tap Apply on any gradient to apply it to {selectedNodeIds.length === 1 ? 'the selected object' : `${selectedNodeIds.length} selected objects`}.
              </div>
            )}
            <div style={{ height: 16 }} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
