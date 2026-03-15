import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { getEffectiveViewBox, clientPointToDocumentPoint } from '@/features/canvas/utils/viewBox'
import { cloneDocument, getNodeById, resizeNodeInDocument, resizeNodesInDocument, rotateNodeInDocument, rotateNodesInDocument } from '@/features/documents/utils/documentMutations'
import type { SvgDocument } from '@/model/document/documentTypes'
import type { PathNode } from '@/model/nodes/nodeTypes'
import { getNodeBounds, getBoundsForNodes, collectSelectableNodes, normalizeBounds, type NodeBounds } from '@/features/selection/utils/nodeBounds'
import { boundsToSnapCandidates } from '@/features/path/utils/snapUtils'
import { saveDocument } from '@/db/dexie/queries'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { PathEditOverlay } from '@/features/path/components/PathEditOverlay'
import { parsePathD } from '@/features/path/utils/pathGeometry'

type ResizeHandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

type ResizeInteraction = {
  kind: 'resize'
  nodeIds: string[]
  handle: ResizeHandlePosition
  startDocument: SvgDocument
  startBounds: NodeBounds
  moved: boolean
}

type RotateInteraction = {
  kind: 'rotate'
  nodeIds: string[]
  startDocument: SvgDocument
  center: { x: number; y: number }
  startPointerAngle: number
  startRotation: number
  moved: boolean
}

type TransformInteraction = ResizeInteraction | RotateInteraction | null

function angleBetween(center: { x: number; y: number }, point: { x: number; y: number }) {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI
}

function buildFreeBoundsFromHandle(startBounds: NodeBounds, handle: ResizeHandlePosition, point: { x: number; y: number }): NodeBounds {
  const left = startBounds.x
  const top = startBounds.y
  const right = startBounds.x + startBounds.width
  const bottom = startBounds.y + startBounds.height
  const centerX = startBounds.x + startBounds.width / 2
  const centerY = startBounds.y + startBounds.height / 2

  switch (handle) {
    case 'nw':
      return { x: point.x, y: point.y, width: right - point.x, height: bottom - point.y }
    case 'n':
      return { x: left, y: point.y, width: startBounds.width, height: bottom - point.y }
    case 'ne':
      return { x: left, y: point.y, width: point.x - left, height: bottom - point.y }
    case 'e':
      return { x: left, y: top, width: point.x - left, height: startBounds.height }
    case 'se':
      return { x: left, y: top, width: point.x - left, height: point.y - top }
    case 's':
      return { x: left, y: top, width: startBounds.width, height: point.y - top }
    case 'sw':
      return { x: point.x, y: top, width: right - point.x, height: point.y - top }
    case 'w':
      return { x: point.x, y: top, width: right - point.x, height: startBounds.height }
    default:
      return { x: centerX, y: centerY, width: startBounds.width, height: startBounds.height }
  }
}

function buildLockedBoundsFromHandle(startBounds: NodeBounds, handle: ResizeHandlePosition, point: { x: number; y: number }): NodeBounds {
  const aspect = Math.max(0.0001, startBounds.width / Math.max(1, startBounds.height))
  const left = startBounds.x
  const top = startBounds.y
  const right = startBounds.x + startBounds.width
  const bottom = startBounds.y + startBounds.height
  const centerX = startBounds.x + startBounds.width / 2
  const centerY = startBounds.y + startBounds.height / 2

  if (handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw') {
    const anchor = {
      x: handle.includes('w') ? right : left,
      y: handle.includes('n') ? bottom : top
    }

    const rawWidth = Math.abs(point.x - anchor.x)
    const rawHeight = Math.abs(point.y - anchor.y)
    const widthFromHeight = rawHeight * aspect
    const width = Math.max(1, Math.max(rawWidth, widthFromHeight))
    const height = Math.max(1, width / aspect)

    switch (handle) {
      case 'nw':
        return { x: anchor.x - width, y: anchor.y - height, width, height }
      case 'ne':
        return { x: anchor.x, y: anchor.y - height, width, height }
      case 'se':
        return { x: anchor.x, y: anchor.y, width, height }
      case 'sw':
        return { x: anchor.x - width, y: anchor.y, width, height }
    }
  }

  if (handle === 'e' || handle === 'w') {
    const anchorX = handle === 'e' ? left : right
    const width = Math.max(1, Math.abs(point.x - anchorX))
    const height = Math.max(1, width / aspect)
    return {
      x: handle === 'e' ? anchorX : anchorX - width,
      y: centerY - height / 2,
      width,
      height
    }
  }

  const anchorY = handle === 's' ? top : bottom
  const height = Math.max(1, Math.abs(point.y - anchorY))
  const width = Math.max(1, height * aspect)
  return {
    x: centerX - width / 2,
    y: handle === 's' ? anchorY : anchorY - height,
    width,
    height
  }
}

