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
  const addGuide = useEditorStore((s) => s.addGuide)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const draggingRef = useRef<{ guideId: string; guide: Guide } | null>(null)
  // Ruler strip drag state: tracks a newly-created guide being dragged from a ruler strip
  const rulerDragRef = useRef<{ guideId: string } | null>(null)
  const topStripRef = useRef<HTMLDivElement | null>(null)
  const leftStripRef = useRef<HTMLDivElement | null>(null)

  const effectiveViewBox = getEffectiveViewBox(document, view)
  const { x, y, width, height } = effectiveViewBox

  const handlePointerDown = useCallback((e: ReactPointerEvent<SVGLineElement>, guide: Guide) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = { guideId: guide.id, guide }
  }, [])

  // Convert a client position to document space using the viewport container bounds
  function clientToDocPoint(clientX: number, clientY: number) {
    const container = topStripRef.current?.parentElement
    if (!container) return null
    const rect = container.getBoundingClientRect()
    const vb = getEffectiveViewBox(
      useEditorStore.getState().activeDocument,
      useEditorStore.getState().view
    )
    return {
      x: vb.x + ((clientX - rect.left) / rect.width) * vb.width,
      y: vb.y + ((clientY - rect.top) / rect.height) * vb.height
    }
  }

  const handleTopStripPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const docPt = clientToDocPoint(e.clientX, e.clientY)
    if (!docPt) return
    // Create a horizontal guide at cursor Y and start dragging it
    addGuide('horizontal', docPt.y)
    // After addGuide, the new guide will be the last one in view.guides
    const guides = useEditorStore.getState().view.guides
    const newGuide = guides[guides.length - 1]
    if (!newGuide) return
    rulerDragRef.current = { guideId: newGuide.id }
    // Ensure guides are visible
    if (!useEditorStore.getState().view.showGuides) {
      useEditorStore.getState().toggleGuides()
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [addGuide])

  const handleLeftStripPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const docPt = clientToDocPoint(e.clientX, e.clientY)
    if (!docPt) return
    // Create a vertical guide at cursor X and start dragging it
    addGuide('vertical', docPt.x)
    const guides = useEditorStore.getState().view.guides
    const newGuide = guides[guides.length - 1]
    if (!newGuide) return
    rulerDragRef.current = { guideId: newGuide.id }
    if (!useEditorStore.getState().view.showGuides) {
      useEditorStore.getState().toggleGuides()
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [addGuide])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // Handle ruler strip drag (new guide being positioned)
      const rulerDrag = rulerDragRef.current
      if (rulerDrag) {
        const docPt = clientToDocPoint(e.clientX, e.clientY)
        if (!docPt) return
        const guides = useEditorStore.getState().view.guides
        const guide = guides.find((g) => g.id === rulerDrag.guideId)
        if (!guide) return
        const newPos = guide.orientation === 'vertical' ? docPt.x : docPt.y
        moveGuide(rulerDrag.guideId, newPos)
        return
      }

      // Handle existing guide drag
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
      // Finalize ruler strip drag
      if (rulerDragRef.current) {
        rulerDragRef.current = null
        return
      }

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

  const hitWidth = Math.max(12, 12 / view.zoom)

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Ruler strips — always present so users can drag to create guides */}
      <div
        ref={topStripRef}
        onPointerDown={handleTopStripPointerDown}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          cursor: 'ns-resize',
          zIndex: 10,
          pointerEvents: 'all',
          background: 'rgba(255,255,255,0.04)'
        }}
        title="Drag to create horizontal guide"
      />
      <div
        ref={leftStripRef}
        onPointerDown={handleLeftStripPointerDown}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 8,
          cursor: 'ew-resize',
          zIndex: 10,
          pointerEvents: 'all',
          background: 'rgba(255,255,255,0.04)'
        }}
        title="Drag to create vertical guide"
      />

      {/* Guide lines SVG */}
      {view.showGuides && view.guides.length > 0 && (
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
      )}
    </div>
  )
}
