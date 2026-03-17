/**
 * inspectorShared.tsx
 *
 * Shared style tokens and primitive UI components for all inspector sections.
 * All inspector section files import from this module to maintain a consistent look.
 */

import { useState, useCallback } from 'react'

// ─── Style tokens ─────────────────────────────────────────────────────────────

export const S = {
  sectionHeader: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 4,
    marginTop: 12
  } as React.CSSProperties,

  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    minHeight: 36,
    gap: 8
  } as React.CSSProperties,

  label: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    flexShrink: 0,
    minWidth: 80
  } as React.CSSProperties,

  value: {
    fontSize: 12,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.9)',
    fontVariantNumeric: 'tabular-nums' as const,
    textAlign: 'right' as const
  } as React.CSSProperties,

  accent: {
    color: '#93c5fd'
  } as React.CSSProperties,

  input: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    padding: '4px 8px',
    fontVariantNumeric: 'tabular-nums' as const,
    width: 80,
    textAlign: 'right' as const,
    outline: 'none'
  } as React.CSSProperties,

  inputFull: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    padding: '4px 8px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const
  } as React.CSSProperties,

  select: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    padding: '4px 6px',
    outline: 'none'
  } as React.CSSProperties,

  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    cursor: 'pointer',
    flexShrink: 0
  } as React.CSSProperties,

  actionBtnDanger: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 8,
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.25)',
    color: 'rgba(252,165,165,0.9)',
    fontSize: 12,
    cursor: 'pointer',
    flexShrink: 0
  } as React.CSSProperties,

  actionBtnSmall: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    padding: '3px 8px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    cursor: 'pointer',
    flexShrink: 0
  } as React.CSSProperties,

  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 7px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.04em',
    background: 'rgba(147,197,253,0.15)',
    color: '#93c5fd'
  } as React.CSSProperties,

  mono: {
    fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace",
    fontSize: 11
  } as React.CSSProperties,

  accordionItem: {
    borderBottom: '1px solid rgba(255,255,255,0.06)'
  } as React.CSSProperties,

  accordionTrigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '10px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: 600
  } as React.CSSProperties,

  accordionContent: {
    paddingBottom: 8
  } as React.CSSProperties
}

// ─── Primitive components ─────────────────────────────────────────────────────

export function SectionHeader({ label }: { label: string }) {
  return <div style={S.sectionHeader}>{label}</div>
}

export function PropRow({
  label,
  value,
  accent
}: {
  label: string
  value: React.ReactNode
  accent?: boolean
}) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <span style={{ ...S.value, ...(accent ? S.accent : {}) }}>{value}</span>
    </div>
  )
}

export function SelectRow({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
}) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <select
        value={value}
        style={S.select}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function NumberEditor({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
  wide
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onCommit: (v: number) => void
  wide?: boolean
}) {
  const [local, setLocal] = useState<string | null>(null)
  const displayed = local !== null ? local : String(Math.round(value * 1000) / 1000)

  const commit = (raw: string) => {
    setLocal(null)
    const parsed = parseFloat(raw)
    if (!isNaN(parsed)) {
      const clamped =
        min !== undefined
          ? Math.max(min, max !== undefined ? Math.min(max, parsed) : parsed)
          : parsed
      onCommit(clamped)
    }
  }

  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <input
        type="number"
        value={displayed}
        min={min}
        max={max}
        step={step}
        style={wide ? { ...S.input, width: 120 } : S.input}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
    </div>
  )
}

export function ColorEditor({
  label,
  color,
  onChange
}: {
  label: string
  color: string
  onChange: (color: string) => void
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value)
    },
    [onChange]
  )

  const safeColor = color.startsWith('#') ? color : '#000000'

  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            background: color,
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'inline-block',
            flexShrink: 0
          }}
        />
        <span style={{ ...S.value, fontSize: 11, ...S.mono }}>{color}</span>
        <input
          type="color"
          value={safeColor}
          onChange={handleChange}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          tabIndex={-1}
        />
      </label>
    </div>
  )
}

export function TextareaEditor({
  label,
  value,
  onCommit,
  rows = 3
}: {
  label: string
  value: string
  onCommit: (v: string) => void
  rows?: number
}) {
  const [local, setLocal] = useState<string | null>(null)
  const displayed = local !== null ? local : value

  return (
    <div style={{ ...S.row, alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
      <span style={S.label}>{label}</span>
      <textarea
        value={displayed}
        rows={rows}
        style={{
          ...S.inputFull,
          resize: 'vertical',
          fontFamily: 'inherit'
        }}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => {
          onCommit(e.target.value)
          setLocal(null)
        }}
      />
    </div>
  )
}

export function InlineInput({
  label,
  value,
  onCommit,
  placeholder,
  mono
}: {
  label: string
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  const [local, setLocal] = useState<string | null>(null)
  const displayed = local !== null ? local : value

  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <input
        type="text"
        value={displayed}
        placeholder={placeholder ?? '—'}
        style={{
          ...S.input,
          width: 140,
          textAlign: 'left',
          ...(mono ? S.mono : {})
        }}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => {
          onCommit(e.target.value)
          setLocal(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setLocal(null)
            e.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}

export function GeometryGrid({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const cell = (label: string, val: string): React.ReactNode => (
    <div
      key={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: '6px 4px'
      }}
    >
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', marginBottom: 2 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums' }}>
        {val}
      </span>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
      {cell('X', String(Math.round(x)))}
      {cell('Y', String(Math.round(y)))}
      {cell('W', String(Math.round(w)))}
      {cell('H', String(Math.round(h)))}
    </div>
  )
}

// ─── Accordion primitives (no Radix dep — simple CSS) ────────────────────────

export function AccordionSection({
  title,
  defaultOpen = false,
  badge,
  children
}: {
  title: string
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={S.accordionItem}>
      <button
        style={S.accordionTrigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {title}
          {badge}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.3)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s'
          }}
        >
          ▾
        </span>
      </button>
      {open && <div style={S.accordionContent}>{children}</div>}
    </div>
  )
}

export function CountBadge({ count, color = '#93c5fd' }: { count: number; color?: string }) {
  if (count === 0) return null
  return (
    <span
      style={{
        ...S.badge,
        background: `${color}22`,
        color,
        fontSize: 10,
        padding: '1px 6px'
      }}
    >
      {count}
    </span>
  )
}
