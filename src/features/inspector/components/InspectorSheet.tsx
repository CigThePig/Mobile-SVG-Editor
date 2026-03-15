import { useState, useCallback } from 'react'
import { Drawer } from 'vaul'
import { Lock, Unlock, Layers, Eye, EyeOff, Trash2, Copy, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown } from 'lucide-react'
import { combineBounds, getNodeBounds } from '@/features/selection/utils/nodeBounds'
import { getNodeById } from '@/features/documents/utils/documentMutations'
import { runCommand } from '@/features/documents/services/commandRunner'
import { useEditorStore } from '@/stores/editorStore'
import type { AppearanceModel, EllipseNode, RectNode, StarNode, SvgNode, TextNode } from '@/model/nodes/nodeTypes'

// ─── Style Helpers ────────────────────────────────────────────────────────────

function getNodeStyle(node: SvgNode): AppearanceModel {
  return (node as { style?: AppearanceModel }).style ?? {}
}

function getFillColor(node: SvgNode): string {
  const style = getNodeStyle(node)
  if (style.fill?.kind === 'solid') return style.fill.color ?? '#000000'
  return '#000000'
}

function hasFill(node: SvgNode): boolean {
  const style = getNodeStyle(node)
  return style.fill !== undefined
}

function getStrokeColor(node: SvgNode): string {
  return getNodeStyle(node).stroke?.color ?? '#000000'
}

function getStrokeWidth(node: SvgNode): number {
  return getNodeStyle(node).stroke?.width ?? 0
}

function getOpacity(node: SvgNode): number {
  const style = getNodeStyle(node)
  return style.opacity !== undefined ? Math.round(style.opacity * 100) : 100
}

function fmt(n: number) {
  return Math.round(n).toString()
}

function fmtDeg(n: number) {
  return `${Math.round(n)}°`
}

// ─── Style tokens ─────────────────────────────────────────────────────────────

const S = {
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
  } as React.CSSProperties
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <div style={S.sectionHeader}>{label}</div>
}

function PropRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <span style={{ ...S.value, ...(accent ? S.accent : {}) }}>{value}</span>
    </div>
  )
}

function ColorEditor({ label, color, nodeId, styleKey }: { label: string; color: string; nodeId: string; styleKey: 'fill' | 'stroke' }) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextColor = e.target.value
      if (styleKey === 'fill') {
        void runCommand('document.updateNodeFill', { nodeId, color: nextColor })
      } else {
        const node = getNodeById(useEditorStore.getState().activeDocument.root, nodeId)
        if (!node) return
        const existingStroke = getNodeStyle(node).stroke ?? { width: 1 }
        void runCommand('document.updateNodeStroke', { nodeId, stroke: { ...existingStroke, color: nextColor } })
      }
    },
    [nodeId, styleKey]
  )

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
        <span style={{ ...S.value, fontSize: 11, fontFamily: 'monospace' }}>{color}</span>
        <input
          type="color"
          value={color}
          onChange={handleChange}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          tabIndex={-1}
        />
      </label>
    </div>
  )
}

