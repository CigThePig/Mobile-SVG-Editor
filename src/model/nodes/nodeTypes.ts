export type SvgNodeType =
  | 'root'
  | 'group'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'polygon'
  | 'path'
  | 'text'
  | 'image'
  | 'symbol'
  | 'use'
  | 'clipPath'
  | 'mask'
  | 'marker'

export interface TransformModel {
  translateX?: number
  translateY?: number
  scaleX?: number
  scaleY?: number
  rotate?: number
  skewX?: number
  skewY?: number
  pivotX?: number
  pivotY?: number
  matrix?: [number, number, number, number, number, number]
}

export type PaintModel =
  | { kind: 'none' }
  | { kind: 'solid'; color: string; opacity?: number }
  | { kind: 'gradient'; resourceId: string }
  | { kind: 'pattern'; resourceId: string }

export interface StrokeModel {
  color?: string
  width: number
  opacity?: number
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'miter' | 'round' | 'bevel'
  miterLimit?: number
  dashArray?: number[]
  dashOffset?: number
  nonScaling?: boolean
}

export interface AppearanceModel {
  fill?: PaintModel
  stroke?: StrokeModel
  opacity?: number
  blendMode?: string
  filterRef?: string
  maskRef?: string
  clipPathRef?: string
  markerStartRef?: string
  markerMidRef?: string
  markerEndRef?: string
}

export interface TextStyleModel {
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  fontStyle?: 'normal' | 'italic' | 'oblique'
  lineHeight?: number
  letterSpacing?: number
  textAlign?: 'left' | 'center' | 'right'
}

export interface BaseNode {
  id: string
  type: SvgNodeType
  name?: string
  visible: boolean
  locked: boolean
  opacity?: number
  className?: string
  attributes?: Record<string, string>
  transform?: TransformModel
  children?: SvgNode[]
}

export interface RootNode extends BaseNode {
  type: 'root'
  children: SvgNode[]
}

export interface GroupNode extends BaseNode {
  type: 'group'
  children: SvgNode[]
}

export interface RectNode extends BaseNode {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
  rx?: number
  ry?: number
  style?: AppearanceModel
}

export interface CircleNode extends BaseNode {
  type: 'circle'
  cx: number
  cy: number
  r: number
  style?: AppearanceModel
}

export interface EllipseNode extends BaseNode {
  type: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
  style?: AppearanceModel
}

export interface LineNode extends BaseNode {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  style?: AppearanceModel
}

export interface PolylineNode extends BaseNode {
  type: 'polyline'
  points: Array<{ x: number; y: number }>
  style?: AppearanceModel
}

export interface PolygonNode extends BaseNode {
  type: 'polygon'
  points: Array<{ x: number; y: number }>
  style?: AppearanceModel
}

export interface PathNode extends BaseNode {
  type: 'path'
  d: string
  style?: AppearanceModel
}

export interface TextNode extends BaseNode {
  type: 'text'
  x: number
  y: number
  content: string
  textStyle?: TextStyleModel
  style?: AppearanceModel
}

export interface ImageNode extends BaseNode {
  type: 'image'
  x: number
  y: number
  width: number
  height: number
  href: string
}

export type SvgNode =
  | RootNode
  | GroupNode
  | RectNode
  | CircleNode
  | EllipseNode
  | LineNode
  | PolylineNode
  | PolygonNode
  | PathNode
  | TextNode
  | ImageNode
