import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from 'react'
import type { SvgDocument } from '@/model/document/documentTypes'
import type {
  CircleNode,
  EllipseNode,
  LineNode,
  PathNode,
  PolygonNode,
  PolylineNode,
  RectNode,
  SvgNode,
  TextNode,
  TransformModel
} from '@/model/nodes/nodeTypes'
import { cloneDocument, moveNodesInDocument } from '@/features/documents/utils/documentMutations'
import { clientPointToDocumentPoint, getEffectiveViewBox } from '@/features/canvas/utils/viewBox'
import { boundsIntersect, collectSelectableNodes, getNodeBounds, normalizeBounds, type NodeBounds } from '@/features/selection/utils/nodeBounds'
import { saveDocument } from '@/db/dexie/queries'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'

function fillFromNode(node: { style?: { fill?: { kind: string; color?: string } } }) {
  if (!node.style?.fill) return 'transparent'
  if (node.style.fill.kind === 'none') return 'transparent'
  if (node.style.fill.kind === 'solid') return node.style.fill.color ?? '#ffffff'
  return '#ffffff'
}

function strokeFromNode(node: { style?: { stroke?: { color?: string; width: number } } }) {
  return {
    stroke: node.style?.stroke?.color ?? 'transparent',
    strokeWidth: node.style?.stroke?.width ?? 0
  }
}

function transformToSvgString(transform?: TransformModel) {
  if (!transform) return undefined
  const parts: string[] = []

  if (transform.translateX || transform.translateY) {
    parts.push(`translate(${transform.translateX ?? 0} ${transform.translateY ?? 0})`)
  }

  if (transform.pivotX != null && transform.pivotY != null) {
    parts.push(`translate(${transform.pivotX} ${transform.pivotY})`)
  }

  if (transform.rotate) {
    parts.push(`rotate(${transform.rotate})`)
  }

  if (transform.scaleX != null || transform.scaleY != null) {
    parts.push(`scale(${transform.scaleX ?? 1} ${transform.scaleY ?? 1})`)
  }

  if (transform.skewX) parts.push(`skewX(${transform.skewX})`)
  if (transform.skewY) parts.push(`skewY(${transform.skewY})`)

  if (transform.pivotX != null && transform.pivotY != null) {
    parts.push(`translate(${-transform.pivotX} ${-transform.pivotY})`)
  }

  return parts.length ? parts.join(' ') : undefined
}

