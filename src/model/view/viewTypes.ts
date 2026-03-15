export interface SnapConfig {
  snapToGrid: boolean
  gridSize: number
  snapToPoints: boolean
  snapToBbox: boolean
  angleSnap: boolean
  angleSnapDegrees: number
}

export type GuideOrientation = 'horizontal' | 'vertical'

export interface Guide {
  id: string
  orientation: GuideOrientation
  position: number
}

export interface ViewState {
  zoom: number
  panX: number
  panY: number
  showGrid: boolean
  showGuides: boolean
  guides: Guide[]
  snapEnabled: boolean
  snapConfig: SnapConfig
  outlineMode: boolean
}
