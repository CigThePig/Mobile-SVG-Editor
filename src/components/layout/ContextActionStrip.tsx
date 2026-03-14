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
    // Place the new rect centered on whatever is currently visible in the viewport
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

  const pillStyle = (active = false, disabled = false) => ({
    padding: '8px 12px',
    borderRadius: 12,
    background: active ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.08)',
    color: active ? '#93c5fd' : '#ffffff',
    whiteSpace: 'nowrap' as const,
    opacity: disabled ? 0.45 : 1
  })

  return (
    <div
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        background: '#171717',
        overflowX: 'auto'
      }}
    >
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>Mode: {mode}</span>
      <span style={{ fontSize: 12, color: selectionCount > 0 ? '#93c5fd' : 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
        {selectionCount} selected
      </span>
      <button onClick={addRect} style={pillStyle(false)}>Add Rectangle</button>
      <button disabled={!canGroup} onClick={groupSelection} style={pillStyle(false, !canGroup)}>Group</button>
      <button disabled={!canUngroup} onClick={ungroupSelection} style={pillStyle(false, !canUngroup)}>Ungroup</button>
      <button onClick={toggleMultiSelectEnabled} style={pillStyle(multiSelectEnabled)}>Multi {multiSelectEnabled ? 'On' : 'Off'}</button>
      <button onClick={toggleAspectRatioLock} style={pillStyle(lockAspectRatio)}>Aspect {lockAspectRatio ? 'On' : 'Off'}</button>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
        Grouping works best for nodes sharing the same parent
      </span>
    </div>
  )
}
