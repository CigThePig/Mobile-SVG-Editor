import type { MouseEvent } from 'react'
import { Drawer } from 'vaul'
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import type { SvgNode } from '@/model/nodes/nodeTypes'
import { runCommand } from '@/features/documents/services/commandRunner'
import { useEditorStore } from '@/stores/editorStore'

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids))
}

function labelForNode(node: SvgNode) {
  if (node.name) return node.name
  if (node.type === 'group') return 'Group'
  return node.type.charAt(0).toUpperCase() + node.type.slice(1)
}

/** Single-character glyph used as a type indicator */
function typeGlyph(type: SvgNode['type']): string {
  switch (type) {
    case 'group': return 'G'
    case 'rect': return 'R'
    case 'circle': return 'C'
    case 'ellipse': return 'E'
    case 'line': return 'L'
    case 'path': return 'P'
    case 'star': return '★'
    case 'polygon': return 'Pg'
    case 'polyline': return 'Pl'
    case 'text': return 'T'
    case 'image': return 'I'
    default: return type.charAt(0).toUpperCase()
  }
}

/** Color for the type badge background */
function typeBadgeColor(type: SvgNode['type']): string {
  switch (type) {
    case 'group': return 'rgba(250,204,21,0.18)'
    case 'rect': return 'rgba(96,165,250,0.18)'
    case 'circle':
    case 'ellipse': return 'rgba(167,139,250,0.18)'
    case 'path': return 'rgba(52,211,153,0.18)'
    case 'text': return 'rgba(251,146,60,0.18)'
    case 'star': return 'rgba(251,191,36,0.22)'
    case 'polygon':
    case 'polyline': return 'rgba(110,231,183,0.18)'
    case 'line': return 'rgba(148,163,184,0.18)'
    default: return 'rgba(255,255,255,0.1)'
  }
}

function typeBadgeTextColor(type: SvgNode['type']): string {
  switch (type) {
    case 'group': return '#fcd34d'
    case 'rect': return '#93c5fd'
    case 'circle':
    case 'ellipse': return '#c4b5fd'
    case 'path': return '#6ee7b7'
    case 'text': return '#fdba74'
    case 'star': return '#fbbf24'
    case 'polygon':
    case 'polyline': return '#6ee7b7'
    case 'line': return '#94a3b8'
    default: return 'rgba(255,255,255,0.7)'
  }
}

interface LayerRowProps {
  node: SvgNode
  depth: number
  isSelected: boolean
  isLastChild: boolean
  isInsideGroup: boolean
  onSelect: (event: MouseEvent<HTMLButtonElement>, id: string) => void
}

