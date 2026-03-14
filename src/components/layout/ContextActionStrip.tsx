import { Plus, Group, Ungroup, Layers, Lock, Unlock } from 'lucide-react'
import { getNodeById } from '@/features/documents/utils/documentMutations'
import { runCommand } from '@/features/documents/services/commandRunner'
import { getEffectiveViewBox } from '@/features/canvas/utils/viewBox'
import { useEditorStore, type EditorMode } from '@/stores/editorStore'

const MODE_LABELS: Record<EditorMode, string> = {
  navigate: 'Pan',
  select: 'Select',
  shape: 'Shape',
  pen: 'Pen',
  path: 'Path',
  text: 'Text',
  paint: 'Paint',
  structure: 'Structure',
  inspect: 'Inspect'
}

export function ContextActionStrip() {
  const mode = useEditorStore((s) => s.mode)
  const document = useEditorStore((s) => s.activeDocument)
  const view = useEditorStore((s) => s.view)
  const selectedNodeIds = useEditorStore((s) => s.selection.selectedNodeIds)
  const lockAspectRatio = useEditorStore((s) => s.ui.lockAspectRatio)
  const multiSelectEnabled = useEditorStore((s) => s.ui.multiSelectEnabled)
  const selectionCount = selectedNodeIds.length
  const toggleAspectRatioLock = useEditorStore((s) => s.toggleAspectRatioLock)
  const toggleMultiSelectEnabled = useEditorStore((s) => s.toggleMultiSelectEnabled)

  const canGroup = selectionCount >= 2
  const canUngroup = selectedNodeIds.some((id) => getNodeById(document.root, id)?.type === 'group')

  const addRect = () => {
    const vb = getEffectiveViewBox(document, view)
    const rectWidth = Math.round(vb.width * 0.25)
    const rectHeight = Math.round(vb.height * 0.18)
    const x = Math.round(vb.x + vb.width / 2 - rectWidth / 2)
    const y = Math.round(vb.y + vb.height / 2 - rectHeight / 2)
    void runCommand('document.addRect', { x, y, width: rectWidth, height: rectHeight })
  }

  const groupSelection = () => {
    if (!canGroup) return
    void runCommand('document.groupSelection', { nodeIds: selectedNodeIds })
  }

  const ungroupSelection = () => {
    if (!canUngroup) return
    void runCommand('document.ungroupSelection', { nodeIds: selectedNodeIds })
  }

  const pill = (active = false, disabled = false): React.CSSProperties => ({
    padding: '0 12px',
    height: 34,
    borderRadius: 10,
    background: active ? 'rgba(96,165,250,0.22)' : 'rgba(255,255,255,0.08)',
    border: active ? '1px solid rgba(96,165,250,0.4)' : '1px solid transparent',
    color: active ? '#93c5fd' : disabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)',
    whiteSpace: 'nowrap' as const,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    fontWeight: 500,
    flexShrink: 0,
    cursor: disabled ? 'default' : 'pointer'
  })

  const modeLabel = MODE_LABELS[mode] ?? mode

  return (
    <div
      className="hide-scrollbar"
      style={{
        height: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 10px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: '#161616',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        flexShrink: 0
      }}
    >
      {/* Mode badge */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}
      >
        {modeLabel}
      </span>

      {/* Divider */}
      <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

      {/* Selection count badge — only shown when something is selected */}
      {selectionCount > 0 && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#93c5fd',
            background: 'rgba(96,165,250,0.15)',
            borderRadius: 8,
            padding: '2px 8px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          {selectionCount === 1 ? '1 selected' : `${selectionCount} selected`}
        </span>
      )}

      <button onClick={addRect} style={pill(false)}>
        <Plus size={14} /> Add Rect
      </button>
      <button disabled={!canGroup} onClick={groupSelection} style={pill(false, !canGroup)}>
        <Group size={14} /> Group
      </button>
      <button disabled={!canUngroup} onClick={ungroupSelection} style={pill(false, !canUngroup)}>
        <Ungroup size={14} /> Ungroup
      </button>
      <button onClick={toggleMultiSelectEnabled} style={pill(multiSelectEnabled)}>
        <Layers size={14} /> Multi
      </button>
      <button onClick={toggleAspectRatioLock} style={pill(lockAspectRatio)}>
        {lockAspectRatio ? <Lock size={14} /> : <Unlock size={14} />}
        Aspect
      </button>
    </div>
  )
}
