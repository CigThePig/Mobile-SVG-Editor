import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SettingsState {
  defaultGridSize: number
  snapThresholdPx: number
  angleSnapDegrees: number
  outlineModeDefault: boolean
  defaultExportScale: number
  setDefaultGridSize: (v: number) => void
  setSnapThresholdPx: (v: number) => void
  setAngleSnapDegrees: (v: number) => void
  setOutlineModeDefault: (v: boolean) => void
  setDefaultExportScale: (v: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultGridSize: 10,
      snapThresholdPx: 8,
      angleSnapDegrees: 15,
      outlineModeDefault: false,
      defaultExportScale: 1,
      setDefaultGridSize: (v) => set({ defaultGridSize: Math.max(1, v) }),
      setSnapThresholdPx: (v) => set({ snapThresholdPx: Math.max(4, Math.min(40, v)) }),
      setAngleSnapDegrees: (v) => set({ angleSnapDegrees: v }),
      setOutlineModeDefault: (v) => set({ outlineModeDefault: v }),
      setDefaultExportScale: (v) => set({ defaultExportScale: v })
    }),
    { name: 'svg-editor-settings' }
  )
)
