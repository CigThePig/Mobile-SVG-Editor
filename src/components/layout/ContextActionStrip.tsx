import { Plus, Group, Ungroup, Layers, Lock, Unlock, Trash2, Copy, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Eye, EyeOff, Circle, Minus, Pentagon, Star, Type } from 'lucide-react'
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
  const firstSelectedNode = selectionCount > 0 ? getNodeById(document.root, selectedNodeIds[0]) : null
  const isLocked = firstSelectedNode?.locked ?? false
  const isVisible = firstSelectedNode?.visible ?? true

  // Calculate a centered position for new shapes
  const getCenter = () => {
    const vb = getEffectiveViewBox(document, view)
    return { vb, cx: vb.x + vb.width / 2, cy: vb.y + vb.height / 2 }
  }

  const addRect = () => {
    const { vb, cx, cy } = getCenter()
    const w = Math.round(vb.width * 0.25)
    const h = Math.round(vb.height * 0.18)
    void runCommand('document.addRect', { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), width: w, height: h })
  }

  const addEllipse = () => {
    const { vb, cx, cy } = getCenter()
    void runCommand('document.addEllipse', { cx: Math.round(cx), cy: Math.round(cy), rx: Math.round(vb.width * 0.12), ry: Math.round(vb.height * 0.09) })
  }

  const addLine = () => {
    const { vb, cx, cy } = getCenter()
    const half = Math.round(Math.min(vb.width, vb.height) * 0.12)
    void runCommand('document.addLine', { x1: cx - half, y1: cy - half, x2: cx + half, y2: cy + half })
  }

  const addPolygon = () => {
    const { vb, cx, cy } = getCenter()
    const radius = Math.round(Math.min(vb.width, vb.height) * 0.1)
    void runCommand('document.addPolygon', { cx: Math.round(cx), cy: Math.round(cy), radius, sides: 6 })
  }

  const addStar = () => {
    const { vb, cx, cy } = getCenter()
    const outer = Math.round(Math.min(vb.width, vb.height) * 0.1)
    void runCommand('document.addStar', { cx: Math.round(cx), cy: Math.round(cy), outerRadius: outer, innerRadius: Math.round(outer * 0.45), numPoints: 5 })
  }

  const addText = () => {
    const { cx, cy } = getCenter()
    void runCommand('document.addText', { x: Math.round(cx), y: Math.round(cy), content: 'Text' })
  }

  const groupSelection = () => {
    if (!canGroup) return
    void runCommand('document.groupSelection', { nodeIds: selectedNodeIds })
  }

  const ungroupSelection = () => {
    if (!canUngroup) return
    void runCommand('document.ungroupSelection', { nodeIds: selectedNodeIds })
  }

  const duplicate = () => {
    if (!selectionCount) return
    void runCommand('document.duplicateNodes', { nodeIds: selectedNodeIds })
  }

  const deleteSelected = () => {
    if (!selectionCount) return
    void runCommand('document.deleteNodes', { nodeIds: selectedNodeIds })
  }

  const reorder = (direction: 'up' | 'down' | 'front' | 'back') => {
    if (!selectedNodeIds[0]) return
    void runCommand('document.reorderNode', { nodeId: selectedNodeIds[0], direction })
  }

  const toggleLock = () => {
    if (!selectedNodeIds[0]) return
    void runCommand('document.setNodeLocked', { nodeId: selectedNodeIds[0], locked: !isLocked })
  }

  const toggleVisibility = () => {
    if (!selectedNodeIds[0]) return
    void runCommand('document.setNodeVisibility', { nodeId: selectedNodeIds[0], visible: !isVisible })
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

  const iconPill = (active = false, disabled = false): React.CSSProperties => ({
    ...pill(active, disabled),
    padding: '0 10px'
  })

  const divider = (): React.ReactNode => (
    <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
  )

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

      {divider()}

      {/* Selection count badge */}
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

      {/* Shape creation */}
      <button onClick={addRect} style={pill(false)} title="Add Rectangle">
        <Plus size={14} /> Rect
      </button>
      <button onClick={addEllipse} style={pill(false)} title="Add Ellipse">
        <Circle size={14} /> Ellipse
      </button>
      <button onClick={addLine} style={pill(false)} title="Add Line">
        <Minus size={14} /> Line
      </button>
      <button onClick={addPolygon} style={pill(false)} title="Add Polygon">
        <Pentagon size={14} /> Polygon
      </button>
      <button onClick={addStar} style={pill(false)} title="Add Star">
        <Star size={14} /> Star
      </button>
      <button onClick={addText} style={pill(false)} title="Add Text">
        <Type size={14} /> Text
      </button>

      {divider()}

      {/* Object actions — visible when selection exists */}
      {selectionCount > 0 && (
        <>
          <button onClick={duplicate} style={pill(false)} title="Duplicate">
            <Copy size={14} /> Dupe
          </button>
          <button onClick={deleteSelected} style={{ ...pill(false), color: 'rgba(252,165,165,0.9)' }} title="Delete">
            <Trash2 size={14} /> Delete
          </button>

          {divider()}

          <button onClick={() => reorder('front')} style={iconPill(false)} title="Bring to Front">
            <ChevronsUp size={14} />
          </button>
          <button onClick={() => reorder('up')} style={iconPill(false)} title="Move Forward">
            <ChevronUp size={14} />
          </button>
          <button onClick={() => reorder('down')} style={iconPill(false)} title="Move Backward">
            <ChevronDown size={14} />
          </button>
          <button onClick={() => reorder('back')} style={iconPill(false)} title="Send to Back">
            <ChevronsDown size={14} />
          </button>

          {divider()}

          <button onClick={toggleLock} style={pill(isLocked)} title={isLocked ? 'Unlock' : 'Lock'}>
            {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
            {isLocked ? 'Locked' : 'Lock'}
          </button>
          <button onClick={toggleVisibility} style={pill(!isVisible)} title={isVisible ? 'Hide' : 'Show'}>
            {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            {isVisible ? 'Visible' : 'Hidden'}
          </button>

          {divider()}
        </>
      )}

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
