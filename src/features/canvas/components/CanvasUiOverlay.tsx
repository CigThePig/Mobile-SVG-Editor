import { useEditorStore } from '@/stores/editorStore'

export function CanvasUiOverlay() {
  const zoom = useEditorStore((s) => s.view.zoom)
  const showGrid = useEditorStore((s) => s.view.showGrid)
  const snapEnabled = useEditorStore((s) => s.view.snapEnabled)
  const toggleGrid = useEditorStore((s) => s.toggleGrid)
  const toggleSnapEnabled = useEditorStore((s) => s.toggleSnapEnabled)

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
    </div>
  )
}
