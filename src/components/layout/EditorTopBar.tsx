import { ArrowLeft, FilePlus, Undo2, Redo2, ZoomIn, ZoomOut, Save, Layers, SlidersHorizontal } from 'lucide-react'
import { createAndSaveDocument, saveDocument } from '@/db/dexie/queries'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'

const iconBtn = (active = false): React.CSSProperties => ({
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  background: active ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.06)'
})

export function EditorTopBar() {
  const title = useEditorStore((s) => s.activeDocument.title)
  const zoom = useEditorStore((s) => s.view.zoom)
  const view = useEditorStore((s) => s.view)
  const activeDocument = useEditorStore((s) => s.activeDocument)
  const replaceDocument = useEditorStore((s) => s.replaceDocument)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const setCamera = useEditorStore((s) => s.setCamera)
  const leftPanelOpen = useEditorStore((s) => s.ui.leftPanelOpen)
  const rightPanelOpen = useEditorStore((s) => s.ui.rightPanelOpen)
  const toggleLeftPanel = useEditorStore((s) => s.toggleLeftPanel)
  const toggleRightPanel = useEditorStore((s) => s.toggleRightPanel)
  const undo = useHistoryStore((s) => s.undo)
  const redo = useHistoryStore((s) => s.redo)
  const clearHistory = useHistoryStore((s) => s.clear)
  const canUndo = useHistoryStore((s) => s.undoStack.length > 0)
  const canRedo = useHistoryStore((s) => s.redoStack.length > 0)

  const zoomAroundCenter = (nextZoom: number) => {
    const clampedZoom = Math.min(4, Math.max(0.25, nextZoom))
    if (clampedZoom === view.zoom) return
    const currentWidth = activeDocument.viewBox.width / view.zoom
    const currentHeight = activeDocument.viewBox.height / view.zoom
    const centerDocX = activeDocument.viewBox.x + view.panX + currentWidth / 2
    const centerDocY = activeDocument.viewBox.y + view.panY + currentHeight / 2
    const nextWidth = activeDocument.viewBox.width / clampedZoom
    const nextHeight = activeDocument.viewBox.height / clampedZoom
    const nextPanX = centerDocX - activeDocument.viewBox.x - nextWidth / 2
    const nextPanY = centerDocY - activeDocument.viewBox.y - nextHeight / 2
    setCamera(clampedZoom, nextPanX, nextPanY)
  }

  const handleNew = async () => {
    const doc = await createAndSaveDocument('Untitled SVG')
    replaceDocument(doc)
    clearSelection()
    clearHistory()
  }

  const handleSave = async () => {
    const saved = await saveDocument(activeDocument)
    replaceDocument(saved)
  }

  const handleUndo = async () => {
    const previous = undo()
    if (!previous) return
    replaceDocument(previous)
    clearSelection()
    await saveDocument(previous)
  }

  const handleRedo = async () => {
    const next = redo()
    if (!next) return
    replaceDocument(next)
    clearSelection()
    await saveDocument(next)
  }

  return (
    <header
      style={{
        height: 44,
        paddingTop: 'var(--sai-top, 0px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: '#111111',
        gap: 4,
        flexShrink: 0
      }}
    >
      {/* Left group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button style={iconBtn()} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <button style={iconBtn()} onClick={() => void handleNew()} aria-label="New document">
          <FilePlus size={18} />
        </button>
        <button style={iconBtn(leftPanelOpen)} onClick={toggleLeftPanel} aria-label="Toggle layers">
          <Layers size={18} />
        </button>
      </div>

      {/* Center title */}
      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', minWidth: 0 }}>
        {title}
      </div>

      {/* Right group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button disabled={!canUndo} onClick={() => void handleUndo()} style={{ ...iconBtn(), opacity: canUndo ? 1 : 0.35 }} aria-label="Undo">
          <Undo2 size={18} />
        </button>
        <button disabled={!canRedo} onClick={() => void handleRedo()} style={{ ...iconBtn(), opacity: canRedo ? 1 : 0.35 }} aria-label="Redo">
          <Redo2 size={18} />
        </button>
        <button onClick={() => zoomAroundCenter(zoom - 0.1)} style={iconBtn()} aria-label="Zoom out">
          <ZoomOut size={16} />
        </button>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => zoomAroundCenter(zoom + 0.1)} style={iconBtn()} aria-label="Zoom in">
          <ZoomIn size={16} />
        </button>
        <button style={iconBtn(rightPanelOpen)} onClick={toggleRightPanel} aria-label="Toggle inspector">
          <SlidersHorizontal size={18} />
        </button>
        <button onClick={() => void handleSave()} style={iconBtn()} aria-label="Save">
          <Save size={18} />
        </button>
      </div>
    </header>
  )
}
