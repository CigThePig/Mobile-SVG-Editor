/**
 * AttributesSection.tsx
 *
 * Inspector section for all node attributes:
 * - Accessibility (aria-*, role, tabindex)
 * - Data attributes (data-*)
 * - Advanced SVG attributes (any other key in node.attributes)
 * - Raw preserved attributes from import (node.preservation.rawAttributes — read-only)
 */

import { useState, useCallback } from 'react'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { runCommand } from '@/features/documents/services/commandRunner'
import type { SvgNode } from '@/model/nodes/nodeTypes'
import { S, AccordionSection, CountBadge } from '../inspectorShared'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function partitionAttributes(attrs: Record<string, string>) {
  const aria: Record<string, string> = {}
  const data: Record<string, string> = {}
  const advanced: Record<string, string> = {}

  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('aria-') || k === 'role' || k === 'tabindex') {
      aria[k] = v
    } else if (k.startsWith('data-')) {
      data[k] = v
    } else {
      advanced[k] = v
    }
  }

  return { aria, data, advanced }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AttributesSection({ node }: { node: SvgNode }) {
  const nodeId = node.id
  const attrs = node.attributes ?? {}
  const rawAttrs = node.preservation?.rawAttributes ?? {}
  const { aria, data, advanced } = partitionAttributes(attrs)

  const totalCount = Object.keys(attrs).length + Object.keys(rawAttrs).length

  const updateAttributes = useCallback(
    (newAttrs: Record<string, string>) => {
      void runCommand('document.updateNodeAttributes', { nodeId, attributes: newAttrs })
    },
    [nodeId]
  )

  const setAttr = (key: string, value: string) => {
    updateAttributes({ ...attrs, [key]: value })
  }

  const removeAttr = (key: string) => {
    const next = { ...attrs }
    delete next[key]
    updateAttributes(next)
  }

  const addAttr = (key: string, value: string) => {
    if (key) {
      updateAttributes({ ...attrs, [key]: value })
    }
  }

  return (
    <AccordionSection
      title="Attributes"
      badge={totalCount > 0 ? <CountBadge count={totalCount} color="#94a3b8" /> : undefined}
    >
      {/* Accessibility */}
      <SubSection
        title="Accessibility"
        attrs={aria}
        onSet={setAttr}
        onRemove={removeAttr}
        onAdd={addAttr}
        addKeyPlaceholder="aria-label"
        suggestions={['aria-label', 'aria-hidden', 'aria-describedby', 'role', 'tabindex']}
      />

      {/* Data attributes */}
      <SubSection
        title="Data attributes"
        attrs={data}
        onSet={setAttr}
        onRemove={removeAttr}
        onAdd={(k, v) => addAttr(k.startsWith('data-') ? k : `data-${k}`, v)}
        addKeyPlaceholder="data-name"
      />

      {/* Advanced SVG attributes */}
      {Object.keys(advanced).length > 0 && (
        <SubSection
          title="Advanced"
          attrs={advanced}
          onSet={setAttr}
          onRemove={removeAttr}
          onAdd={addAttr}
          addKeyPlaceholder="attribute-name"
        />
      )}

      {/* Raw preserved attributes (read-only) */}
      {Object.keys(rawAttrs).length > 0 && (
        <RawAttributesDisplay node={node} rawAttrs={rawAttrs} />
      )}

      {totalCount === 0 && (
        <div style={{ paddingBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            No custom attributes. Add accessibility, data, or SVG attributes above.
          </span>
        </div>
      )}
    </AccordionSection>
  )
}

// ─── SubSection ───────────────────────────────────────────────────────────────

function SubSection({
  title,
  attrs,
  onSet,
  onRemove,
  onAdd,
  addKeyPlaceholder,
  suggestions
}: {
  title: string
  attrs: Record<string, string>
  onSet: (k: string, v: string) => void
  onRemove: (k: string) => void
  onAdd: (k: string, v: string) => void
  addKeyPlaceholder: string
  suggestions?: string[]
}) {
  const [adding, setAdding] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')

  const entries = Object.entries(attrs)
  if (entries.length === 0 && !adding) {
    return (
      <div style={{ paddingTop: 6 }}>
        <div style={{ ...S.sectionHeader, marginTop: 4 }}>{title}</div>
        <button onClick={() => setAdding(true)} style={{ ...S.actionBtnSmall, marginTop: 2 }}>
          <Plus size={10} /> Add {title}
        </button>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 6 }}>
      <div style={{ ...S.sectionHeader, marginTop: 4 }}>{title}</div>

      {entries.map(([k, v]) => (
        <AttrRow
          key={k}
          attrKey={k}
          attrValue={v}
          onSet={onSet}
          onRemove={onRemove}
        />
      ))}

      {adding ? (
        <AddAttrRow
          keyPlaceholder={addKeyPlaceholder}
          newKey={newKey}
          newVal={newVal}
          onKeyChange={setNewKey}
          onValChange={setNewVal}
          suggestions={suggestions}
          onCommit={() => {
            onAdd(newKey, newVal)
            setNewKey('')
            setNewVal('')
            setAdding(false)
          }}
          onCancel={() => {
            setNewKey('')
            setNewVal('')
            setAdding(false)
          }}
        />
      ) : (
        <button onClick={() => setAdding(true)} style={{ ...S.actionBtnSmall, marginTop: 4 }}>
          <Plus size={10} /> Add
        </button>
      )}
    </div>
  )
}

// ─── AttrRow ─────────────────────────────────────────────────────────────────

function AttrRow({
  attrKey,
  attrValue,
  onSet,
  onRemove
}: {
  attrKey: string
  attrValue: string
  onSet: (k: string, v: string) => void
  onRemove: (k: string) => void
}) {
  const [localVal, setLocalVal] = useState<string | null>(null)
  const displayed = localVal !== null ? localVal : attrValue

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)'
      }}
    >
      <span
        style={{
          ...S.mono,
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
          flexShrink: 0,
          minWidth: 90,
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {attrKey}
      </span>
      <input
        type="text"
        value={displayed}
        style={{ ...S.input, flex: 1, width: 'auto', textAlign: 'left', ...S.mono, fontSize: 11 }}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={(e) => {
          onSet(attrKey, e.target.value)
          setLocalVal(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setLocalVal(null)
        }}
      />
      <button
        onClick={() => onRemove(attrKey)}
        style={{
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          background: 'rgba(239,68,68,0.1)',
          border: 'none',
          color: 'rgba(252,165,165,0.7)',
          cursor: 'pointer',
          flexShrink: 0
        }}
        title={`Remove ${attrKey}`}
      >
        <Trash2 size={10} />
      </button>
    </div>
  )
}

// ─── AddAttrRow ───────────────────────────────────────────────────────────────

function AddAttrRow({
  keyPlaceholder,
  newKey,
  newVal,
  onKeyChange,
  onValChange,
  suggestions,
  onCommit,
  onCancel
}: {
  keyPlaceholder: string
  newKey: string
  newVal: string
  onKeyChange: (v: string) => void
  onValChange: (v: string) => void
  suggestions?: string[]
  onCommit: () => void
  onCancel: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6 }}>
      {suggestions ? (
        <select
          value={newKey}
          style={{ ...S.select, width: '100%' }}
          onChange={(e) => onKeyChange(e.target.value)}
        >
          <option value="">— Select attribute —</option>
          {suggestions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          <option value="__custom__">Custom…</option>
        </select>
      ) : (
        <input
          type="text"
          value={newKey}
          placeholder={keyPlaceholder}
          style={{ ...S.inputFull, ...S.mono, fontSize: 11 }}
          onChange={(e) => onKeyChange(e.target.value)}
        />
      )}
      {(newKey === '__custom__' || !suggestions) && (
        <input
          type="text"
          value={newKey === '__custom__' ? '' : newKey}
          placeholder="attribute-name"
          style={{ ...S.inputFull, ...S.mono, fontSize: 11 }}
          onChange={(e) => onKeyChange(e.target.value)}
        />
      )}
      <input
        type="text"
        value={newVal}
        placeholder="value"
        style={{ ...S.inputFull, ...S.mono, fontSize: 11 }}
        onChange={(e) => onValChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit()
          if (e.key === 'Escape') onCancel()
        }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onCommit} style={S.actionBtnSmall}>Add</button>
        <button onClick={onCancel} style={S.actionBtnSmall}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Raw attributes (read-only from import) ────────────────────────────────────

function RawAttributesDisplay({
  node,
  rawAttrs
}: {
  node: SvgNode
  rawAttrs: Record<string, string>
}) {
  const preservation = node.preservation!
  const tierInfo: Record<number, string> = {
    1: 'Full editing',
    2: 'Partial editing',
    3: 'Source mode only',
    4: 'Display only'
  }
  const tierColor: Record<number, string> = {
    1: '#4ade80',
    2: '#facc15',
    3: '#fb923c',
    4: '#f87171'
  }
  const tier = preservation.editabilityLevel
  const diagCount = preservation.importDiagnosticIds?.length ?? 0

  return (
    <div style={{ paddingTop: 8 }}>
      <div
        style={{
          ...S.sectionHeader,
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        <AlertTriangle size={10} style={{ color: '#fb923c' }} />
        Raw preserved attributes
      </div>

      {/* Preservation metadata */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <span
          style={{
            ...S.badge,
            background: `${tierColor[tier]}22`,
            color: tierColor[tier]
          }}
        >
          {tierInfo[tier]}
        </span>
        {preservation.sourceElementName && (
          <span style={{ ...S.badge, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
            &lt;{preservation.sourceElementName}&gt;
          </span>
        )}
        {diagCount > 0 && (
          <span style={{ ...S.badge, background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
            {diagCount} warning{diagCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Raw attribute list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.entries(rawAttrs).map(([k, v]) => (
          <div
            key={k}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              padding: '3px 6px',
              background: 'rgba(251,146,60,0.06)',
              borderRadius: 5,
              border: '1px solid rgba(251,146,60,0.12)'
            }}
          >
            <span style={{ ...S.mono, fontSize: 10, color: '#fb923c', flexShrink: 0, minWidth: 80 }}>
              {k}
            </span>
            <span style={{ ...S.mono, fontSize: 10, color: 'rgba(255,255,255,0.5)', wordBreak: 'break-all' }}>
              {v.length > 60 ? v.slice(0, 60) + '…' : v}
            </span>
          </div>
        ))}
      </div>

      {preservation.sourceOffset !== undefined && (
        <div style={{ marginTop: 6 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            Source offset: {preservation.sourceOffset}
          </span>
        </div>
      )}

      <div style={{ marginTop: 4 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
          These attributes were preserved from import but are not yet editable in visual mode.
          Edit them in Source mode.
        </span>
      </div>
    </div>
  )
}
