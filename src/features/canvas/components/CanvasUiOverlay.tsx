import { useEditorStore } from '@/stores/editorStore'

export function CanvasUiOverlay() {
  const zoom = useEditorStore((s) => s.view.zoom)
  const showGrid = useEditorStore((s) => s.view.showGrid)
  const showGuides = useEditorStore((s) => s.view.showGuides)
  const snapEnabled = useEditorStore((s) => s.view.snapEnabled)
  const outlineMode = useEditorStore((s) => s.view.outlineMode)
  const toggleGrid = useEditorStore((s) => s.toggleGrid)
  const toggleGuides = useEditorStore((s) => s.toggleGuides)
  const toggleSnapEnabled = useEditorStore((s) => s.toggleSnapEnabled)
  const toggleOutlineMode = useEditorStore((s) => s.toggleOutlineMode)
  const addGuide = useEditorStore((s) => s.addGuide)
  const activeDocument = useEditorStore((s) => s.activeDocument)

  const addHGuide = () => {
    const centerY = activeDocument.viewBox.y + activeDocument.viewBox.height / 2
    addGuide('horizontal', centerY)
    if (!showGuides) useEditorStore.getState().toggleGuides()
  }
  const addVGuide = () => {
    const centerX = activeDocument.viewBox.x + activeDocument.viewBox.width / 2
    addGuide('vertical', centerX)
    if (!showGuides) useEditorStore.getState().toggleGuides()
  }

  const pillStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 10,
    background: 'rgba(0,0,0,0.45)',
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    pointerEvents: 'all',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    userSelect: 'none',
    WebkitUserSelect: 'none'
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        display: 'flex',
        gap: 6,
        pointerEvents: 'none'
      }}
    >
      {/* Zoom display */}
      <div style={{ ...pillStyle, cursor: 'default', pointerEvents: 'none' }}>
        {Math.round(zoom * 100)}%
      </div>

      {/* Grid toggle */}
      <button
        style={{
          ...pillStyle,
          color: showGrid ? '#818cf8' : 'rgba(255,255,255,0.55)',
          background: showGrid ? 'rgba(99,102,241,0.2)' : 'rgba(0,0,0,0.45)'
        }}
        onClick={toggleGrid}
        title="Toggle grid"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="1" width="5" height="5" />
          <rect x="8" y="1" width="5" height="5" />
          <rect x="1" y="8" width="5" height="5" />
          <rect x="8" y="8" width="5" height="5" />
        </svg>
        Grid
      </button>

      {/* Guides toggle */}
      <button
        style={{
          ...pillStyle,
          color: showGuides ? '#f97316' : 'rgba(255,255,255,0.55)',
          background: showGuides ? 'rgba(249,115,22,0.18)' : 'rgba(0,0,0,0.45)'
        }}
        onClick={toggleGuides}
        title="Toggle guides"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="7" y1="1" x2="7" y2="13" />
          <line x1="1" y1="5" x2="13" y2="5" />
        </svg>
        Guides
      </button>

      {/* Add guide buttons */}
      <button
        style={{ ...pillStyle, color: 'rgba(255,255,255,0.55)', padding: '6px 8px' }}
        onClick={addHGuide}
        title="Add horizontal guide"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="1" y1="7" x2="13" y2="7" />
          <line x1="6" y1="4" x2="8" y2="4" strokeDasharray="2 1" />
          <line x1="6" y1="10" x2="8" y2="10" strokeDasharray="2 1" />
        </svg>
        +H
      </button>
      <button
        style={{ ...pillStyle, color: 'rgba(255,255,255,0.55)', padding: '6px 8px' }}
        onClick={addVGuide}
        title="Add vertical guide"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="7" y1="1" x2="7" y2="13" />
          <line x1="4" y1="6" x2="4" y2="8" strokeDasharray="2 1" />
          <line x1="10" y1="6" x2="10" y2="8" strokeDasharray="2 1" />
        </svg>
        +V
      </button>

      {/* Snap toggle */}
      <button
        style={{
          ...pillStyle,
          color: snapEnabled ? '#34d399' : 'rgba(255,255,255,0.55)',
          background: snapEnabled ? 'rgba(52,211,153,0.15)' : 'rgba(0,0,0,0.45)'
        }}
        onClick={toggleSnapEnabled}
        title="Toggle snap"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="2" />
          <line x1="7" y1="1" x2="7" y2="4" />
          <line x1="7" y1="10" x2="7" y2="13" />
          <line x1="1" y1="7" x2="4" y2="7" />
          <line x1="10" y1="7" x2="13" y2="7" />
        </svg>
        Snap
      </button>

      {/* Outline mode toggle */}
      <button
        style={{
          ...pillStyle,
          color: outlineMode ? '#e879f9' : 'rgba(255,255,255,0.55)',
          background: outlineMode ? 'rgba(232,121,249,0.18)' : 'rgba(0,0,0,0.45)'
        }}
        onClick={toggleOutlineMode}
        title="Toggle outline mode"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="10" height="10" rx="1" />
          <circle cx="7" cy="7" r="2.5" />
        </svg>
        Outline
      </button>
    </div>
  )
}