function NumberEditor({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onCommit: (v: number) => void
}) {
  const [local, setLocal] = useState<string | null>(null)
  const displayed = local !== null ? local : fmt(value)

  const commit = (raw: string) => {
    setLocal(null)
    const parsed = parseFloat(raw)
    if (!isNaN(parsed)) {
      const clamped = min !== undefined ? Math.max(min, max !== undefined ? Math.min(max, parsed) : parsed) : parsed
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
        style={S.input}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}

function TextareaEditor({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState<string | null>(null)
  const displayed = local !== null ? local : value

  return (
    <div style={{ ...S.row, alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
      <span style={S.label}>{label}</span>
      <textarea
        value={displayed}
        rows={3}
        style={{
          ...S.input,
          width: '100%',
          resize: 'vertical',
          textAlign: 'left',
          fontFamily: 'inherit',
          boxSizing: 'border-box'
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

function GeometryGrid({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
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
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
      {cell('X', fmt(x))}
      {cell('Y', fmt(y))}
      {cell('W', fmt(w))}
      {cell('H', fmt(h))}
    </div>
  )
}

// ─── Single-node inspector ────────────────────────────────────────────────────

function SingleNodeInspector({ node }: { node: SvgNode }) {
  const bounds = getNodeBounds(node)
  const rotation = node.transform?.rotate ?? 0
  const isGroup = node.type === 'group'
  const nodeId = node.id
  const style = getNodeStyle(node)
  const fillColor = getFillColor(node)
  const strokeColor = getStrokeColor(node)
  const strokeWidth = getStrokeWidth(node)
  const opacity = getOpacity(node)
  const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1)

  const commitStrokeWidth = (w: number) => {
    void runCommand('document.updateNodeStroke', {
      nodeId,
      stroke: { ...(style.stroke ?? { color: '#000000' }), width: w }
    })
  }

  const commitOpacity = (pct: number) => {
    void runCommand('document.updateNodeStyle', { nodeId, style: { opacity: pct / 100 } })
  }

  const toggleVisibility = () => {
    void runCommand('document.setNodeVisibility', { nodeId, visible: !node.visible })
  }

  const toggleLock = () => {
    void runCommand('document.setNodeLocked', { nodeId, locked: !node.locked })
  }

  const duplicate = () => void runCommand('document.duplicateNodes', { nodeIds: [nodeId] })
  const deleteNode = () => void runCommand('document.deleteNodes', { nodeIds: [nodeId] })
  const reorder = (direction: 'up' | 'down' | 'front' | 'back') =>
    void runCommand('document.reorderNode', { nodeId, direction })

  return (
    <div>
      <SectionHeader label="Identity" />

      {/* Type + name row */}
      <div style={S.row}>
        <span style={S.label}>Type</span>
        <span style={{ ...S.value, ...S.accent }}>{typeLabel}</span>
      </div>

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

      {bounds && (
        <>
          <SectionHeader label="Geometry" />
          <GeometryGrid x={bounds.x} y={bounds.y} w={bounds.width} h={bounds.height} />
          {rotation !== 0 && (
            <div style={{ marginTop: 6 }}>
              <PropRow label="Rotation" value={fmtDeg(rotation)} accent />
            </div>
          )}
        </>
      )}

      {/* Appearance — for non-group nodes that have style */}
      {!isGroup && hasFill(node) && (
        <>
          <SectionHeader label="Appearance" />
          {style.fill?.kind !== 'none' && (
            <ColorEditor label="Fill" color={fillColor} nodeId={nodeId} styleKey="fill" />
          )}
          {style.stroke && (
            <>
              <ColorEditor label="Stroke" color={strokeColor} nodeId={nodeId} styleKey="stroke" />
              <NumberEditor
                label="Stroke width"
                value={strokeWidth}
                min={0}
                max={200}
                onCommit={commitStrokeWidth}
              />
            </>
          )}
          <NumberEditor
            label="Opacity %"
            value={opacity}
            min={0}
            max={100}
            onCommit={commitOpacity}
          />
        </>
      )}

      {/* Rectangle-specific */}
      {node.type === 'rect' && (
        <>
          <SectionHeader label="Rectangle" />
          <NumberEditor
            label="Corner radius"
            value={(node as RectNode).rx ?? 0}
            min={0}
            max={500}
            onCommit={(v) => void runCommand('document.updateNodeProperties', { nodeId, properties: { rx: v, ry: v } })}
          />
        </>
      )}

      {/* Ellipse-specific */}
      {node.type === 'ellipse' && (
        <>
          <SectionHeader label="Ellipse" />
          <NumberEditor
            label="Radius X"
            value={(node as EllipseNode).rx}
            min={1}
            onCommit={(v) => void runCommand('document.updateNodeProperties', { nodeId, properties: { rx: v } })}
          />
          <NumberEditor
            label="Radius Y"
            value={(node as EllipseNode).ry}
            min={1}
            onCommit={(v) => void runCommand('document.updateNodeProperties', { nodeId, properties: { ry: v } })}
          />
        </>
      )}

      {/* Star-specific */}
      {node.type === 'star' && (
        <>
          <SectionHeader label="Star" />
          <NumberEditor
            label="Points"
            value={(node as StarNode).numPoints}
            min={3}
            max={20}
            onCommit={(v) => void runCommand('document.updateNodeProperties', { nodeId, properties: { numPoints: Math.round(v) } })}
          />
          <NumberEditor
            label="Outer radius"
            value={(node as StarNode).outerRadius}
            min={1}
            onCommit={(v) => void runCommand('document.updateNodeProperties', { nodeId, properties: { outerRadius: v } })}
          />
          <NumberEditor
            label="Inner radius"
            value={(node as StarNode).innerRadius}
            min={1}
            onCommit={(v) => void runCommand('document.updateNodeProperties', { nodeId, properties: { innerRadius: v } })}
          />
        </>
      )}

      {/* Text-specific */}
      {node.type === 'text' && (
        <>
          <SectionHeader label="Text" />
          <TextareaEditor
            label="Content"
            value={(node as TextNode).content}
            onCommit={(v) => void runCommand('document.updateNodeProperties', { nodeId, properties: { content: v } })}
          />
          <NumberEditor
            label="Font size"
            value={(node as TextNode).textStyle?.fontSize ?? 16}
            min={4}
            max={1000}
            onCommit={(v) =>
              void runCommand('document.updateNodeProperties', {
                nodeId,
                properties: { textStyle: { ...(node as TextNode).textStyle, fontSize: v } }
              })
            }
          />
          <div style={S.row}>
            <span style={S.label}>Font family</span>
            <select
              value={(node as TextNode).textStyle?.fontFamily ?? 'sans-serif'}
              style={S.select}
              onChange={(e) =>
                void runCommand('document.updateNodeProperties', {
                  nodeId,
                  properties: { textStyle: { ...(node as TextNode).textStyle, fontFamily: e.target.value } }
                })
              }
            >
              <option value="sans-serif">Sans-serif</option>
              <option value="serif">Serif</option>
              <option value="monospace">Monospace</option>
              <option value="cursive">Cursive</option>
            </select>
          </div>
          <div style={S.row}>
            <span style={S.label}>Font weight</span>
            <select
              value={String((node as TextNode).textStyle?.fontWeight ?? 'normal')}
              style={S.select}
              onChange={(e) =>
                void runCommand('document.updateNodeProperties', {
                  nodeId,
                  properties: { textStyle: { ...(node as TextNode).textStyle, fontWeight: e.target.value } }
                })
              }
            >
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
              <option value="300">Light</option>
              <option value="900">Black</option>
            </select>
          </div>
        </>
      )}

      {/* Object actions */}
      <SectionHeader label="Actions" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
        <button onClick={duplicate} style={S.actionBtn}><Copy size={13} /> Duplicate</button>
        <button onClick={deleteNode} style={S.actionBtnDanger}><Trash2 size={13} /> Delete</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
        <button onClick={() => reorder('front')} style={S.actionBtn}><ChevronsUp size={13} /> Front</button>
        <button onClick={() => reorder('up')} style={S.actionBtn}><ChevronUp size={13} /> Forward</button>
        <button onClick={() => reorder('down')} style={S.actionBtn}><ChevronDown size={13} /> Backward</button>
        <button onClick={() => reorder('back')} style={S.actionBtn}><ChevronsDown size={13} /> Back</button>
      </div>
    </div>
  )
}

// ─── Multi-node inspector ─────────────────────────────────────────────────────

function MultiNodeInspector({ nodes }: { nodes: SvgNode[] }) {
  const bounds = combineBounds(nodes.map(getNodeBounds).filter(Boolean) as NonNullable<ReturnType<typeof getNodeBounds>>[])
  const firstNode = nodes[0]
  const firstStyle = firstNode ? getNodeStyle(firstNode) : {}
  const fillColor = firstNode ? getFillColor(firstNode) : '#000000'
  const strokeColor = firstNode ? getStrokeColor(firstNode) : '#000000'
  const strokeWidth = firstNode ? getStrokeWidth(firstNode) : 0

  const applyFillToAll = (color: string) => {
    for (const node of nodes) {
      void runCommand('document.updateNodeFill', { nodeId: node.id, color })
    }
  }

  const applyStrokeToAll = (color: string) => {
    for (const node of nodes) {
      const style = getNodeStyle(node)
      void runCommand('document.updateNodeStroke', { nodeId: node.id, stroke: { ...(style.stroke ?? { width: 1 }), color } })
    }
  }

  const applyStrokeWidthToAll = (w: number) => {
    for (const node of nodes) {
      const style = getNodeStyle(node)
      void runCommand('document.updateNodeStroke', { nodeId: node.id, stroke: { ...(style.stroke ?? { color: '#000000' }), width: w } })
    }
  }

  const duplicate = () => void runCommand('document.duplicateNodes', { nodeIds: nodes.map((n) => n.id) })
  const deleteAll = () => void runCommand('document.deleteNodes', { nodeIds: nodes.map((n) => n.id) })

  return (
    <div>
      <SectionHeader label="Selection" />
      <PropRow label="Count" value={`${nodes.length} objects`} accent />

      {bounds && (
        <>
          <SectionHeader label="Combined Bounds" />
          <GeometryGrid x={bounds.x} y={bounds.y} w={bounds.width} h={bounds.height} />
        </>
      )}

      {firstNode && hasFill(firstNode) && (
        <>
          <SectionHeader label="Batch Style" />
          <div style={S.row}>
            <span style={S.label}>Fill</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <span style={{ width: 22, height: 22, borderRadius: 4, background: fillColor, border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block' }} />
              <span style={{ ...S.value, fontSize: 11, fontFamily: 'monospace' }}>{fillColor}</span>
              <input type="color" value={fillColor} onChange={(e) => applyFillToAll(e.target.value)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} tabIndex={-1} />
            </label>
          </div>
          {firstStyle.stroke && (
            <>
              <div style={S.row}>
                <span style={S.label}>Stroke</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 4, background: strokeColor, border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block' }} />
                  <span style={{ ...S.value, fontSize: 11, fontFamily: 'monospace' }}>{strokeColor}</span>
                  <input type="color" value={strokeColor} onChange={(e) => applyStrokeToAll(e.target.value)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} tabIndex={-1} />
                </label>
              </div>
              <NumberEditor label="Stroke width" value={strokeWidth} min={0} max={200} onCommit={applyStrokeWidthToAll} />
            </>
          )}
        </>
      )}

      <SectionHeader label="Actions" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
        <button onClick={duplicate} style={S.actionBtn}><Copy size={13} /> Duplicate All</button>
        <button onClick={deleteAll} style={S.actionBtnDanger}><Trash2 size={13} /> Delete All</button>
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyInspector() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        gap: 8
      }}
    >
      <span style={{ fontSize: 28 }}>✦</span>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
        Select an object on the canvas to inspect it.
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InspectorSheet() {
  const open = useEditorStore((s) => s.ui.rightPanelOpen)
  const setOpen = useEditorStore((s) => s.setRightPanelOpen)
  const lockAspectRatio = useEditorStore((s) => s.ui.lockAspectRatio)
  const multiSelectEnabled = useEditorStore((s) => s.ui.multiSelectEnabled)
  const toggleAspectRatioLock = useEditorStore((s) => s.toggleAspectRatioLock)
  const toggleMultiSelectEnabled = useEditorStore((s) => s.toggleMultiSelectEnabled)
  const selection = useEditorStore((s) => s.selection.selectedNodeIds)
  const document = useEditorStore((s) => s.activeDocument)

  const selectedNodes = selection
    .map((id) => getNodeById(document.root, id))
    .filter((n): n is SvgNode => Boolean(n))

  const activeNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined

  const sectionToggle = (label: string, active: boolean, icon: React.ReactNode, iconOff: React.ReactNode, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{ ...S.row, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
    >
      <span style={S.label}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: active ? '#93c5fd' : 'rgba(255,255,255,0.4)' }}>
        {active ? icon : iconOff}
        {active ? 'On' : 'Off'}
      </span>
    </button>
  )

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Portal>
        <Drawer.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 40
          }}
        />
        <Drawer.Content
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: '72dvh',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            background: 'rgba(18,18,18,0.98)',
            backdropFilter: 'blur(16px)',
            paddingBottom: 'calc(var(--sai-bottom, 0px) + 8px)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            outline: 'none',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.5)'
          }}
        >
          <Drawer.Handle
            style={{
              background: 'rgba(255,255,255,0.2)',
              marginTop: 8,
              marginBottom: 0
            }}
          />

          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px 8px'
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Inspector</div>
            {activeNode && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}
              >
                {activeNode.type}
              </span>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px' }}>
            {selectedNodes.length === 0 && <EmptyInspector />}
            {activeNode && <SingleNodeInspector node={activeNode} />}
            {selectedNodes.length > 1 && <MultiNodeInspector nodes={selectedNodes} />}

            {/* Editor state section */}
            <SectionHeader label="Editor State" />
            {sectionToggle('Multi-select', multiSelectEnabled, <Layers size={12} />, <Layers size={12} />, toggleMultiSelectEnabled)}
            {sectionToggle('Aspect lock', lockAspectRatio, <Lock size={12} />, <Unlock size={12} />, toggleAspectRatioLock)}
            <div style={{ height: 8 }} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
