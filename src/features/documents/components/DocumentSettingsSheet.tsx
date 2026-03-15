import { useState } from 'react'
import { Drawer } from 'vaul'
import { useEditorStore } from '@/stores/editorStore'
import { saveDocument } from '@/db/dexie/queries'
import type { SvgDocument, BackgroundModel } from '@/model/document/documentTypes'

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
  label: { fontSize: 12, color: 'rgba(255,255,255,0.5)', flexShrink: 0, minWidth: 80 } as React.CSSProperties,
  input: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, color: 'rgba(255,255,255,0.9)', fontSize: 12,
    padding: '4px 8px', fontVariantNumeric: 'tabular-nums' as const,
    width: 80, textAlign: 'right' as const, outline: 'none'
  } as React.CSSProperties,
  select: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, color: 'rgba(255,255,255,0.9)', fontSize: 12,
    padding: '4px 6px', outline: 'none'
  } as React.CSSProperties,
}

function SectionHeader({ label }: { label: string }) {
  return <div style={S.sectionHeader}>{label}</div>
}

function NumberField({ label, value, min, onCommit }: { label: string; value: number; min?: number; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState<string | null>(null)
  const displayed = local !== null ? local : String(Math.round(value))
  const commit = (raw: string) => {
    setLocal(null)
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && parsed >= (min ?? 0)) onCommit(parsed)
  }
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <input
        type="number"
        value={displayed}
        min={min}
        style={S.input}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
    </div>
  )
}

function TextField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState<string | null>(null)
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <input
        type="text"
        value={local !== null ? local : value}
        style={{ ...S.input, width: 160, textAlign: 'left' }}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => { onCommit(e.target.value); setLocal(null) }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
    </div>
  )
}

function TextAreaField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState<string | null>(null)
  return (
    <div style={{ ...S.row, alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
      <span style={S.label}>{label}</span>
      <textarea
        value={local !== null ? local : value}
        rows={2}
        style={{ ...S.input, width: '100%', resize: 'vertical', textAlign: 'left', fontFamily: 'inherit', boxSizing: 'border-box' }}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => { onCommit(e.target.value); setLocal(null) }}
      />
    </div>
  )
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DocumentSettingsSheet({ open, onOpenChange }: Props) {
  const activeDocument = useEditorStore((s) => s.activeDocument)
  const replaceDocument = useEditorStore((s) => s.replaceDocument)

  const update = (patch: Partial<SvgDocument>) => {
    const next = { ...activeDocument, ...patch, updatedAt: new Date().toISOString() }
    replaceDocument(next)
    void saveDocument(next)
  }

  const bg = activeDocument.background
  const solidColor = bg.type === 'solid' ? bg.color : '#ffffff'

  const handleBgTypeChange = (type: 'transparent' | 'solid') => {
    const background: BackgroundModel = type === 'solid' ? { type: 'solid', color: solidColor } : { type: 'transparent' }
    update({ background })
  }

  const handleBgColorChange = (color: string) => {
    update({ background: { type: 'solid', color } })
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
        <Drawer.Content
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            maxHeight: '80dvh',
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            background: 'rgba(18,18,18,0.98)', backdropFilter: 'blur(16px)',
            paddingBottom: 'calc(var(--sai-bottom, 0px) + 8px)',
            zIndex: 50, display: 'flex', flexDirection: 'column', outline: 'none',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.5)'
          }}
        >
          <Drawer.Handle style={{ background: 'rgba(255,255,255,0.2)', marginTop: 8 }} />
          <div style={{ padding: '12px 16px 8px', fontSize: 15, fontWeight: 700, color: '#fff' }}>Document Settings</div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px' }}>

            <SectionHeader label="Document" />
            <TextField
              label="Title"
              value={activeDocument.title}
              onCommit={(v) => update({ title: v || 'Untitled SVG' })}
            />

            <SectionHeader label="Canvas Size" />
            <NumberField label="Width" value={activeDocument.width} min={1}
              onCommit={(v) => update({ width: v, viewBox: { ...activeDocument.viewBox, width: v } })} />
            <NumberField label="Height" value={activeDocument.height} min={1}
              onCommit={(v) => update({ height: v, viewBox: { ...activeDocument.viewBox, height: v } })} />

            <SectionHeader label="Background" />
            <div style={S.row}>
              <span style={S.label}>Type</span>
              <select
                value={bg.type}
                style={S.select}
                onChange={(e) => handleBgTypeChange(e.target.value as 'transparent' | 'solid')}
              >
                <option value="transparent">Transparent</option>
                <option value="solid">Solid color</option>
              </select>
            </div>
            {bg.type === 'solid' && (
              <div style={S.row}>
                <span style={S.label}>Color</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 4, background: bg.color, border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block' }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{bg.color}</span>
                  <input
                    type="color"
                    value={bg.color}
                    onChange={(e) => handleBgColorChange(e.target.value)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                    tabIndex={-1}
                  />
                </label>
              </div>
            )}

            <SectionHeader label="Metadata" />
            <TextAreaField
              label="Description"
              value={activeDocument.metadata?.description ?? ''}
              onCommit={(v) => update({ metadata: { ...activeDocument.metadata, description: v } })}
            />
            <TextField
              label="Author"
              value={activeDocument.metadata?.author ?? ''}
              onCommit={(v) => update({ metadata: { ...activeDocument.metadata, author: v } })}
            />

            <div style={{ height: 16 }} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