function renderNode(node: SvgNode, selectedIds: string[], onPointerDown: (event: ReactPointerEvent<SVGElement>, id: string) => void): ReactNode {
  if (node.visible === false) return null
  const isSelected = selectedIds.includes(node.id)
  const common = {
    key: node.id,
    onPointerDown: (event: ReactPointerEvent<SVGElement>) => {
      event.stopPropagation()
      onPointerDown(event, node.id)
    },
    style: { cursor: 'pointer' },
    opacity: isSelected ? 0.9 : 1,
    transform: transformToSvgString(node.transform)
  }

  switch (node.type) {
    case 'rect': {
      const n = node as RectNode
      const { stroke, strokeWidth } = strokeFromNode(n)
      return <rect {...common} x={n.x} y={n.y} width={n.width} height={n.height} rx={n.rx} ry={n.ry} fill={fillFromNode(n)} stroke={stroke} strokeWidth={strokeWidth} />
    }
    case 'circle': {
      const n = node as CircleNode
      const { stroke, strokeWidth } = strokeFromNode(n)
      return <circle {...common} cx={n.cx} cy={n.cy} r={n.r} fill={fillFromNode(n)} stroke={stroke} strokeWidth={strokeWidth} />
    }
    case 'ellipse': {
      const n = node as EllipseNode
      const { stroke, strokeWidth } = strokeFromNode(n)
      return <ellipse {...common} cx={n.cx} cy={n.cy} rx={n.rx} ry={n.ry} fill={fillFromNode(n)} stroke={stroke} strokeWidth={strokeWidth} />
    }
    case 'line': {
      const n = node as LineNode
      const { stroke, strokeWidth } = strokeFromNode(n)
      return <line {...common} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={stroke} strokeWidth={strokeWidth || 2} />
    }
    case 'polyline': {
      const n = node as PolylineNode
      const { stroke, strokeWidth } = strokeFromNode(n)
      return <polyline {...common} points={n.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
    }
    case 'polygon': {
      const n = node as PolygonNode
      const { stroke, strokeWidth } = strokeFromNode(n)
      return <polygon {...common} points={n.points.map((p) => `${p.x},${p.y}`).join(' ')} fill={fillFromNode(n)} stroke={stroke} strokeWidth={strokeWidth} />
    }
    case 'path': {
      const n = node as PathNode
      const { stroke, strokeWidth } = strokeFromNode(n)
      return <path {...common} d={n.d} fill={fillFromNode(n)} stroke={stroke} strokeWidth={strokeWidth} />
    }
    case 'text': {
      const n = node as TextNode
      const { stroke, strokeWidth } = strokeFromNode(n)
      return (
        <text {...common} x={n.x} y={n.y} fill={fillFromNode(n)} stroke={stroke} strokeWidth={strokeWidth} fontFamily={n.textStyle?.fontFamily} fontSize={n.textStyle?.fontSize}>
          {n.content}
        </text>
      )
    }
    case 'group':
    case 'root':
      return (
        <g key={node.id} transform={transformToSvgString(node.transform)} opacity={isSelected ? 0.9 : 1}>
          {node.children?.map((child) => renderNode(child, selectedIds, onPointerDown))}
        </g>
      )
    default:
      return null
  }
}

type PointerSnapshot = { clientX: number; clientY: number }

type InteractionState =
  | {
      kind: 'drag-selection'
      nodeIds: string[]
      originX: number
      originY: number
      startDocument: SvgDocument
      moved: boolean
    }
  | {
      kind: 'pan-canvas'
      originX: number
      originY: number
      startPanX: number
      startPanY: number
      moved: boolean
    }
  | {
      kind: 'marquee-select'
      origin: { x: number; y: number }
      append: boolean
      moved: boolean
    }
  | null

type PinchState = {
  startZoom: number
  startPanX: number
  startPanY: number
  startDistance: number
  anchorDocumentPoint: { x: number; y: number }
} | null

function getDistance(a: PointerSnapshot, b: PointerSnapshot) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function getMidpoint(a: PointerSnapshot, b: PointerSnapshot) {
  return {
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2
  }
}

function applyZoomAtClientPoint(
  svg: SVGSVGElement,
  document: SvgDocument,
  anchorDocumentPoint: { x: number; y: number },
  clientX: number,
  clientY: number,
  nextZoom: number
) {
  const rect = svg.getBoundingClientRect()
  const fx = (clientX - rect.left) / rect.width
  const fy = (clientY - rect.top) / rect.height
  const nextWidth = document.viewBox.width / nextZoom
  const nextHeight = document.viewBox.height / nextZoom
  return {
    zoom: nextZoom,
    panX: anchorDocumentPoint.x - document.viewBox.x - fx * nextWidth,
    panY: anchorDocumentPoint.y - document.viewBox.y - fy * nextHeight
  }
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids))
}

