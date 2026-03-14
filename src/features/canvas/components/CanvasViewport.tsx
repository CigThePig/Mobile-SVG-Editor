import { CanvasArtworkLayer } from './CanvasArtworkLayer'
import { CanvasOverlayLayer } from './CanvasOverlayLayer'
import { CanvasUiOverlay } from './CanvasUiOverlay'

export function CanvasViewport() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0d0d0d' }}>
      <CanvasArtworkLayer />
      <CanvasOverlayLayer />
      <CanvasUiOverlay />
    </div>
  )
}
