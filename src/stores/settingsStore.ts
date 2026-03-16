// Settings sync decision (Phase 8): settingsStore intentionally persists to
// localStorage rather than Dexie/IndexedDB. Settings are device-local preferences
// (grid size, snap thresholds, etc.) that don't require cross-browser sync.
// Documents and guides are persisted per-document in Dexie via PerDocumentEditorState.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SettingsState {
  defaultGridSize: number
  snapThresholdPx: number
  angleSnapDegrees: number
  outlineModeDefault: boolean
  defaultExportScale: number
  showGuidesByDefault: boolean
  showGridByDefault: boolean
  setDefaultGridSize: (v: number) => void
  setSnapThresholdPx: (v: number) => void
  setAngleSnapDegrees: (v: number) => void
  setOutlineModeDefault: (v: boolean) => void
  setDefaultExportScale: (v: number) => void
  setShowGuidesByDefault: (v: boolean) => void
  setShowGridByDefault: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultGridSize: 10,
      snapThresholdPx: 8,
      angleSnapDegrees: 15,
      outlineModeDefault: false,
      defaultExportScale: 1,
      showGuidesByDefault: true,
      showGridByDefault: false,
      setDefaultGridSize: (v) => set({ defaultGridSize: Math.max(1, v) }),
      setSnapThresholdPx: (v) => set({ snapThresholdPx: Math.max(4, Math.min(40, v)) }),
      setAngleSnapDegrees: (v) => set({ angleSnapDegrees: v }),
      setOutlineModeDefault: (v) => set({ outlineModeDefault: v }),
      setDefaultExportScale: (v) => set({ defaultExportScale: v }),
      setShowGuidesByDefault: (v) => set({ showGuidesByDefault: v }),
      setShowGridByDefault: (v) => set({ showGridByDefault: v })
    }),
    { name: 'svg-editor-settings' }
  )
)