function LayerRow({ node, depth, isSelected, isInsideGroup, onSelect }: LayerRowProps) {
  const hasChildren = Boolean(node.children?.length)
  const childCount = node.children?.length ?? 0
  const selectedIds = useEditorStore((s) => s.selection.selectedNodeIds)

  const toggleVisibility = (e: MouseEvent) => {
    e.stopPropagation()
    void runCommand('document.setNodeVisibility', { nodeId: node.id, visible: !node.visible })
  }

  const toggleLock = (e: MouseEvent) => {
    e.stopPropagation()
    void runCommand('document.setNodeLocked', { nodeId: node.id, locked: !node.locked })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <button
          onClick={(event) => onSelect(event, node.id)}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 10 + depth * 16,
            paddingRight: 8,
            height: 44,
            borderRadius: 10,
            background: isSelected ? 'rgba(96,165,250,0.14)' : 'transparent',
            border: isSelected ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
            textAlign: 'left',
            flex: 1,
            minWidth: 0
          }}
        >
          {/* Depth indicator line */}
          {depth > 0 && (
            <span
              style={{
                position: 'absolute',
                left: 10 + (depth - 1) * 16 + 7,
                top: 0,
                bottom: 0,
                width: 1,
                background: 'rgba(255,255,255,0.12)'
              }}
            />
          )}

          {/* Left accent for selected */}
          {isSelected && (
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 6,
                bottom: 6,
                width: 3,
                borderRadius: 2,
                background: '#60a5fa'
              }}
            />
          )}

          {/* Type badge */}
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: typeBadgeColor(node.type),
              color: typeBadgeTextColor(node.type),
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              letterSpacing: 0,
              opacity: node.visible === false ? 0.4 : 1
            }}
          >
            {typeGlyph(node.type)}
          </span>

          {/* Label */}
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: isSelected ? 600 : 400,
              color: node.visible === false
                ? 'rgba(255,255,255,0.35)'
                : isSelected ? '#e2e8f0' : 'rgba(255,255,255,0.85)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              textDecoration: node.visible === false ? 'line-through' : 'none'
            }}
          >
            {labelForNode(node)}
          </span>

          {/* Child count badge for groups */}
          {hasChildren && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.07)',
                borderRadius: 6,
                padding: '1px 6px',
                flexShrink: 0
              }}
            >
              {childCount}
            </span>
          )}
        </button>

        {/* Visibility icon */}
        <button
          onClick={toggleVisibility}
          title={node.visible === false ? 'Show' : 'Hide'}
          style={{
            width: 32,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: node.visible === false ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.45)',
            flexShrink: 0,
            borderRadius: 6
          }}
        >
          {node.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>

        {/* Lock icon */}
        <button
          onClick={toggleLock}
          title={node.locked ? 'Unlock' : 'Lock'}
          style={{
            width: 32,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: node.locked ? '#93c5fd' : 'rgba(255,255,255,0.3)',
            flexShrink: 0,
            borderRadius: 6
          }}
        >
          {node.locked ? <Lock size={13} /> : <Unlock size={13} />}
        </button>

        {/* Move Out — pop this node out of its parent group */}
        {isInsideGroup && (
          <button
            onClick={(e) => { e.stopPropagation(); void runCommand('document.moveNodeOutOfGroup', { nodeId: node.id }) }}
            title="Move out of group"
            style={{
              width: 28,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)',
              flexShrink: 0,
              borderRadius: 6,
              fontSize: 14
            }}
          >
            ⬅
          </button>
        )}

        {/* Move In — move currently selected nodes into this group */}
        {node.type === 'group' && selectedIds.some((id) => id !== node.id) && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              const toMove = selectedIds.filter((id) => id !== node.id)
              void runCommand('document.moveNodesIntoGroup', { nodeIds: toMove, targetGroupId: node.id })
            }}
            title="Move selected into this group"
            style={{
              width: 28,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)',
              flexShrink: 0,
              borderRadius: 6,
              fontSize: 14
            }}
          >
            ⬇
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren &&
        node.children!.map((child, idx) => (
          <ChildRows
            key={child.id}
            node={child}
            depth={depth + 1}
            isLastChild={idx === (node.children!.length - 1)}
            onSelect={onSelect}
          />
        ))}
    </div>
  )
}

/** Thin wrapper so we can pass isSelected from the panel context */
function ChildRows({
  node,
  depth,
  isLastChild,
  onSelect
}: {
  node: SvgNode
  depth: number
  isLastChild: boolean
  onSelect: (event: MouseEvent<HTMLButtonElement>, id: string) => void
}) {
  const isSelected = useEditorStore((s) => s.selection.selectedNodeIds.includes(node.id))
  return (
    <LayerRow
      node={node}
      depth={depth}
      isSelected={isSelected}
      isLastChild={isLastChild}
      isInsideGroup={depth > 0}
      onSelect={onSelect}
    />
  )
}

export function LayersPanel() {
  const open = useEditorStore((s) => s.ui.leftPanelOpen)
  const setOpen = useEditorStore((s) => s.setLeftPanelOpen)
  const nodes = useEditorStore((s) => s.activeDocument.root.children)
  const selectedIds = useEditorStore((s) => s.selection.selectedNodeIds)
  const multiSelectEnabled = useEditorStore((s) => s.ui.multiSelectEnabled)
  const setSelection = useEditorStore((s) => s.setSelection)

  const handleSelect = (event: MouseEvent<HTMLButtonElement>, id: string) => {
    const additive = multiSelectEnabled || event.shiftKey
    const isSelected = selectedIds.includes(id)
    if (additive) {
      setSelection(isSelected ? selectedIds.filter((item) => item !== id) : uniqueIds([...selectedIds, id]))
      return
    }
    setSelection([id])
  }

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
            <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Layers</div>
            <div
              style={{
                fontSize: 12,
                color: selectedIds.length > 0 ? '#93c5fd' : 'rgba(255,255,255,0.4)',
                fontWeight: selectedIds.length > 0 ? 600 : 400
              }}
            >
              {selectedIds.length > 0
                ? `${selectedIds.length} selected`
                : `${nodes?.length ?? 0} layer${(nodes?.length ?? 0) !== 1 ? 's' : ''}`}
            </div>
          </div>

          {/* Layer list */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 8px 4px' }}>
            {!nodes || nodes.length === 0 ? (
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
                <span style={{ fontSize: 28 }}>□</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                  No layers yet. Add a shape to get started.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {nodes.map((node, idx) => {
                  const isSelected = selectedIds.includes(node.id)
                  return (
                    <LayerRow
                      key={node.id}
                      node={node}
                      depth={0}
                      isSelected={isSelected}
                      isLastChild={idx === nodes.length - 1}
                      isInsideGroup={false}
                      onSelect={handleSelect}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
