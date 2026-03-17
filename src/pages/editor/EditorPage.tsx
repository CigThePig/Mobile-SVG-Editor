import { useEffect } from 'react'
import { EditorTopBar } from '@/components/layout/EditorTopBar'
import { EditorBottomBar } from '@/components/layout/EditorBottomBar'
import { ContextActionStrip } from '@/components/layout/ContextActionStrip'
import { CanvasViewport } from '@/features/canvas/components/CanvasViewport'
import { InspectorSheet } from '@/features/inspector/components/InspectorSheet'
import { LayersPanel } from '@/features/layers/components/LayersPanel'
import { SourceEditorSheet } from '@/features/source'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'

export function EditorPage() {
  const outlineModeDefault = useSettingsStore((s) => s.outlineModeDefault)
  const toggleOutlineMode = useEditorStore((s) => s.toggleOutlineMode)
  const outlineMode = useEditorStore((s) => s.view.outlineMode)

  // Initialize editor view from persisted settings on first mount
  useEffect(() => {
    if (outlineModeDefault !== outlineMode) {
      toggleOutlineMode()
    }
    const s = useSettingsStore.getState()
    useEditorStore.setState((state) => {
      state.view.snapConfig.gridSize = s.defaultGridSize
      state.view.snapConfig.angleSnapDegrees = s.angleSnapDegrees
      state.view.showGuides = s.showGuidesByDefault
      state.view.showGrid = s.showGridByDefault
    })
  // Only run once on mount — intentionally omitting deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Eagerly preload Paper.js during idle time so the first boolean
  // operation does not trigger a blocking network fetch
  useEffect(() => {
    const preload = () => { void import('paper') }
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(preload)
      return () => cancelIdleCallback(id)
    } else {
      const id = setTimeout(preload, 2000)
      return () => clearTimeout(id)
    }
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100dvh',
        paddingTop: 'var(--sai-top, 0px)',
        background: '#0a0a0a',
        color: '#ffffff'
      }}
    >
      <EditorTopBar />
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CanvasViewport />
      </div>
      <ContextActionStrip />
      <EditorBottomBar />
      <LayersPanel />
      <InspectorSheet />
      <SourceEditorSheet />
    </div>
  )
}
