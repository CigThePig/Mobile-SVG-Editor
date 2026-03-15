import { useMemo } from 'react'
import { getEffectiveViewBox } from '@/features/canvas/utils/viewBox'
import { useEditorStore } from '@/stores/editorStore'

export function CanvasGridLayer() {
  const document = useEditorStore((s) => s.activeDocument)
  const view = useEditorStore((s) => s.view)

  const effectiveViewBox = useMemo(() => getEffectiveViewBox(document, view), [document, view])

  if (!view.showGrid) return null

  const gridSize = Math.max(1, view.snapConfig.gridSize)
  const { x, y, width, height } = effectiveViewBox

  const startX = Math.floor(x / gridSize) * gridSize
  const endX = Math.ceil((x + width) / gridSize) * gridSize
  const startY = Math.floor(y / gridSize) * gridSize
  const endY = Math.ceil((y + height) / gridSize) * gridSize

  const verticalLines: number[] = []
  for (let vx = startX; vx <= endX; vx += gridSize) {
    verticalLines.push(vx)
  }

  const horizontalLines: number[] = []
  for (let hy = startY; hy <= endY; hy += gridSize) {
    horizontalLines.push(hy)
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`${x} ${y} ${width} ${height}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {verticalLines.map((vx) => (
        <line
          key={`v-${vx}`}
          x1={vx}
          y1={y}
          x2={vx}
          y2={y + height}
          stroke="rgba(99,102,241,0.18)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {horizontalLines.map((hy) => (
        <line
          key={`h-${hy}`}
          x1={x}
          y1={hy}
          x2={x + width}
          y2={hy}
          stroke="rgba(99,102,241,0.18)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {/* Canvas document border */}
      <rect
        x={document.viewBox.x}
        y={document.viewBox.y}
        width={document.viewBox.width}
        height={document.viewBox.height}
        fill="none"
        stroke="rgba(99,102,241,0.4)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
