export interface SnapConfig {
  snapToGrid: boolean
  gridSize: number
  snapToPoints: boolean
  snapToBbox: boolean
  angleSnap: boolean
  angleSnapDegrees: number
}

export interface ViewState {
  zoom: number
  panX: number
  panY: number
  showGrid: boolean
  showGuides: boolean
  snapEnabled: boolean
  snapConfig: SnapConfig
  outlineMode: boolean
}
