import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { getEffectiveViewBox, clientPointToDocumentPoint } from '@/features/canvas/utils/viewBox'
import { useEditorStore } from '@/stores/editorStore'
import type { Guide } from '@/model/view/viewTypes'

export function CanvasGuidesLayer() {
  const document = useEditorStore((s) => s.activeDocument)
  const view = useEditorStore((s) => s.view)
  const moveGuide = useEditorStore((s) => s.moveGuide)
  const removeGuide = useEditorStore((s) => s.removeGuide)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const draggingRef = useRef<{ guideId: string; guide: Guide } | null>(null)

  const effectiveViewBox = getEffectiveViewBox(document, view)
  const { x, y, width, height } = effectiveViewBox

  const handlePointerDown = useCallback((e: ReactPointerEvent<SVGLineElement>, guide: Guide) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = { guideId: guide.id, guide }
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = draggingRef.current
      const svg = svgRef.current
      if (!drag || !svg) return
      const docPoint = clientPointToDocumentPoint(e.clientX, e.clientY, svg, getEffectiveViewBox(
        useEditorStore.getState().activeDocument,
        useEditorStore.getState().view
      ))
      const newPos = drag.guide.orientation === 'vertical' ? docPoint.x : docPoint.y
      moveGuide(drag.guideId, newPos)
    }

    const handlePointerUp = (e: PointerEvent) => {
      const drag = draggingRef.current
      if (!drag) return
      const svg = svgRef.current
      if (svg) {
        const vb = getEffectiveViewBox(
          useEditorStore.getState().activeDocument,
          useEditorStore.getState().view
        )
        const docPoint = clientPointToDocumentPoint(e.clientX, e.clientY, svg, vb)
        const pos = drag.guide.orientation === 'vertical' ? docPoint.x : docPoint.y
        // Remove guide if dragged far outside the document
        const docSize = drag.guide.orientation === 'vertical'
          ? useEditorStore.getState().activeDocument.width
          : useEditorStore.getState().activeDocument.height
        const docStart = drag.guide.orientation === 'vertical'
          ? useEditorStore.getState().activeDocument.viewBox.x
          : useEditorStore.getState().activeDocument.viewBox.y
        if (pos < docStart - 60 || pos > docStart + docSize + 60) {
          removeGuide(drag.guideId)
        }
      }
      draggingRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [moveGuide, removeGuide])

  if (!view.showGuides || view.guides.length === 0) return null

  const hitWidth = Math.max(12, 12 / view.zoom)

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`${x} ${y} ${width} ${height}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
    >
      {view.guides.map((guide) => {
        const x1 = guide.orientation === 'vertical' ? guide.position : x
        const y1 = guide.orientation === 'vertical' ? y : guide.position
        const x2 = guide.orientation === 'vertical' ? guide.position : x + width
        const y2 = guide.orientation === 'vertical' ? y + height : guide.position

        return (
          <g key={guide.id}>
            {/* Visible guide line */}
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(249,115,22,0.65)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
            {/* Wide invisible hit area */}
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="transparent"
              strokeWidth={hitWidth}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'stroke', cursor: guide.orientation === 'vertical' ? 'ew-resize' : 'ns-resize' }}
              onPointerDown={(e) => handlePointerDown(e, guide)}
            />
          </g>
        )
      })}
    </svg>
  )
}
