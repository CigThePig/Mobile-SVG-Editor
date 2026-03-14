export interface BaseResource {
  id: string
  name?: string
}

export interface SwatchResource extends BaseResource {
  type: 'swatch'
  color: string
}

export interface GradientStop {
  offset: number
  color: string
  opacity?: number
}

export interface GradientResource extends BaseResource {
  type: 'linearGradient' | 'radialGradient'
  stops: GradientStop[]
}

export interface PatternResource extends BaseResource {
  type: 'pattern'
}

export interface FilterResource extends BaseResource {
  type: 'filter'
}

export interface MarkerResource extends BaseResource {
  type: 'marker'
}

export interface SymbolResource extends BaseResource {
  type: 'symbol'
  rootNodeId?: string
}

export interface ComponentResource extends BaseResource {
  type: 'component'
  rootNodeId?: string
}

export interface TextStyleResource extends BaseResource {
  type: 'textStyle'
  style: Record<string, unknown>
}

export interface ExportSliceResource extends BaseResource {
  type: 'exportSlice'
  nodeIds: string[]
}

export interface ResourceStore {
  swatches: SwatchResource[]
  gradients: GradientResource[]
  patterns: PatternResource[]
  filters: FilterResource[]
  markers: MarkerResource[]
  symbols: SymbolResource[]
  components: ComponentResource[]
  textStyles: TextStyleResource[]
  exportSlices: ExportSliceResource[]
}
