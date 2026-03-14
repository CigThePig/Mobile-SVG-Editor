import { createAndSaveDocument, saveDocument } from '@/db/dexie/queries'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'

export function EditorTopBar() {
  const title = useEditorStore((s) => s.activeDocument.title)
  const zoom = useEditorStore((s) => s.view.zoom)
  const view = useEditorStore((s) => s.view)
  const activeDocument = useEditorStore((s) => s.activeDocument)
  const replaceDocument = useEditorStore((s) => s.replaceDocument)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const setCamera = useEditorStore((s) => s.setCamera)
  const undo = useHistoryStore((s) => s.undo)
  const redo = useHistoryStore((s) => s.redo)
  const canUndo = useHistoryStore((s) => s.canUndo())
  const canRedo = useHistoryStore((s) => s.canRedo())

  // Zoom while keeping the current viewport center fixed in document space
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
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: '#111111',
        gap: 8
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button>Back</button>
        <button onClick={() => void handleNew()}>New</button>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button disabled={!canUndo} onClick={() => void handleUndo()} style={{ opacity: canUndo ? 1 : 0.4 }}>Undo</button>
        <button disabled={!canRedo} onClick={() => void handleRedo()} style={{ opacity: canRedo ? 1 : 0.4 }}>Redo</button>
        <button onClick={() => zoomAroundCenter(zoom - 0.1)}>-</button>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', minWidth: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => zoomAroundCenter(zoom + 0.1)}>+</button>
        <button onClick={() => void handleSave()}>Save</button>
      </div>
    </header>
  )
}
