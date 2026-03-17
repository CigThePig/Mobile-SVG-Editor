/**
 * IdentitySection.tsx
 *
 * Inspector section for node identity: name, type, ID, class, visibility, lock.
 */

import { useCallback } from 'react'
import { Eye, EyeOff, Lock, Unlock, Copy } from 'lucide-react'
import { runCommand } from '@/features/documents/services/commandRunner'
import type { SvgNode, SvgNodeType } from '@/model/nodes/nodeTypes'
import { S, AccordionSection, InlineInput } from '../inspectorShared'

// ─── Type category coloring ───────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  // Shapes
  rect: '#60a5fa',
  circle: '#60a5fa',
  ellipse: '#60a5fa',
  line: '#60a5fa',
  polyline: '#60a5fa',
  polygon: '#60a5fa',
  star: '#60a5fa',
  path: '#60a5fa',
  // Text
  text: '#a78bfa',
  tspan: '#a78bfa',
  textPath: '#a78bfa',
  // Container
  group: '#34d399',
  root: '#34d399',
  a: '#34d399',
  switch: '#34d399',
  // Structural / defs
  defs: '#f59e0b',
  symbol: '#f59e0b',
  use: '#f59e0b',
  clipPath: '#f59e0b',
  mask: '#f59e0b',
  marker: '#f59e0b',
  pattern: '#f59e0b',
  // Other
  image: '#fb923c',
  foreignObject: '#f87171',
  style: '#94a3b8'
}

function getTypeColor(type: SvgNodeType) {
  return TYPE_COLORS[type] ?? '#93c5fd'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IdentitySection({ node }: { node: SvgNode }) {
  const nodeId = node.id
  const typeColor = getTypeColor(node.type)

  const commitName = useCallback(
    (name: string) => {
      void runCommand('document.updateNodeProperties', { nodeId, properties: { name: name || undefined } })
    },
    [nodeId]
  )

  const commitClassName = useCallback(
    (className: string) => {
      void runCommand('document.updateNodeProperties', { nodeId, properties: { className: className || undefined } })
    },
    [nodeId]
  )

  const toggleVisibility = useCallback(() => {
    void runCommand('document.setNodeVisibility', { nodeId, visible: !node.visible })
  }, [nodeId, node.visible])

  const toggleLock = useCallback(() => {
    void runCommand('document.setNodeLocked', { nodeId, locked: !node.locked })
  }, [nodeId, node.locked])

  const copyId = useCallback(() => {
    void navigator.clipboard.writeText(node.id)
  }, [node.id])

  return (
    <AccordionSection title="Identity" defaultOpen>
      {/* Type badge */}
      <div style={S.row}>
        <span style={S.label}>Type</span>
        <span
          style={{
            ...S.badge,
            background: `${typeColor}22`,
            color: typeColor,
            fontSize: 11,
            padding: '2px 8px'
          }}
        >
          {node.type}
        </span>
      </div>

      {/* Name */}
      <InlineInput
        label="Name"
        value={node.name ?? ''}
        onCommit={commitName}
        placeholder="Unnamed"
      />

      {/* ID */}
      <div style={S.row}>
        <span style={S.label}>ID</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...S.value, ...S.mono, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            {node.id || '—'}
          </span>
          {node.id && (
            <button onClick={copyId} style={{ ...S.actionBtnSmall, padding: '2px 6px' }} title="Copy ID">
              <Copy size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Class */}
      <InlineInput
        label="Class"
        value={node.className ?? ''}
        onCommit={commitClassName}
        placeholder="none"
      />

      {/* Visibility toggle */}
      <button
        onClick={toggleVisibility}
        style={{ ...S.row, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
      >
        <span style={S.label}>Visibility</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: node.visible ? '#93c5fd' : 'rgba(255,255,255,0.4)' }}>
          {node.visible ? <Eye size={13} /> : <EyeOff size={13} />}
          {node.visible ? 'Visible' : 'Hidden'}
        </span>
      </button>

      {/* Lock toggle */}
      <button
        onClick={toggleLock}
        style={{ ...S.row, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
      >
        <span style={S.label}>Lock</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: node.locked ? '#93c5fd' : 'rgba(255,255,255,0.4)' }}>
          {node.locked ? <Lock size={13} /> : <Unlock size={13} />}
          {node.locked ? 'Locked' : 'Unlocked'}
        </span>
      </button>

      {/* Editability tier badge from preservation */}
      {node.preservation && (
        <div style={S.row}>
          <span style={S.label}>Edit tier</span>
          <EditabilityBadge level={node.preservation.editabilityLevel} />
        </div>
      )}
    </AccordionSection>
  )
}

function EditabilityBadge({ level }: { level: 1 | 2 | 3 | 4 }) {
  const info: Record<number, { label: string; color: string }> = {
    1: { label: 'Full', color: '#4ade80' },
    2: { label: 'Partial', color: '#facc15' },
    3: { label: 'Source only', color: '#fb923c' },
    4: { label: 'Display only', color: '#f87171' }
  }
  const { label, color } = info[level] ?? info[4]
  return (
    <span
      style={{
        ...S.badge,
        background: `${color}22`,
        color,
        fontSize: 10
      }}
    >
      {label}
    </span>
  )
}
