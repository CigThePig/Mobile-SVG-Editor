import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from 'react'
import { nanoid } from 'nanoid'
import type { SvgDocument } from '@/model/document/documentTypes'
import type {
  CircleNode,
  EllipseNode,
  LineNode,
  PathNode,
  PolygonNode,
  PolylineNode,
  RectNode,
  StarNode,
  SvgNode,
  TextNode,
  TransformModel
} from '@/model/nodes/nodeTypes'
import { cloneDocument, getNodeById, moveNodesInDocument } from '@/features/documents/utils/documentMutations'
import { clientPointToDocumentPoint, getEffectiveViewBox } from '@/features/canvas/utils/viewBox'
import { boundsIntersect, collectSelectableNodes, getNodeBounds, normalizeBounds, type NodeBounds } from '@/features/selection/utils/nodeBounds'
import { saveDocument } from '@/db/dexie/queries'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { runCommand } from '@/features/documents/services/commandRunner'
import { parsePathD, serializePathD } from '@/features/path/utils/pathGeometry'

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

function computeStarPoints(cx: number, cy: number, outer: number, inner: number, n: number): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const angle = (Math.PI / n) * i - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return pts.join(' ')
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
    case 'star': {
      const n = node as StarNode
      const { stroke, strokeWidth } = strokeFromNode(n)
      const pts = computeStarPoints(n.cx, n.cy, n.outerRadius, n.innerRadius, n.numPoints)
      return <polygon {...common} points={pts} fill={fillFromNode(n)} stroke={stroke} strokeWidth={strokeWidth} />
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
      // Pixel-space origin for drag threshold measurement
      originClientX: number
      originClientY: number
      startDocument: SvgDocument
      moved: boolean
      // When a selected item in a multi-select is tapped (not dragged), collapse
      // selection to this single id on pointer-up. This defers the deselect until
      // we know the gesture was a tap rather than a drag.
      pendingSelectionCollapse: string | undefined
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
  | {
      kind: 'shape-draw'
      originDoc: { x: number; y: number }
      currentDoc: { x: number; y: number }
      shapeType: string
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

/**
 * Returns true if `descendantId` is somewhere inside the subtree of any of the
 * given `ancestorIds` (which must be group nodes). Used to detect clicks on
 * children when a parent group is already selected.
 */
function isDescendantOfSelectedGroup(root: SvgNode, ancestorIds: string[], descendantId: string): boolean {
  for (const ancestorId of ancestorIds) {
    if (ancestorId === descendantId) continue
    const ancestor = getNodeById(root, ancestorId)
    if (ancestor?.type === 'group' && getNodeById(ancestor, descendantId)) return true
  }
  return false
}

/**
 * Build a polygon-points string for a regular polygon given center and radius.
 */
function buildPolygonPoints(cx: number, cy: number, radius: number, sides: number): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2
    pts.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
  }
  return pts
}

// ── Shape draw ghost renderer ─────────────────────────────────────────────────

interface ShapeDrawGhostProps {
  shapeType: string
  origin: { x: number; y: number }
  current: { x: number; y: number }
}