function buildBoundsFromHandle(startBounds: NodeBounds, handle: ResizeHandlePosition, point: { x: number; y: number }, lockAspectRatio: boolean) {
  const bounds = lockAspectRatio ? buildLockedBoundsFromHandle(startBounds, handle, point) : buildFreeBoundsFromHandle(startBounds, handle, point)
  return normalizeBounds(bounds)
}

function getHandleCursor(handle: ResizeHandlePosition) {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    case 'nw':
    case 'se':
      return 'nwse-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
  }
}

/** Whether this is a corner handle (vs mid-edge). Corners are larger and more prominent. */
function isCornerHandle(handle: ResizeHandlePosition) {
  return handle.length === 2
}

export function CanvasOverlayLayer() {
  const document = useEditorStore((s) => s.activeDocument)
  const selectedNodeIds = useEditorStore((s) => s.selection.selectedNodeIds)
  const marqueeRect = useEditorStore((s) => s.ui.marqueeRect)
  const view = useEditorStore((s) => s.view)
  const mode = useEditorStore((s) => s.mode)
  const lockAspectRatio = useEditorStore((s) => s.ui.lockAspectRatio)
  const penPathInProgress = useEditorStore((s) => s.ui.penPathInProgress)
  const penCursorPoint = useEditorStore((s) => s.ui.penCursorPoint)
  const replaceDocument = useEditorStore((s) => s.replaceDocument)
  const pushSnapshot = useHistoryStore((s) => s.pushSnapshot)
  const transformRef = useRef<TransformInteraction>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const effectiveViewBox = useMemo(() => getEffectiveViewBox(document, view), [document, view])
  const effectiveViewBoxRef = useRef(effectiveViewBox)
  effectiveViewBoxRef.current = effectiveViewBox
  const lockAspectRatioRef = useRef(lockAspectRatio)
  lockAspectRatioRef.current = lockAspectRatio

  const selectedNodes = selectedNodeIds.map((id) => getNodeById(document.root, id)).filter((node): node is NonNullable<typeof node> => Boolean(node))
  const selectionBounds = getBoundsForNodes(selectedNodes)
  const primaryNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined
  const isMulti = selectedNodeIds.length > 1

  // Scale handle radius with viewport — bigger on mobile, smaller when zoomed in
  const handleRadius = Math.max(9, effectiveViewBox.width * 0.009)
  const rotationOffset = Math.max(handleRadius * 4.5, effectiveViewBox.height * 0.035)

  const finishTransform = useCallback(async () => {
    const interaction = transformRef.current
    if (!interaction) return

    if (interaction.moved) {
      const afterDocument = cloneDocument(useEditorStore.getState().activeDocument)
      pushSnapshot(
        interaction.kind === 'rotate'
          ? interaction.nodeIds.length > 1
            ? 'Rotate Selection'
            : 'Rotate Object'
          : interaction.nodeIds.length > 1
            ? 'Resize Selection'
            : 'Resize Object',
        interaction.startDocument,
        afterDocument
      )
      await saveDocument(afterDocument)
    }

    transformRef.current = null
  }, [pushSnapshot])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = transformRef.current
      const svg = svgRef.current
      if (!interaction || !svg) return

      const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBoxRef.current)

      if (interaction.kind === 'resize') {
        const nextBounds = buildBoundsFromHandle(interaction.startBounds, interaction.handle, point, lockAspectRatioRef.current || event.shiftKey)
        transformRef.current = { ...interaction, moved: true }
        const nextDocument = interaction.nodeIds.length === 1
          ? resizeNodeInDocument(interaction.startDocument, interaction.nodeIds[0], nextBounds)
          : resizeNodesInDocument(interaction.startDocument, interaction.nodeIds, nextBounds, interaction.startBounds)
        replaceDocument(nextDocument)
        return
      }

      const pointerAngle = angleBetween(interaction.center, point)
      const delta = pointerAngle - interaction.startPointerAngle
      let nextRotation = interaction.startRotation + delta
      if (event.shiftKey) nextRotation = Math.round(nextRotation / 15) * 15
      transformRef.current = { ...interaction, moved: true }
      const nextDocument = interaction.nodeIds.length === 1
        ? rotateNodeInDocument(interaction.startDocument, interaction.nodeIds[0], nextRotation, interaction.center)
        : rotateNodesInDocument(interaction.startDocument, interaction.nodeIds, nextRotation - interaction.startRotation, interaction.center)
      replaceDocument(nextDocument)
    }

    const handlePointerUp = () => {
      void finishTransform()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [finishTransform, replaceDocument])

  const startResize = (event: ReactPointerEvent<SVGCircleElement>, handle: ResizeHandlePosition) => {
    if (!selectionBounds || mode !== 'select') return
    if (selectedNodes.some((n) => n.locked)) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    transformRef.current = {
      kind: 'resize',
      nodeIds: selectedNodeIds,
      handle,
      startDocument: cloneDocument(document),
      startBounds: selectionBounds,
      moved: false
    }
  }

  const startRotate = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!selectionBounds || mode !== 'select' || !svgRef.current) return
    if (selectedNodes.some((n) => n.locked)) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const center = { x: selectionBounds.x + selectionBounds.width / 2, y: selectionBounds.y + selectionBounds.height / 2 }
    const point = clientPointToDocumentPoint(event.clientX, event.clientY, svgRef.current, effectiveViewBox)
    transformRef.current = {
      kind: 'rotate',
      nodeIds: selectedNodeIds,
      startDocument: cloneDocument(document),
      center,
      startPointerAngle: angleBetween(center, point),
      startRotation: primaryNode?.transform?.rotate ?? 0,
      moved: false
    }
  }

  const handles = selectionBounds
    ? ([
        { handle: 'nw', x: selectionBounds.x, y: selectionBounds.y },
        { handle: 'n', x: selectionBounds.x + selectionBounds.width / 2, y: selectionBounds.y },
        { handle: 'ne', x: selectionBounds.x + selectionBounds.width, y: selectionBounds.y },
        { handle: 'e', x: selectionBounds.x + selectionBounds.width, y: selectionBounds.y + selectionBounds.height / 2 },
        { handle: 'se', x: selectionBounds.x + selectionBounds.width, y: selectionBounds.y + selectionBounds.height },
        { handle: 's', x: selectionBounds.x + selectionBounds.width / 2, y: selectionBounds.y + selectionBounds.height },
        { handle: 'sw', x: selectionBounds.x, y: selectionBounds.y + selectionBounds.height },
        { handle: 'w', x: selectionBounds.x, y: selectionBounds.y + selectionBounds.height / 2 }
      ] as Array<{ handle: ResizeHandlePosition; x: number; y: number }>)
    : []

  const rotationHandle = selectionBounds
    ? {
        x: selectionBounds.x + selectionBounds.width / 2,
        y: selectionBounds.y - rotationOffset,
        stemY: selectionBounds.y
      }
    : null

  const individualBounds = selectedNodes
    .map((node) => ({ id: node.id, bounds: getNodeBounds(node) }))
    .filter((item): item is { id: string; bounds: NodeBounds } => Boolean(item.bounds))

  // Snap candidate points: corners/edges/center of non-selected nodes, shown when snap is on
  const snapDots = useMemo(() => {
    if (!view.snapEnabled || (mode !== 'select' && mode !== 'shape')) return []
    const allNodes = collectSelectableNodes(document.root)
    const nonSelected = allNodes.filter((n) => !selectedNodeIds.includes(n.id))
    const dots: Array<{ key: string; x: number; y: number }> = []
    for (const node of nonSelected) {
      const bounds = getNodeBounds(node)
      if (bounds) {
        for (const c of boundsToSnapCandidates(bounds)) {
          dots.push({ key: `${node.id}-${c.x}-${c.y}`, x: c.x, y: c.y })
        }
      }
    }
    return dots
  }, [document, selectedNodeIds, view.snapEnabled, mode])

  // Selection box appearance varies: single = solid bright, multi individual = lighter dashed
  const singleStrokeColor = '#60a5fa'
  const multiIndividualStrokeColor = 'rgba(96,165,250,0.5)'
  const multiGroupStrokeColor = '#93c5fd'

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`${effectiveViewBox.x} ${effectiveViewBox.y} ${effectiveViewBox.width} ${effectiveViewBox.height}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {/* Snap candidate indicators — shown when snap is enabled in select/shape mode */}
      {snapDots.map(({ key, x, y }) => (
        <circle
          key={key}
          cx={x}
          cy={y}
          r={3 / view.zoom}
          fill="#818cf8"
          opacity={0.35}
          style={{ pointerEvents: 'none' }}
        />
      ))}

      {/* Individual selection boxes */}
      {individualBounds.map(({ id, bounds }) => (
        <rect
          key={`sel-${id}`}
          x={bounds.x - 4}
          y={bounds.y - 4}
          width={bounds.width + 8}
          height={bounds.height + 8}
          fill="none"
          stroke={isMulti ? multiIndividualStrokeColor : singleStrokeColor}
          strokeWidth={isMulti ? 1.5 : 2}
          strokeDasharray={isMulti ? '5 5' : 'none'}
          vectorEffect="non-scaling-stroke"
          rx={6}
        />
      ))}

      {/* Group bounding box for multi-selection */}
      {selectionBounds && isMulti ? (
        <rect
          x={selectionBounds.x - 6}
          y={selectionBounds.y - 6}
          width={selectionBounds.width + 12}
          height={selectionBounds.height + 12}
          fill="none"
          stroke={multiGroupStrokeColor}
          strokeWidth={2}
          strokeDasharray="10 6"
          vectorEffect="non-scaling-stroke"
          rx={8}
        />
      ) : null}

      {/* Marquee selection rect */}
      {marqueeRect ? (
        <rect
          x={marqueeRect.x}
          y={marqueeRect.y}
          width={marqueeRect.width}
          height={marqueeRect.height}
          fill="rgba(96,165,250,0.08)"
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          rx={4}
        />
      ) : null}

      {/* Pen mode in-progress path preview */}
      {mode === 'pen' && penPathInProgress && penCursorPoint && (() => {
        const pathNode = getNodeById(document.root, penPathInProgress.nodeId)
        if (!pathNode || pathNode.type !== 'path') return null
        const parsed = parsePathD((pathNode as PathNode).d)
        const subpath = parsed.subpaths[0]
        if (!subpath) return null
        const lastAnchor = subpath.anchors.at(-1)
        const firstAnchor = subpath.anchors[0]
        return (
          <g style={{ pointerEvents: 'none' }}>
            {/* Preview line from last anchor to cursor */}
            {lastAnchor && (
              <line
                x1={lastAnchor.x} y1={lastAnchor.y}
                x2={penCursorPoint.x} y2={penCursorPoint.y}
                stroke="#60a5fa"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {/* Ghost "next anchor" circle at cursor */}
            <circle
              cx={penCursorPoint.x} cy={penCursorPoint.y}
              r={5 / view.zoom}
              fill="#60a5fa"
              opacity={0.6}
            />
            {/* Close-path indicator on the first anchor (shown when ≥2 anchors placed) */}
            {firstAnchor && subpath.anchors.length >= 2 && (
              <circle
                cx={firstAnchor.x} cy={firstAnchor.y}
                r={10 / view.zoom}
                fill="none"
                stroke="#34d399"
                strokeWidth={2 / view.zoom}
                vectorEffect="non-scaling-stroke"
                opacity={0.85}
              />
            )}
          </g>
        )
      })()}

      {/* Path edit mode overlay */}
      {mode === 'path' && <PathEditOverlay svgRef={svgRef} />}

      {/* Transform handles — only in select mode */}
      {selectionBounds && mode === 'select' ? (
        <>
          {/* Rotation handle */}
          {rotationHandle ? (
            <>
              <line
                x1={rotationHandle.x}
                y1={rotationHandle.stemY}
                x2={rotationHandle.x}
                y2={rotationHandle.y}
                stroke="#60a5fa"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              {/* Hit area — larger invisible circle for easier touch targeting */}
              <circle
                cx={rotationHandle.x}
                cy={rotationHandle.y}
                r={handleRadius * 1.5}
                fill="transparent"
                style={{ pointerEvents: 'all', cursor: 'grab', touchAction: 'none' }}
                onPointerDown={startRotate}
              />
              {/* Visible handle */}
              <circle
                cx={rotationHandle.x}
                cy={rotationHandle.y}
                r={handleRadius}
                fill="#0f172a"
                stroke="#60a5fa"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
              {/* Inner dot to signal rotation affordance */}
              <circle
                cx={rotationHandle.x}
                cy={rotationHandle.y}
                r={handleRadius * 0.35}
                fill="#60a5fa"
                style={{ pointerEvents: 'none' }}
              />
            </>
          ) : null}

          {/* Resize handles */}
          {handles.map((item) => {
            const corner = isCornerHandle(item.handle)
            const r = corner ? handleRadius : handleRadius * 0.8
            return (
              <g key={item.handle}>
                {/* Large invisible hit area for touch comfort */}
                <circle
                  cx={item.x}
                  cy={item.y}
                  r={r * 2}
                  fill="transparent"
                  style={{ pointerEvents: 'all', cursor: getHandleCursor(item.handle), touchAction: 'none' }}
                  onPointerDown={(event) => startResize(event, item.handle)}
                />
                {/* Visible handle */}
                <circle
                  cx={item.x}
                  cy={item.y}
                  r={r}
                  fill="#ffffff"
                  stroke="#1d4ed8"
                  strokeWidth={corner ? 2 : 1.5}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            )
          })}
        </>
      ) : null}
    </svg>
  )
}
