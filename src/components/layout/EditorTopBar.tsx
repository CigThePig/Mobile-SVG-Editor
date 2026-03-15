import { useRef, useState } from 'react'
import { ArrowLeft, FilePlus, Undo2, Redo2, ZoomIn, ZoomOut, Save, Layers, SlidersHorizontal, ImagePlus, Download, History, Settings } from 'lucide-react'
import { createAndSaveDocument, saveDocument } from '@/db/dexie/queries'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useNavigation } from '@/app/routing/NavigationContext'
import { runCommand } from '@/features/documents/services/commandRunner'
import { DocumentSettingsSheet } from '@/features/documents/components/DocumentSettingsSheet'
import { SnapshotsSheet } from '@/features/snapshots/components/SnapshotsSheet'

const iconBtn = (active = false, disabled = false): React.CSSProperties => ({
  width: 40,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 10,
  background: active ? 'rgba(96,165,250,0.22)' : 'rgba(255,255,255,0.07)',
  color: active ? '#93c5fd' : disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.9)',
  flexShrink: 0
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
  const { navigate } = useNavigation()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [docSettingsOpen, setDocSettingsOpen] = useState(false)
  const [snapshotsOpen, setSnapshotsOpen] = useState(false)

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

  const handleZoomReset = () => {
    setCamera(1, 0, 0)
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

  const handleImageImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const href = ev.target?.result as string
      const img = new Image()
      img.onload = async () => {
        const docW = activeDocument.width
        const docH = activeDocument.height
        const maxW = docW * 0.8
        const maxH = docH * 0.8
        const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight)
        const w = Math.round(img.naturalWidth * scale)
        const h = Math.round(img.naturalHeight * scale)
        const x = Math.round((docW - w) / 2)
        const y = Math.round((docH - h) / 2)
        await runCommand('document.addImage', { href, x, y, width: w, height: h })
      }
      img.src = href
    }
    reader.readAsDataURL(file)
    e.target.value = ''
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
        height: 52,
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
      {/* Left group: nav + layers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button style={iconBtn()} onClick={() => navigate('home')} aria-label="Home">
          <ArrowLeft size={20} />
        </button>
        <button style={iconBtn()} onClick={() => void handleNew()} aria-label="New document">
          <FilePlus size={20} />
        </button>
        <button style={iconBtn(leftPanelOpen)} onClick={toggleLeftPanel} aria-label="Toggle layers">
          <Layers size={20} color={leftPanelOpen ? '#93c5fd' : undefined} />
        </button>
        <button style={iconBtn()} onClick={() => imageInputRef.current?.click()} aria-label="Import image">
          <ImagePlus size={20} />
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageImport} />
      </div>

      {/* Center: title (tap to open document settings) */}
      <button
        onClick={() => setDocSettingsOpen(true)}
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          minWidth: 0,
          color: 'rgba(255,255,255,0.9)',
          letterSpacing: '-0.01em',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 4px'
        }}
      >
        {title}
      </button>
      <DocumentSettingsSheet open={docSettingsOpen} onOpenChange={setDocSettingsOpen} />

      {/* Right group: undo/redo | zoom | inspector | save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          disabled={!canUndo}
          onClick={() => void handleUndo()}
          style={iconBtn(false, !canUndo)}
          aria-label="Undo"
        >
          <Undo2 size={18} />
        </button>
        <button
          disabled={!canRedo}
          onClick={() => void handleRedo()}
          style={iconBtn(false, !canRedo)}
          aria-label="Redo"
        >
          <Redo2 size={18} />
        </button>

        {/* Zoom controls: out | label (tap to reset) | in */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: '0 2px'
          }}
        >
          <button
            onClick={() => zoomAroundCenter(zoom - 0.1)}
            style={{ width: 30, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, flexShrink: 0 }}
            aria-label="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            onClick={handleZoomReset}
            style={{ height: 36, minWidth: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}
            aria-label="Reset zoom"
          >
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(zoom * 100)}%
            </span>
          </button>
          <button
            onClick={() => zoomAroundCenter(zoom + 0.1)}
            style={{ width: 30, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, flexShrink: 0 }}
            aria-label="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
        </div>

        <button style={iconBtn(rightPanelOpen)} onClick={toggleRightPanel} aria-label="Toggle inspector">
          <SlidersHorizontal size={20} color={rightPanelOpen ? '#93c5fd' : undefined} />
        </button>
        <button onClick={() => navigate('export')} style={iconBtn()} aria-label="Export SVG">
          <Download size={20} />
        </button>
        <button onClick={() => setSnapshotsOpen(true)} style={iconBtn()} aria-label="Snapshots">
          <History size={20} />
        </button>
        <button onClick={() => void handleSave()} style={iconBtn()} aria-label="Save">
          <Save size={20} />
        </button>
        <button onClick={() => navigate('settings')} style={iconBtn()} aria-label="Settings">
          <Settings size={20} />
        </button>
        <SnapshotsSheet open={snapshotsOpen} onOpenChange={setSnapshotsOpen} />
      </div>
    </header>
  )
}