export function CanvasArtworkLayer() {
  const document = useEditorStore((s) => s.activeDocument)
  const view = useEditorStore((s) => s.view)
  const mode = useEditorStore((s) => s.mode)
  const selectedIds = useEditorStore((s) => s.selection.selectedNodeIds)
  const multiSelectEnabled = useEditorStore((s) => s.ui.multiSelectEnabled)
  const setSelection = useEditorStore((s) => s.setSelection)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const setPan = useEditorStore((s) => s.setPan)
  const setMarqueeRect = useEditorStore((s) => s.setMarqueeRect)
  const replaceDocument = useEditorStore((s) => s.replaceDocument)
  const pushSnapshot = useHistoryStore((s) => s.pushSnapshot)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const interactionRef = useRef<InteractionState>(null)
  const pinchRef = useRef<PinchState>(null)
  const activePointersRef = useRef<Map<number, PointerSnapshot>>(new Map())
  const effectiveViewBox = useMemo(() => getEffectiveViewBox(document, view), [document, view])

  const finishInteraction = useCallback(async () => {
    const interaction = interactionRef.current
    if (!interaction) return

    if (interaction.kind === 'drag-selection' && interaction.moved) {
      const afterDocument = cloneDocument(useEditorStore.getState().activeDocument)
      pushSnapshot(interaction.nodeIds.length > 1 ? 'Move Selection' : 'Move Object', interaction.startDocument, afterDocument)
      await saveDocument(afterDocument)
    }

    if (interaction.kind === 'marquee-select') {
      setMarqueeRect(null)
    }

    interactionRef.current = null
  }, [pushSnapshot, setMarqueeRect])

  const maybeBeginPinch = useCallback(
    (clientX?: number, clientY?: number) => {
      const svg = svgRef.current
      if (!svg) return

      const pointers = Array.from(activePointersRef.current.values())
      if (pointers.length !== 2) return

      const [a, b] = pointers
      const midpoint = getMidpoint(a, b)
      const startEffectiveViewBox = getEffectiveViewBox(document, useEditorStore.getState().view)
      const anchorDocumentPoint = clientPointToDocumentPoint(midpoint.clientX, midpoint.clientY, svg, startEffectiveViewBox)

      pinchRef.current = {
        startZoom: useEditorStore.getState().view.zoom,
        startPanX: useEditorStore.getState().view.panX,
        startPanY: useEditorStore.getState().view.panY,
        startDistance: Math.max(1, getDistance(a, b)),
        anchorDocumentPoint
      }

      interactionRef.current = null
      setMarqueeRect(null)

      if (clientX != null && clientY != null) {
        const result = applyZoomAtClientPoint(svg, document, anchorDocumentPoint, clientX, clientY, useEditorStore.getState().view.zoom)
        useEditorStore.getState().setCamera(result.zoom, result.panX, result.panY)
      }
    },
    [document, setMarqueeRect]
  )

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (activePointersRef.current.has(event.pointerId)) {
        activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
      }

      const svg = svgRef.current
      if (!svg) return

      if (activePointersRef.current.size >= 2) {
        if (!pinchRef.current) maybeBeginPinch(event.clientX, event.clientY)
        const pinch = pinchRef.current
        const pointers = Array.from(activePointersRef.current.values())
        if (!pinch || pointers.length < 2) return

        const [a, b] = pointers
        const midpoint = getMidpoint(a, b)
        const nextZoom = Math.min(4, Math.max(0.25, pinch.startZoom * (getDistance(a, b) / pinch.startDistance)))
        const result = applyZoomAtClientPoint(svg, document, pinch.anchorDocumentPoint, midpoint.clientX, midpoint.clientY, nextZoom)
        useEditorStore.getState().setCamera(result.zoom, result.panX, result.panY)
        return
      }

      const interaction = interactionRef.current
      if (!interaction) return

      if (interaction.kind === 'drag-selection') {
        const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBox)
        const dx = point.x - interaction.originX
        const dy = point.y - interaction.originY
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) interaction.moved = true
        const nextDocument = moveNodesInDocument(interaction.startDocument, interaction.nodeIds, dx, dy)
        replaceDocument(nextDocument)
        return
      }

      if (interaction.kind === 'pan-canvas') {
        const rect = svg.getBoundingClientRect()
        const unitsPerPixelX = effectiveViewBox.width / rect.width
        const unitsPerPixelY = effectiveViewBox.height / rect.height
        const dx = (event.clientX - interaction.originX) * unitsPerPixelX
        const dy = (event.clientY - interaction.originY) * unitsPerPixelY
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) interaction.moved = true
        setPan(interaction.startPanX - dx, interaction.startPanY - dy)
        return
      }

      if (interaction.kind === 'marquee-select') {
        const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBox)
        const rect = normalizeBounds({
          x: interaction.origin.x,
          y: interaction.origin.y,
          width: point.x - interaction.origin.x,
          height: point.y - interaction.origin.y
        })
        interaction.moved = rect.width > 1 || rect.height > 1
        setMarqueeRect(rect)
      }
    }

    const handlePointerUp = (event: PointerEvent) => {
      activePointersRef.current.delete(event.pointerId)
      if (activePointersRef.current.size < 2) pinchRef.current = null

      const interaction = interactionRef.current
      if (interaction?.kind === 'marquee-select') {
        const marqueeRect = useEditorStore.getState().ui.marqueeRect
        if (interaction.moved && marqueeRect) {
          const matchedIds = collectSelectableNodes(useEditorStore.getState().activeDocument.root)
            .filter((node) => {
              const bounds = getNodeBounds(node)
              return bounds ? boundsIntersect(bounds, marqueeRect) : false
            })
            .map((node) => node.id)

          if (interaction.append) {
            setSelection(uniqueIds([...useEditorStore.getState().selection.selectedNodeIds, ...matchedIds]))
          } else {
            setSelection(matchedIds)
          }
        } else if (!interaction.append) {
          clearSelection()
        }
      }

      void finishInteraction()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [document, effectiveViewBox, finishInteraction, maybeBeginPinch, replaceDocument, setPan, setMarqueeRect, setSelection, clearSelection])

  const handleNodePointerDown = (event: ReactPointerEvent<SVGElement>, id: string) => {
    const svg = svgRef.current
    if (!svg) return

    activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
    if (activePointersRef.current.size >= 2) {
      void finishInteraction()
      maybeBeginPinch(event.clientX, event.clientY)
      return
    }

    const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBox)
    const additive = multiSelectEnabled || event.shiftKey
    const isAlreadySelected = selectedIds.includes(id)
    const nextSelection = additive
      ? isAlreadySelected
        ? selectedIds.filter((existing) => existing !== id)
        : uniqueIds([...selectedIds, id])
      : isAlreadySelected && selectedIds.length === 1
        ? selectedIds
        : [id]
    setSelection(nextSelection)
    setMarqueeRect(null)

    if (mode === 'select') {
      interactionRef.current = {
        kind: 'drag-selection',
        nodeIds: nextSelection,
        originX: point.x,
        originY: point.y,
        startDocument: cloneDocument(document),
        moved: false
      }
    }
  }

  const handleBackgroundPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
    if (activePointersRef.current.size >= 2) {
      void finishInteraction()
      maybeBeginPinch(event.clientX, event.clientY)
      return
    }

    const svg = svgRef.current
    if (!svg) return

    if (mode === 'navigate') {
      interactionRef.current = {
        kind: 'pan-canvas',
        originX: event.clientX,
        originY: event.clientY,
        startPanX: view.panX,
        startPanY: view.panY,
        moved: false
      }
      return
    }

    if (mode === 'select') {
      const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBox)
      interactionRef.current = {
        kind: 'marquee-select',
        origin: point,
        append: multiSelectEnabled || event.shiftKey,
        moved: false
      }
      setMarqueeRect({ x: point.x, y: point.y, width: 1, height: 1 })
      return
    }

    clearSelection()
    interactionRef.current = null
    setMarqueeRect(null)
  }

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const svg = svgRef.current
    if (!svg) return

    const delta = event.deltaY > 0 ? -0.1 : 0.1
    const currentZoom = view.zoom
    const nextZoom = Math.min(4, Math.max(0.25, currentZoom + delta))
    if (nextZoom === currentZoom) return

    const anchor = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBox)
    const result = applyZoomAtClientPoint(svg, document, anchor, event.clientX, event.clientY, nextZoom)
    useEditorStore.getState().setCamera(result.zoom, result.panX, result.panY)
  }

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`${effectiveViewBox.x} ${effectiveViewBox.y} ${effectiveViewBox.width} ${effectiveViewBox.height}`}
      onPointerDown={handleBackgroundPointerDown}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
    >
      {document.root.children.map((node) => renderNode(node, selectedIds, handleNodePointerDown))}
    </svg>
  )
}
