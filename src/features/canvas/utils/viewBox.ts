import type { SvgDocument } from '@/model/document/documentTypes'
import type { ViewState } from '@/model/view/viewTypes'

export interface EffectiveViewBox {
  x: number
  y: number
  width: number
  height: number
}

export function getEffectiveViewBox(document: SvgDocument, view: ViewState): EffectiveViewBox {
  const zoom = Math.max(0.1, view.zoom)
  const width = document.viewBox.width / zoom
  const height = document.viewBox.height / zoom

  return {
    x: document.viewBox.x + view.panX,
    y: document.viewBox.y + view.panY,
    width,
    height
  }
}

export function clientPointToDocumentPoint(
  clientX: number,
  clientY: number,
  element: SVGSVGElement,
  effectiveViewBox: EffectiveViewBox
) {
  const rect = element.getBoundingClientRect()
  const x = effectiveViewBox.x + ((clientX - rect.left) / rect.width) * effectiveViewBox.width
  const y = effectiveViewBox.y + ((clientY - rect.top) / rect.height) * effectiveViewBox.height
  return { x, y }
}