function ShapeDrawGhost({ shapeType, origin, current }: ShapeDrawGhostProps) {
  const ghostProps = {
    fill: 'rgba(96,165,250,0.12)',
    stroke: '#60a5fa',
    strokeWidth: 1.5,
    strokeDasharray: '6 4',
    vectorEffect: 'non-scaling-stroke' as const,
    style: { pointerEvents: 'none' as const }
  }

  const bounds = normalizeBounds({
    x: origin.x,
    y: origin.y,
    width: current.x - origin.x,
    height: current.y - origin.y
  })

  switch (shapeType) {
    case 'rect':
      return <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} {...ghostProps} />
    case 'ellipse': {
      const rx = bounds.width / 2
      const ry = bounds.height / 2
      return <ellipse cx={bounds.x + rx} cy={bounds.y + ry} rx={rx} ry={ry} {...ghostProps} />
    }
    case 'line':
      return (
        <line
          x1={origin.x} y1={origin.y}
          x2={current.x} y2={current.y}
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      )
    case 'polygon':
    case 'star': {
      // Ghost as bounding rect for complex shapes
      return <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} {...ghostProps} />
    }
    default:
      return null
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function CanvasArtworkLayer() {
  const document = useEditorStore((s) => s.activeDocument)
  const view = useEditorStore((s) => s.view)
  const mode = useEditorStore((s) => s.mode)
  const selectedIds = useEditorStore((s) => s.selection.selectedNodeIds)
  const multiSelectEnabled = useEditorStore((s) => s.ui.multiSelectEnabled)
  const shapeType = useEditorStore((s) => s.ui.shapeType)
  const penPathInProgress = useEditorStore((s) => s.ui.penPathInProgress)
  const setSelection = useEditorStore((s) => s.setSelection)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const setPan = useEditorStore((s) => s.setPan)
  const setMarqueeRect = useEditorStore((s) => s.setMarqueeRect)
  const replaceDocument = useEditorStore((s) => s.replaceDocument)
  const pushSnapshot = useHistoryStore((s) => s.pushSnapshot)
  const setPathEditMode = useEditorStore((s) => s.setPathEditMode)
  const setPenPathInProgress = useEditorStore((s) => s.setPenPathInProgress)
  const setPenCursorPoint = useEditorStore((s) => s.setPenCursorPoint)
  const commitPenPath = useEditorStore((s) => s.commitPenPath)
  const openInspectorSection = useEditorStore((s) => s.openInspectorSection)
  const setMode = useEditorStore((s) => s.setMode)

  const [shapePreviewCurrent, setShapePreviewCurrent] = useState<{ x: number; y: number } | null>(null)

  const lastTapRef = useRef<{ id: string; time: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const interactionRef = useRef<InteractionState>(null)
  const pinchRef = useRef<PinchState>(null)
  const activePointersRef = useRef<Map<number, PointerSnapshot>>(new Map())
  const effectiveViewBox = useMemo(() => getEffectiveViewBox(document, view), [document, view])
  const effectiveViewBoxRef = useRef(effectiveViewBox)
  effectiveViewBoxRef.current = effectiveViewBox
  const documentRef = useRef(document)
  documentRef.current = document
  // Keep a ref to mode so it can be read inside stale window-event closures
  const modeRef = useRef(mode)
  modeRef.current = mode
  // Keep a ref to penPathInProgress for use inside stale closures
  const penPathInProgressRef = useRef(penPathInProgress)
  penPathInProgressRef.current = penPathInProgress

  const finishInteraction = useCallback(async () => {
    const interaction = interactionRef.current
    if (!interaction) return

    if (interaction.kind === 'drag-selection') {
      if (interaction.moved) {
        const afterDocument = cloneDocument(useEditorStore.getState().activeDocument)
        pushSnapshot(interaction.nodeIds.length > 1 ? 'Move Selection' : 'Move Object', interaction.startDocument, afterDocument)
        await saveDocument(afterDocument)
      } else if (interaction.pendingSelectionCollapse) {
        // Tap on selected item in multi-select: collapse to single
        setSelection([interaction.pendingSelectionCollapse])
      }
    }

    if (interaction.kind === 'marquee-select') {
      setMarqueeRect(null)
    }

    interactionRef.current = null
  }, [pushSnapshot, setMarqueeRect, setSelection])

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

  // ── Pen click handler ─────────────────────────────────────────────────────

  const handlePenClick = useCallback(async (point: { x: number; y: number }) => {
    const currentDoc = documentRef.current
    const penState = penPathInProgressRef.current

    // Close threshold: 12 document units (scales with drawing size)
    const closeThreshold = 12 / useEditorStore.getState().view.zoom

    if (!penState) {
      // Start a new in-progress path
      const nodeId = nanoid()
      const startDocument = cloneDocument(currentDoc)
      const newPathNode = {
        id: nodeId,
        type: 'path' as const,
        visible: true,
        locked: false,
        d: `M ${point.x} ${point.y}`,
        style: {
          fill: { kind: 'solid' as const, color: '#4f8ef7' },
          stroke: { color: '#1d4ed8', width: 2 }
        }
      }
      const nextDoc = {
        ...currentDoc,
        root: {
          ...currentDoc.root,
          children: [...(currentDoc.root.children ?? []), newPathNode]
        }
      }
      replaceDocument(nextDoc as typeof currentDoc)
      setPenPathInProgress({ nodeId, startDocument })
      useEditorStore.getState().setSelection([nodeId])
    } else {
      // Append anchor to existing path
      const pathNode = getNodeById(currentDoc.root, penState.nodeId) as PathNode | undefined
      if (!pathNode) return

      const parsed = parsePathD(pathNode.d)
      if (!parsed.subpaths[0]) return

      const firstAnchor = parsed.subpaths[0].anchors[0]

      // Check if clicking near the first anchor to close the path
      if (firstAnchor && parsed.subpaths[0].anchors.length >= 2) {
        const dist = Math.hypot(point.x - firstAnchor.x, point.y - firstAnchor.y)
        if (dist < closeThreshold) {
          // Close and commit
          parsed.subpaths[0].closed = true
          const nextD = serializePathD(parsed)
          const nextDoc = updateNodeD(currentDoc, penState.nodeId, nextD)
          replaceDocument(nextDoc)
          // Commit after updating the document
          await commitPenPath()
          return
        }
      }

      // Append a corner anchor
      const newAnchor = {
        id: nanoid(8),
        x: point.x,
        y: point.y,
        h1x: point.x,
        h1y: point.y,
        h2x: point.x,
        h2y: point.y,
        handleMode: 'corner' as const
      }
      parsed.subpaths[0].anchors.push(newAnchor)
      const nextD = serializePathD(parsed)
      const nextDoc = updateNodeD(currentDoc, penState.nodeId, nextD)
      replaceDocument(nextDoc)
    }
  }, [commitPenPath, replaceDocument, setPenPathInProgress])

  // ── Commit shape draw ─────────────────────────────────────────────────────

  const commitShapeDraw = useCallback(async (
    shapeDrawType: string,
    originDoc: { x: number; y: number },
    currentDoc: { x: number; y: number }
  ) => {
    const bounds = normalizeBounds({
      x: originDoc.x,
      y: originDoc.y,
      width: currentDoc.x - originDoc.x,
      height: currentDoc.y - originDoc.y
    })

    if (bounds.width < 2 && bounds.height < 2) return

    switch (shapeDrawType) {
      case 'rect':
        await runCommand('document.addRect', {
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height)
        })
        break
      case 'ellipse':
        await runCommand('document.addEllipse', {
          cx: Math.round(bounds.x + bounds.width / 2),
          cy: Math.round(bounds.y + bounds.height / 2),
          rx: Math.round(bounds.width / 2),
          ry: Math.round(bounds.height / 2)
        })
        break
      case 'line':
        await runCommand('document.addLine', {
          x1: Math.round(originDoc.x),
          y1: Math.round(originDoc.y),
          x2: Math.round(currentDoc.x),
          y2: Math.round(currentDoc.y)
        })
        break
      case 'polygon': {
        const cx = Math.round(bounds.x + bounds.width / 2)
        const cy = Math.round(bounds.y + bounds.height / 2)
        const radius = Math.round(Math.min(bounds.width, bounds.height) / 2)
        const sides = 6
        const points = buildPolygonPoints(cx, cy, radius, sides)
        await runCommand('document.addPolygon', { cx, cy, radius, sides })
        void points // computed above but runCommand handles generation
        break
      }
      case 'star': {
        const cx = Math.round(bounds.x + bounds.width / 2)
        const cy = Math.round(bounds.y + bounds.height / 2)
        const outerRadius = Math.round(Math.min(bounds.width, bounds.height) / 2)
        await runCommand('document.addStar', {
          cx,
          cy,
          outerRadius,
          innerRadius: Math.round(outerRadius * 0.45),
          numPoints: 5
        })
        break
      }
    }

    // Auto-return to select mode after drawing a shape
    setMode('select')
  }, [setMode])

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
        const result = applyZoomAtClientPoint(svg, documentRef.current, pinch.anchorDocumentPoint, midpoint.clientX, midpoint.clientY, nextZoom)
        useEditorStore.getState().setCamera(result.zoom, result.panX, result.panY)
        return
      }

      const interaction = interactionRef.current

      // Shape draw: update preview
      if (interaction?.kind === 'shape-draw') {
        const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBoxRef.current)
        interaction.currentDoc = point
        setShapePreviewCurrent({ ...point })
        return
      }

      if (interaction?.kind === 'drag-selection') {
        const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBoxRef.current)
        const dx = point.x - interaction.originX
        const dy = point.y - interaction.originY
        // Use a pixel-space threshold so a gentle tap doesn't register as a drag
        const clientDx = event.clientX - interaction.originClientX
        const clientDy = event.clientY - interaction.originClientY
        if (Math.hypot(clientDx, clientDy) > 5) interaction.moved = true
        const nextDocument = moveNodesInDocument(interaction.startDocument, interaction.nodeIds, dx, dy)
        replaceDocument(nextDocument)
        return
      }

      if (interaction?.kind === 'pan-canvas') {
        const rect = svg.getBoundingClientRect()
        const unitsPerPixelX = effectiveViewBoxRef.current.width / rect.width
        const unitsPerPixelY = effectiveViewBoxRef.current.height / rect.height
        const dx = (event.clientX - interaction.originX) * unitsPerPixelX
        const dy = (event.clientY - interaction.originY) * unitsPerPixelY
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) interaction.moved = true
        setPan(interaction.startPanX - dx, interaction.startPanY - dy)
        return
      }

      if (interaction?.kind === 'marquee-select') {
        const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBoxRef.current)
        const rect = normalizeBounds({
          x: interaction.origin.x,
          y: interaction.origin.y,
          width: point.x - interaction.origin.x,
          height: point.y - interaction.origin.y
        })
        // Only show and record the marquee once it has a meaningful size
        if (rect.width > 1 || rect.height > 1) {
          interaction.moved = true
          setMarqueeRect(rect)
        }
        return
      }

      // Pen mode: track cursor for preview overlay
      if (modeRef.current === 'pen') {
        const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBoxRef.current)
        useEditorStore.getState().setPenCursorPoint(point)
      }
    }

    const handlePointerUp = (event: PointerEvent) => {
      activePointersRef.current.delete(event.pointerId)
      if (activePointersRef.current.size < 2) pinchRef.current = null

      const interaction = interactionRef.current

      // Shape draw: commit the shape
      if (interaction?.kind === 'shape-draw') {
        const { shapeType: drawType, originDoc, currentDoc } = interaction
        setShapePreviewCurrent(null)
        interactionRef.current = null
        void commitShapeDraw(drawType, originDoc, currentDoc)
        return
      }

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
  }, [commitShapeDraw, finishInteraction, maybeBeginPinch, replaceDocument, setPan, setMarqueeRect, setSelection, clearSelection])

  const handleNodePointerDown = (event: ReactPointerEvent<SVGElement>, id: string) => {
    const svg = svgRef.current
    if (!svg) return

    activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
    if (activePointersRef.current.size >= 2) {
      void finishInteraction()
      maybeBeginPinch(event.clientX, event.clientY)
      return
    }

    // In pen or shape mode: node clicks do nothing (drawing on canvas)
    if (mode === 'pen' || mode === 'shape') return

    // In text mode: tapping a text node selects it and opens typography inspector
    if (mode === 'text') {
      const clickedNode = getNodeById(document.root, id)
      if (clickedNode?.type === 'text') {
        setSelection([id])
        openInspectorSection('typography')
        setMode('select')
      }
      return
    }

    // Locked nodes are not selectable or draggable
    const clickedNode = getNodeById(document.root, id)
    if (clickedNode?.locked) return

    // In path mode: tapping a node that isn't the active path does nothing
    if (mode === 'path') return

    // Double-tap detection: enter path edit mode for path nodes
    const now = Date.now()
    const lastTap = lastTapRef.current
    if (lastTap && lastTap.id === id && now - lastTap.time < 400) {
      lastTapRef.current = null
      if (clickedNode?.type === 'path') {
        setPathEditMode(id)
        return
      }
    }
    lastTapRef.current = { id, time: now }

    const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBox)
    const additive = multiSelectEnabled || event.shiftKey

    // If the clicked node is inside an already-selected group, don't change the
    // selection — just start dragging the group(s).
    if (!additive && isDescendantOfSelectedGroup(document.root, selectedIds, id)) {
      if (mode === 'select') {
        interactionRef.current = {
          kind: 'drag-selection',
          nodeIds: selectedIds,
          originX: point.x,
          originY: point.y,
          originClientX: event.clientX,
          originClientY: event.clientY,
          startDocument: cloneDocument(document),
          moved: false,
          pendingSelectionCollapse: undefined
        }
      }
      return
    }

    const isAlreadySelected = selectedIds.includes(id)
    const nextSelection = additive
      ? isAlreadySelected
        ? selectedIds.filter((existing) => existing !== id)
        : uniqueIds([...selectedIds, id])
      : isAlreadySelected
        ? selectedIds  // keep current selection; deferred collapse on tap (see finishInteraction)
        : [id]
    setSelection(nextSelection)
    setMarqueeRect(null)

    if (mode === 'select') {
      interactionRef.current = {
        kind: 'drag-selection',
        nodeIds: nextSelection,
        originX: point.x,
        originY: point.y,
        originClientX: event.clientX,
        originClientY: event.clientY,
        startDocument: cloneDocument(document),
        moved: false,
        // If this is a tap on a selected item in a multi-select (non-additive),
        // we'll collapse to just this item after confirming no drag occurred.
        pendingSelectionCollapse: isAlreadySelected && !additive && selectedIds.length > 1 ? id : undefined
      }
    }
  }

  const handleBackgroundPointerDown = async (event: ReactPointerEvent<SVGSVGElement>) => {
    activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
    if (activePointersRef.current.size >= 2) {
      void finishInteraction()
      maybeBeginPinch(event.clientX, event.clientY)
      return
    }

    const svg = svgRef.current
    if (!svg) return

    // Exit path edit mode on background tap
    if (mode === 'path') {
      setPathEditMode(null)
      return
    }

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

    if (mode === 'shape') {
      const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBox)
      clearSelection()
      interactionRef.current = {
        kind: 'shape-draw',
        originDoc: point,
        currentDoc: point,
        shapeType: useEditorStore.getState().ui.shapeType
      }
      return
    }

    if (mode === 'text') {
      const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBox)
      await runCommand('document.addText', { x: Math.round(point.x), y: Math.round(point.y), content: 'Text' })
      openInspectorSection('typography')
      setMode('select')
      return
    }

    if (mode === 'pen') {
      const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBox)
      await handlePenClick(point)
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
      // Don't show the marquee rect yet — wait until pointer moves past threshold
      // to avoid a 1×1 flash on every background tap.
      return
    }

    // structure, paint, inspect: treat as select mode for clicking
    if (mode === 'structure' || mode === 'paint' || mode === 'inspect') {
      const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBox)
      interactionRef.current = {
        kind: 'marquee-select',
        origin: point,
        append: multiSelectEnabled || event.shiftKey,
        moved: false
      }
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

  const shapeDrawInteraction = interactionRef.current?.kind === 'shape-draw' ? interactionRef.current : null

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
      {document.root.children?.map((node) => renderNode(node, selectedIds, handleNodePointerDown))}

      {/* Shape draw ghost preview */}
      {mode === 'shape' && shapePreviewCurrent && shapeDrawInteraction && (
        <ShapeDrawGhost
          shapeType={shapeDrawInteraction.shapeType}
          origin={shapeDrawInteraction.originDoc}
          current={shapePreviewCurrent}
        />
      )}
    </svg>
  )
}

// ── Tree update helper ────────────────────────────────────────────────────────

function updateNodeD(doc: SvgDocument, nodeId: string, nextD: string): SvgDocument {
  function walk(node: SvgNode): SvgNode {
    if (node.id === nodeId && node.type === 'path') {
      return { ...node, d: nextD } as SvgNode
    }
    if (!node.children?.length) return node
    return { ...node, children: node.children.map(walk) } as SvgNode
  }
  return { ...doc, root: walk(doc.root) } as SvgDocument
}
