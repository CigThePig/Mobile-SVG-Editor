import { Plus, Group, Ungroup, Layers, Lock } from 'lucide-react'
import { getNodeById } from '@/features/documents/utils/documentMutations'
import { runCommand } from '@/features/documents/services/commandRunner'
import { getEffectiveViewBox } from '@/features/canvas/utils/viewBox'
import { useEditorStore } from '@/stores/editorStore'

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

  const pillStyle = (active = false, disabled = false): React.CSSProperties => ({
    padding: '6px 10px',
    borderRadius: 12,
    background: active ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.08)',
    color: active ? '#93c5fd' : '#ffffff',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.45 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11
  })

  return (
    <div
      className="hide-scrollbar"
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 8px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        background: '#171717',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        flexShrink: 0
      }}
    >
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>{mode}</span>
      <span style={{ fontSize: 11, color: selectionCount > 0 ? '#93c5fd' : 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
        {selectionCount} sel
      </span>
      <button onClick={addRect} style={pillStyle(false)}>
        <Plus size={14} /> Rect
      </button>
      <button disabled={!canGroup} onClick={groupSelection} style={pillStyle(false, !canGroup)}>
        <Group size={14} /> Group
      </button>
      <button disabled={!canUngroup} onClick={ungroupSelection} style={pillStyle(false, !canUngroup)}>
        <Ungroup size={14} /> Ungroup
      </button>
      <button onClick={toggleMultiSelectEnabled} style={pillStyle(multiSelectEnabled)}>
        <Layers size={14} /> Multi
      </button>
      <button onClick={toggleAspectRatioLock} style={pillStyle(lockAspectRatio)}>
        <Lock size={14} /> Aspect
      </button>
    </div>
  )
}
