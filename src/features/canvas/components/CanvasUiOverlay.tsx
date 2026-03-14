export function CanvasUiOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        display: 'flex',
        gap: 8,
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          borderRadius: 12,
          background: 'rgba(0,0,0,0.4)',
          fontSize: 12,
          color: 'rgba(255,255,255,0.8)'
        }}
      >
        Canvas
      </div>
    </div>
  )
}
