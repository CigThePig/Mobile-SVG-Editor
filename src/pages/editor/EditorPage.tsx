import { EditorTopBar } from '@/components/layout/EditorTopBar'
import { EditorBottomBar } from '@/components/layout/EditorBottomBar'
import { ContextActionStrip } from '@/components/layout/ContextActionStrip'
import { CanvasViewport } from '@/features/canvas/components/CanvasViewport'
import { InspectorSheet } from '@/features/inspector/components/InspectorSheet'
import { LayersPanel } from '@/features/layers/components/LayersPanel'

export function EditorPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100dvh',
        background: '#0a0a0a',
        color: '#ffffff'
      }}
    >
      <EditorTopBar />
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CanvasViewport />
        <LayersPanel />
        <InspectorSheet />
      </div>
      <ContextActionStrip />
      <EditorBottomBar />
    </div>
  )
}
