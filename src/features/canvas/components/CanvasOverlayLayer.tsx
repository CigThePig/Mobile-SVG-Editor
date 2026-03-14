import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { getEffectiveViewBox, clientPointToDocumentPoint } from '@/features/canvas/utils/viewBox'
import { cloneDocument, getNodeById, resizeNodeInDocument, resizeNodesInDocument, rotateNodeInDocument, rotateNodesInDocument } from '@/features/documents/utils/documentMutations'
import { getNodeBounds, getBoundsForNodes, normalizeBounds, type NodeBounds } from '@/features/selection/utils/nodeBounds'
import { saveDocument } from '@/db/dexie/queries'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'

type ResizeHandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

type ResizeInteraction = {
  kind: 'resize'
  nodeIds: string[]
  handle: ResizeHandlePosition
  startDocument: ReturnType<typeof cloneDocument>
  startBounds: NodeBounds
  moved: boolean
}

type RotateInteraction = {
  kind: 'rotate'
  nodeIds: string[]
  startDocument: ReturnType<typeof cloneDocument>
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

export function CanvasOverlayLayer() {
  const document = useEditorStore((s) => s.activeDocument)
  const selectedNodeIds = useEditorStore((s) => s.selection.selectedNodeIds)
  const marqueeRect = useEditorStore((s) => s.ui.marqueeRect)
  const view = useEditorStore((s) => s.view)
  const mode = useEditorStore((s) => s.mode)
  const lockAspectRatio = useEditorStore((s) => s.ui.lockAspectRatio)
  const replaceDocument = useEditorStore((s) => s.replaceDocument)
  const pushSnapshot = useHistoryStore((s) => s.pushSnapshot)
  const transformRef = useRef<TransformInteraction>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const effectiveViewBox = useMemo(() => getEffectiveViewBox(document, view), [document, view])

  const selectedNodes = selectedNodeIds.map((id) => getNodeById(document.root, id)).filter((node): node is NonNullable<typeof node> => Boolean(node))
  const selectionBounds = getBoundsForNodes(selectedNodes)
  const primaryNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined
  const handleRadius = Math.max(8, effectiveViewBox.width * 0.008)
  const rotationOffset = Math.max(handleRadius * 4, effectiveViewBox.height * 0.03)

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

      const point = clientPointToDocumentPoint(event.clientX, event.clientY, svg, effectiveViewBox)

      if (interaction.kind === 'resize') {
        const nextBounds = buildBoundsFromHandle(interaction.startBounds, interaction.handle, point, lockAspectRatio || event.shiftKey)
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
  }, [effectiveViewBox, finishTransform, lockAspectRatio, replaceDocument])

  const startResize = (event: ReactPointerEvent<SVGCircleElement>, handle: ResizeHandlePosition) => {
    if (!selectionBounds || mode !== 'select') return
    event.stopPropagation()
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
    event.stopPropagation()
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

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`${effectiveViewBox.x} ${effectiveViewBox.y} ${effectiveViewBox.width} ${effectiveViewBox.height}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {individualBounds.map(({ id, bounds }) => (
        <rect
          key={`sel-${id}`}
          x={bounds.x - 4}
          y={bounds.y - 4}
          width={bounds.width + 8}
          height={bounds.height + 8}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={selectedNodeIds.length > 1 ? 1.25 : 2}
          strokeDasharray={selectedNodeIds.length > 1 ? '6 6' : '8 6'}
          vectorEffect="non-scaling-stroke"
          rx={8}
          opacity={selectedNodeIds.length > 1 ? 0.7 : 1}
        />
      ))}
      {selectionBounds && selectedNodeIds.length > 1 ? (
        <rect
          x={selectionBounds.x - 6}
          y={selectionBounds.y - 6}
          width={selectionBounds.width + 12}
          height={selectionBounds.height + 12}
          fill="none"
          stroke="#93c5fd"
          strokeWidth={2.5}
          strokeDasharray="12 8"
          vectorEffect="non-scaling-stroke"
          rx={10}
        />
      ) : null}
      {marqueeRect ? (
        <rect
          x={marqueeRect.x}
          y={marqueeRect.y}
          width={marqueeRect.width}
          height={marqueeRect.height}
          fill="rgba(96,165,250,0.12)"
          stroke="#60a5fa"
          strokeWidth={2}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          rx={4}
        />
      ) : null}
      {selectionBounds && mode === 'select' ? (
        <>
          {rotationHandle ? (
            <>
              <line
                x1={rotationHandle.x}
                y1={rotationHandle.stemY}
                x2={rotationHandle.x}
                y2={rotationHandle.y}
                stroke="#60a5fa"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={rotationHandle.x}
                cy={rotationHandle.y}
                r={handleRadius}
                fill="#1e293b"
                stroke="#60a5fa"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'all', cursor: 'grab' }}
                onPointerDown={startRotate}
              />
            </>
          ) : null}
          {handles.map((item) => (
            <circle
              key={item.handle}
              cx={item.x}
              cy={item.y}
              r={item.handle.length === 1 ? handleRadius * 0.9 : handleRadius}
              fill="#0f172a"
              stroke="#60a5fa"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'all', cursor: getHandleCursor(item.handle) }}
              onPointerDown={(event) => startResize(event, item.handle)}
            />
          ))}
        </>
      ) : null}
    </svg>
  )
}
