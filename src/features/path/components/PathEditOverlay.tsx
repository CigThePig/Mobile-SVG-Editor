/**
 * PathEditOverlay — SVG overlay for anchor-point and bezier-handle editing.
 *
 * Rendered inside CanvasOverlayLayer when mode === 'path' and a PathNode is selected.
 * All coordinates are in document space; the parent SVG viewBox handles the mapping.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { SvgNode } from '@/model/nodes/nodeTypes'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { saveDocument } from '@/db/dexie/queries'
import { getNodeById } from '@/features/documents/utils/documentMutations'
import { clientPointToDocumentPoint } from '@/features/canvas/utils/viewBox'
import { cloneDocument } from '@/features/documents/utils/documentMutations'
import { parsePathD, serializePathD } from '../utils/pathGeometry'
import type { ParsedPath, PathAnchor } from '../utils/pathGeometry'
import {
  moveAnchor,
  moveHandle,
  addPointOnSegment
} from '../utils/pathOperations'
import { snapPoint, boundsToSnapCandidates, screenThresholdToDocSpace } from '../utils/snapUtils'
import type { SnapCandidate } from '../utils/snapUtils'
import type { SvgDocument } from '@/model/document/documentTypes'
import type { PathNode } from '@/model/nodes/nodeTypes'
import { getNodeBounds } from '@/features/selection/utils/nodeBounds'
import { runCommand } from '@/features/documents/services/commandRunner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PointRef {
  subpathIdx: number
  anchorIdx: number
}

type DragTarget =
  | { kind: 'anchor'; ref: PointRef }
  | { kind: 'handle'; ref: PointRef; handleType: 'h1' | 'h2' }

interface DragState {
  target: DragTarget
  startDoc: SvgDocument
  startParsed: ParsedPath
  moved: boolean
}

// ── Segment hit testing ───────────────────────────────────────────────────────

function sampleCubic(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number],
  t: number
): [number, number] {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
  ]
}

interface SegmentHit {
  subpathIdx: number
  segmentIdx: number
  t: number
  dist: number
}

function findNearestSegment(
  parsed: ParsedPath,
  px: number,
  py: number,
  threshold: number
): SegmentHit | null {
  let best: SegmentHit | null = null

  for (let si = 0; si < parsed.subpaths.length; si++) {
    const sp = parsed.subpaths[si]
    const { anchors, closed } = sp
    const segCount = closed ? anchors.length : anchors.length - 1

    for (let ai = 0; ai < segCount; ai++) {
      const from = anchors[ai]
      const to = anchors[(ai + 1) % anchors.length]

      const p0: [number, number] = [from.x, from.y]
      const p1: [number, number] = [from.h2x, from.h2y]
      const p2: [number, number] = [to.h1x, to.h1y]
      const p3: [number, number] = [to.x, to.y]

      // Sample at 20 intervals
      const steps = 20
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const [sx, sy] = sampleCubic(p0, p1, p2, p3, t)
        const d = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2)
        if (d < threshold && (!best || d < best.dist)) {
          best = { subpathIdx: si, segmentIdx: ai, t, dist: d }
        }
      }
    }
  }

  return best
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PathEditOverlayProps {
  svgRef: React.RefObject<SVGSVGElement | null>
}

export function PathEditOverlay({ svgRef }: PathEditOverlayProps) {
  const document = useEditorStore((s) => s.activeDocument)
  const activeNodeId = useEditorStore((s) => s.selection.activeNodeId)
  const view = useEditorStore((s) => s.view)
  const replaceDocument = useEditorStore((s) => s.replaceDocument)
  const activePathPointIds = useEditorStore((s) => s.selection.activePathPointIds)
  const setSelection = useEditorStore((s) => s.setSelection)
  const pushSnapshot = useHistoryStore((s) => s.pushSnapshot)

  const dragRef = useRef<DragState | null>(null)
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>([])
  const [snapIndicator, setSnapIndicator] = useState<{ x: number; y: number } | null>(null)

  // The PathNode we're editing
  const pathNode = activeNodeId
    ? (getNodeById(document.root, activeNodeId) as PathNode | undefined)
    : undefined

  const effectiveViewBox = view  // we get zoom etc. from view
  const zoom = view.zoom

  // Handle radius scales with zoom for touch comfort
  const anchorHalfSize = Math.max(5, 10 / zoom)
  const handleRadius = Math.max(3.5, 6 / zoom)
  const hitAreaHalfSize = Math.max(12, 24 / zoom)

  // Build snap candidates from other visible nodes' bounds
  const snapCandidates: SnapCandidate[] = []
  if (view.snapEnabled) {
    for (const child of document.root.children ?? []) {
      if (child.id === activeNodeId) continue
      if (!child.visible) continue
      const bounds = getNodeBounds(child)
      if (bounds) {
        snapCandidates.push(...boundsToSnapCandidates(bounds))
      }
    }
  }

  const snapThreshold = screenThresholdToDocSpace(8, zoom)
  const segmentHitThreshold = screenThresholdToDocSpace(12, zoom)

  // Parse current path
  const parsed = pathNode ? parsePathD(pathNode.d) : null

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current
    const svg = svgRef.current
    if (!drag || !svg || !pathNode) return

    const raw = clientPointToDocumentPoint(event.clientX, event.clientY, svg, {
      x: view.panX - (document.viewBox?.x ?? 0),
      y: view.panY - (document.viewBox?.y ?? 0),
      width: (document.viewBox?.width ?? document.width) / zoom,
      height: (document.viewBox?.height ?? document.height) / zoom
    })

    // Actually get the raw doc-space point from SVG
    const rawDocPt = clientPointToDocumentPoint(event.clientX, event.clientY, svg, {
      x: view.panX,
      y: view.panY,
      width: document.width / zoom,
      height: document.height / zoom
    })

    const snap = view.snapEnabled
      ? snapPoint(rawDocPt, snapCandidates, view.snapConfig, snapThreshold)
      : { ...rawDocPt, snapped: false }

    const pt = { x: snap.x, y: snap.y }
    if (snap.snapped) {
      setSnapIndicator(pt)
    } else {
      setSnapIndicator(null)
    }

    const currentParsed = parsePathD(pathNode.d)
    let nextParsed: ParsedPath

    if (drag.target.kind === 'anchor') {
      nextParsed = moveAnchor(currentParsed, drag.target.ref.subpathIdx, drag.target.ref.anchorIdx, pt.x, pt.y)
    } else {
      nextParsed = moveHandle(currentParsed, drag.target.ref.subpathIdx, drag.target.ref.anchorIdx, drag.target.handleType, pt.x, pt.y)
    }

    const nextD = serializePathD(nextParsed)

    // Preview: update document without history
    const nextDoc = {
      ...document,
      root: updateNodeInTree(document.root, pathNode.id, (n) => ({ ...n, d: nextD } as SvgNode))
    }
    replaceDocument(nextDoc as SvgDocument)
    dragRef.current = { ...drag, moved: true }
  }, [document, pathNode, view, zoom, snapCandidates, snapThreshold, replaceDocument, svgRef])

  const handlePointerUp = useCallback(async () => {
    const drag = dragRef.current
    dragRef.current = null
    setSnapIndicator(null)

    if (!drag || !drag.moved) return

    const afterDocument = cloneDocument(useEditorStore.getState().activeDocument)
    const label = drag.target.kind === 'anchor' ? 'Move Point' : 'Move Handle'
    pushSnapshot(label, drag.startDoc, afterDocument)
    await saveDocument(afterDocument)
  }, [pushSnapshot])

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  // ── Start drag on anchor ───────────────────────────────────────────────────

  const startAnchorDrag = useCallback((
    event: ReactPointerEvent,
    subpathIdx: number,
    anchorIdx: number,
    anchorId: string
  ) => {
    event.stopPropagation()
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
    dragRef.current = {
      target: { kind: 'anchor', ref: { subpathIdx, anchorIdx } },
      startDoc: cloneDocument(document),
      startParsed: parsePathD(pathNode?.d ?? ''),
      moved: false
    }
    setSelectedPointIds([anchorId])
  }, [document, pathNode])

  // ── Start drag on handle ───────────────────────────────────────────────────

  const startHandleDrag = useCallback((
    event: ReactPointerEvent,
    subpathIdx: number,
    anchorIdx: number,
    handleType: 'h1' | 'h2'
  ) => {
    event.stopPropagation()
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
    dragRef.current = {
      target: { kind: 'handle', ref: { subpathIdx, anchorIdx }, handleType },
      startDoc: cloneDocument(document),
      startParsed: parsePathD(pathNode?.d ?? ''),
      moved: false
    }
  }, [document, pathNode])

  // ── Tap on segment to add point ────────────────────────────────────────────

  const handleSegmentTap = useCallback(async (
    event: ReactPointerEvent<SVGPathElement>
  ) => {
    if (!pathNode || !parsed || !svgRef.current) return
    event.stopPropagation()

    const rawDocPt = clientPointToDocumentPoint(event.clientX, event.clientY, svgRef.current, {
      x: view.panX,
      y: view.panY,
      width: document.width / zoom,
      height: document.height / zoom
    })

    const hit = findNearestSegment(parsed, rawDocPt.x, rawDocPt.y, segmentHitThreshold)
    if (!hit) return

    await runCommand('path.addPoint', {
      nodeId: pathNode.id,
      subpathIndex: hit.subpathIdx,
      segmentIndex: hit.segmentIdx,
      t: Math.max(0.1, Math.min(0.9, hit.t))
    })
  }, [pathNode, parsed, svgRef, view, document, zoom, segmentHitThreshold])

  if (!pathNode || !parsed) return null

  return (
    <g>
      {/* Segment hit area for adding points */}
      <path
        d={pathNode.d}
        fill="none"
        stroke="transparent"
        strokeWidth={segmentHitThreshold * 2}
        style={{ pointerEvents: 'stroke', cursor: 'crosshair' }}
        onPointerDown={handleSegmentTap}
      />

      {/* Anchor points and handles */}
      {parsed.subpaths.map((sp, si) =>
        sp.anchors.map((anchor, ai) => {
          const isSelected = selectedPointIds.includes(anchor.id)
          const hasH1 = !(Math.abs(anchor.h1x - anchor.x) < 0.5 && Math.abs(anchor.h1y - anchor.y) < 0.5)
          const hasH2 = !(Math.abs(anchor.h2x - anchor.x) < 0.5 && Math.abs(anchor.h2y - anchor.y) < 0.5)

          return (
            <g key={`${si}-${ai}`}>
              {/* h1 handle line + circle */}
              {hasH1 && (
                <>
                  <line
                    x1={anchor.x} y1={anchor.y}
                    x2={anchor.h1x} y2={anchor.h1y}
                    stroke="#60a5fa"
                    strokeWidth={1.5 / zoom}
                    strokeDasharray={`${3 / zoom} ${3 / zoom}`}
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Hit area */}
                  <circle
                    cx={anchor.h1x} cy={anchor.h1y}
                    r={hitAreaHalfSize * 0.6}
                    fill="transparent"
                    style={{ pointerEvents: 'all', cursor: 'grab', touchAction: 'none' }}
                    onPointerDown={(e) => startHandleDrag(e, si, ai, 'h1')}
                  />
                  {/* Visible handle */}
                  <circle
                    cx={anchor.h1x} cy={anchor.h1y}
                    r={handleRadius}
                    fill="#0f172a"
                    stroke="#60a5fa"
                    strokeWidth={1.5 / zoom}
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'none' }}
                  />
                </>
              )}

              {/* h2 handle line + circle */}
              {hasH2 && (
                <>
                  <line
                    x1={anchor.x} y1={anchor.y}
                    x2={anchor.h2x} y2={anchor.h2y}
                    stroke="#60a5fa"
                    strokeWidth={1.5 / zoom}
                    strokeDasharray={`${3 / zoom} ${3 / zoom}`}
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'none' }}
                  />
                  <circle
                    cx={anchor.h2x} cy={anchor.h2y}
                    r={hitAreaHalfSize * 0.6}
                    fill="transparent"
                    style={{ pointerEvents: 'all', cursor: 'grab', touchAction: 'none' }}
                    onPointerDown={(e) => startHandleDrag(e, si, ai, 'h2')}
                  />
                  <circle
                    cx={anchor.h2x} cy={anchor.h2y}
                    r={handleRadius}
                    fill="#0f172a"
                    stroke="#60a5fa"
                    strokeWidth={1.5 / zoom}
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'none' }}
                  />
                </>
              )}

              {/* Anchor point hit area (large) */}
              <rect
                x={anchor.x - hitAreaHalfSize}
                y={anchor.y - hitAreaHalfSize}
                width={hitAreaHalfSize * 2}
                height={hitAreaHalfSize * 2}
                fill="transparent"
                style={{ pointerEvents: 'all', cursor: 'move', touchAction: 'none' }}
                onPointerDown={(e) => startAnchorDrag(e, si, ai, anchor.id)}
              />

              {/* Visible anchor square */}
              <rect
                x={anchor.x - anchorHalfSize}
                y={anchor.y - anchorHalfSize}
                width={anchorHalfSize * 2}
                height={anchorHalfSize * 2}
                fill={isSelected ? '#60a5fa' : '#ffffff'}
                stroke={isSelected ? '#1d4ed8' : '#60a5fa'}
                strokeWidth={1.5 / zoom}
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            </g>
          )
        })
      )}

      {/* Snap indicator */}
      {snapIndicator && (
        <circle
          cx={snapIndicator.x}
          cy={snapIndicator.y}
          r={4 / zoom}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2 / zoom}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </g>
  )
}

// ── Helper (avoids importing full documentMutations cycle) ────────────────────

function updateNodeInTree(node: SvgNode, targetId: string, updater: (n: SvgNode) => SvgNode): SvgNode {
  if (node.id === targetId) return updater(node)
  if (!('children' in node) || !node.children?.length) return node
  return {
    ...node,
    children: node.children.map((c) => updateNodeInTree(c, targetId, updater))
  } as SvgNode
}
