import { Drawer } from 'vaul'
import { Lock, Unlock, Layers, Eye, EyeOff } from 'lucide-react'
import { combineBounds, getNodeBounds } from '@/features/selection/utils/nodeBounds'
import { getNodeById } from '@/features/documents/utils/documentMutations'
import { useEditorStore } from '@/stores/editorStore'
import type { RectNode, SvgNode } from '@/model/nodes/nodeTypes'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.round(n).toString()
}

function fmtDeg(n: number) {
  return `${Math.round(n)}°`
}

/** Best-effort fill color string for display, or null. */
function getDisplayFill(node: SvgNode): string | null {
  const styled = node as { style?: { fill?: { kind: string; color?: string } } }
  if (!styled.style?.fill) return null
  if (styled.style.fill.kind === 'none') return null
  if (styled.style.fill.kind === 'solid') return styled.style.fill.color ?? null
  return null
}

/** Best-effort stroke color + width for display. */
function getDisplayStroke(node: SvgNode): { color: string; width: number } | null {
  const styled = node as { style?: { stroke?: { color?: string; width: number } } }
  if (!styled.style?.stroke) return null
  const { color, width } = styled.style.stroke
  if (!color || width === 0) return null
  return { color, width }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.35)',
        marginBottom: 4,
        marginTop: 12
      }}
    >
      {label}
    </div>
  )
}

function PropRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}
    >
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: accent ? '#93c5fd' : 'rgba(255,255,255,0.9)',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right'
        }}
      >
        {value}
      </span>
    </div>
  )
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          background: color,
          border: '1px solid rgba(255,255,255,0.2)',
          flexShrink: 0,
          display: 'inline-block'
        }}
      />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{color}</span>
    </span>
  )
}

function ToggleRow({
  label,
  active,
  icon,
  iconOff
}: {
  label: string
  active: boolean
  icon: React.ReactNode
  iconOff?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}
    >
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 12,
          fontWeight: 500,
          color: active ? '#93c5fd' : 'rgba(255,255,255,0.4)'
        }}
      >
        {active ? icon : (iconOff ?? icon)}
        {active ? 'On' : 'Off'}
      </span>
    </div>
  )
}

// ─── Geometry grid ────────────────────────────────────────────────────────────

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
  const fill = getDisplayFill(node)
  const stroke = getDisplayStroke(node)
  const rotation = node.transform?.rotate ?? 0
  const isGroup = node.type === 'group'

  const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1)

  return (
    <div>
      <SectionHeader label="Identity" />
      <PropRow label="Type" value={typeLabel} />
      {node.name && <PropRow label="Name" value={node.name} />}
      <PropRow
        label="Visibility"
        value={
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {node.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            {node.visible ? 'Visible' : 'Hidden'}
          </span>
        }
      />
      <PropRow
        label="Lock"
        value={
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {node.locked ? <Lock size={12} /> : <Unlock size={12} />}
            {node.locked ? 'Locked' : 'Unlocked'}
          </span>
        }
      />

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

      {!isGroup && (fill || stroke) && (
        <>
          <SectionHeader label="Appearance" />
          {fill && <PropRow label="Fill" value={<ColorSwatch color={fill} />} />}
          {stroke && (
            <PropRow
              label="Stroke"
              value={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ColorSwatch color={stroke.color} />
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{stroke.width}px</span>
                </span>
              }
            />
          )}
        </>
      )}

      {/* Rectangle-specific dimensions */}
      {node.type === 'rect' && (
        <>
          <SectionHeader label="Rectangle" />
          <PropRow label="X" value={fmt((node as RectNode).x)} />
          <PropRow label="Y" value={fmt((node as RectNode).y)} />
          <PropRow label="Width" value={fmt((node as RectNode).width)} />
          <PropRow label="Height" value={fmt((node as RectNode).height)} />
          {((node as RectNode).rx ?? 0) > 0 && (
            <PropRow label="Corner radius" value={fmt((node as RectNode).rx ?? 0)} />
          )}
        </>
      )}
    </div>
  )
}

// ─── Multi-node inspector ─────────────────────────────────────────────────────

function MultiNodeInspector({ nodes }: { nodes: SvgNode[] }) {
  const bounds = combineBounds(nodes.map(getNodeBounds).filter(Boolean) as NonNullable<ReturnType<typeof getNodeBounds>>[])

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
  const selection = useEditorStore((s) => s.selection.selectedNodeIds)
  const document = useEditorStore((s) => s.activeDocument)

  const selectedNodes = selection
    .map((id) => getNodeById(document.root, id))
    .filter((n): n is SvgNode => Boolean(n))

  const activeNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined

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
            {/* Selection content */}
            {selectedNodes.length === 0 && <EmptyInspector />}
            {activeNode && <SingleNodeInspector node={activeNode} />}
            {selectedNodes.length > 1 && <MultiNodeInspector nodes={selectedNodes} />}

            {/* Editor state section — always shown at bottom */}
            <SectionHeader label="Editor State" />
            <ToggleRow
              label="Multi-select"
              active={multiSelectEnabled}
              icon={<Layers size={12} />}
            />
            <ToggleRow
              label="Aspect lock"
              active={lockAspectRatio}
              icon={<Lock size={12} />}
              iconOff={<Unlock size={12} />}
            />
            <div style={{ height: 8 }} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
