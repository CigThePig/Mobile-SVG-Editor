import {
  Plus, Group, Ungroup, Layers, Lock, Unlock, Trash2, Copy,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Eye, EyeOff,
  Circle, Minus, Pentagon, Star, Type, Spline, Square,
  AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Magnet, Scissors, Combine, GitMerge, Paintbrush, Search
} from 'lucide-react'
import { getNodeById } from '@/features/documents/utils/documentMutations'
import { runCommand } from '@/features/documents/services/commandRunner'
import { getEffectiveViewBox } from '@/features/canvas/utils/viewBox'
import { useEditorStore, type EditorMode, type ShapeDrawType } from '@/stores/editorStore'
import { isConvertibleToPath } from '@/features/path/utils/pathConversion'
import { parsePathD } from '@/features/path/utils/pathGeometry'
import type { ParsedPath } from '@/features/path/utils/pathGeometry'
import type { PathNode } from '@/model/nodes/nodeTypes'

function findAnchorRef(
  parsed: ParsedPath,
  anchorId: string
): { subpathIndex: number; anchorIndex: number } | null {
  for (let si = 0; si < parsed.subpaths.length; si++) {
    for (let ai = 0; ai < parsed.subpaths[si].anchors.length; ai++) {
      if (parsed.subpaths[si].anchors[ai].id === anchorId) {
        return { subpathIndex: si, anchorIndex: ai }
      }
    }
  }
  return null
}

const MODE_LABELS: Record<EditorMode, string> = {
  navigate: 'Pan',
  select: 'Select',
  shape: 'Shape',
  pen: 'Pen',
  path: 'Edit Path',
  text: 'Text',
  paint: 'Paint',
  structure: 'Structure',
  inspect: 'Inspect'
}

// ── Shared strip container + styling helpers ──────────────────────────────────

function stripContainer(children: React.ReactNode) {
  return (
    <div
      className="hide-scrollbar"
      style={{
        height: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 10px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: '#161616',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        flexShrink: 0
      }}
    >
      {children}
    </div>
  )
}

function pill(active = false, disabled = false): React.CSSProperties {
  return {
    padding: '0 12px',
    height: 34,
    borderRadius: 10,
    background: active ? 'rgba(96,165,250,0.22)' : 'rgba(255,255,255,0.08)',
    border: active ? '1px solid rgba(96,165,250,0.4)' : '1px solid transparent',
    color: active ? '#93c5fd' : disabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)',
    whiteSpace: 'nowrap' as const,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    fontWeight: 500,
    flexShrink: 0,
    cursor: disabled ? 'default' : 'pointer'
  }
}

function iconPill(active = false, disabled = false): React.CSSProperties {
  return { ...pill(active, disabled), padding: '0 10px' }
}

function divider(): React.ReactNode {
  return <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
}

function modeBadge(label: string, color = 'rgba(255,255,255,0.45)'): React.ReactNode {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {label}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContextActionStrip() {
  const mode = useEditorStore((s) => s.mode)
  const document = useEditorStore((s) => s.activeDocument)
  const view = useEditorStore((s) => s.view)
  const selectedNodeIds = useEditorStore((s) => s.selection.selectedNodeIds)
  const lockAspectRatio = useEditorStore((s) => s.ui.lockAspectRatio)
  const multiSelectEnabled = useEditorStore((s) => s.ui.multiSelectEnabled)
  const shapeType = useEditorStore((s) => s.ui.shapeType)
  const penPathInProgress = useEditorStore((s) => s.ui.penPathInProgress)
  const selectionCount = selectedNodeIds.length
  const toggleAspectRatioLock = useEditorStore((s) => s.toggleAspectRatioLock)
  const toggleMultiSelectEnabled = useEditorStore((s) => s.toggleMultiSelectEnabled)
  const setPathEditMode = useEditorStore((s) => s.setPathEditMode)
  const toggleSnapEnabled = useEditorStore((s) => s.toggleSnapEnabled)
  const setMode = useEditorStore((s) => s.setMode)
  const setShapeType = useEditorStore((s) => s.setShapeType)
  const commitPenPath = useEditorStore((s) => s.commitPenPath)
  const discardPenPath = useEditorStore((s) => s.discardPenPath)
  const openInspectorSection = useEditorStore((s) => s.openInspectorSection)
  const activePathPointIds = useEditorStore((s) => s.selection.activePathPointIds)
  const isolationRootId = useEditorStore((s) => s.selection.isolationRootId)
  const setIsolationRoot = useEditorStore((s) => s.setIsolationRoot)
  const snapEnabled = view.snapEnabled

  const canGroup = selectionCount >= 2
  const canUngroup = selectedNodeIds.some((id) => getNodeById(document.root, id)?.type === 'group')
  const firstSelectedNode = selectionCount > 0 ? getNodeById(document.root, selectedNodeIds[0]) : null
  const isLocked = firstSelectedNode?.locked ?? false
  const isVisible = firstSelectedNode?.visible ?? true

  // Path-related states
  const selectedNodes = selectedNodeIds.map((id) => getNodeById(document.root, id)).filter(Boolean)
  const hasConvertible = selectedNodes.some((n) => n && isConvertibleToPath(n) && n.type !== 'path')
  const activeNode = selectedNodeIds.length === 1 ? getNodeById(document.root, selectedNodeIds[0]) : null
  const canEditPath = activeNode?.type === 'path'
  const canBooleanOp = selectionCount >= 2
  const canAlign = selectionCount >= 2
  const canDistribute = selectionCount >= 3

  // Calculate a centered position for new shapes
  const getCenter = () => {
    const vb = getEffectiveViewBox(document, view)
    return { vb, cx: vb.x + vb.width / 2, cy: vb.y + vb.height / 2 }
  }

  const addRect = () => {
    const { vb, cx, cy } = getCenter()
    const w = Math.round(vb.width * 0.25)
    const h = Math.round(vb.height * 0.18)
    void runCommand('document.addRect', { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), width: w, height: h })
  }

  const addEllipse = () => {
    const { vb, cx, cy } = getCenter()
    void runCommand('document.addEllipse', { cx: Math.round(cx), cy: Math.round(cy), rx: Math.round(vb.width * 0.12), ry: Math.round(vb.height * 0.09) })
  }

  const addLine = () => {
    const { vb, cx, cy } = getCenter()
    const half = Math.round(Math.min(vb.width, vb.height) * 0.12)
    void runCommand('document.addLine', { x1: cx - half, y1: cy - half, x2: cx + half, y2: cy + half })
  }

  const addPolygon = () => {
    const { vb, cx, cy } = getCenter()
    const radius = Math.round(Math.min(vb.width, vb.height) * 0.1)
    void runCommand('document.addPolygon', { cx: Math.round(cx), cy: Math.round(cy), radius, sides: 6 })
  }

  const addStar = () => {
    const { vb, cx, cy } = getCenter()
    const outer = Math.round(Math.min(vb.width, vb.height) * 0.1)
    void runCommand('document.addStar', { cx: Math.round(cx), cy: Math.round(cy), outerRadius: outer, innerRadius: Math.round(outer * 0.45), numPoints: 5 })
  }

  const addText = () => {
    const { cx, cy } = getCenter()
    void runCommand('document.addText', { x: Math.round(cx), y: Math.round(cy), content: 'Text' })
  }

  const groupSelection = () => {
    if (!canGroup) return
    void runCommand('document.groupSelection', { nodeIds: selectedNodeIds })
  }

  const ungroupSelection = () => {
    if (!canUngroup) return
    void runCommand('document.ungroupSelection', { nodeIds: selectedNodeIds })
  }

  const duplicate = () => {
    if (!selectionCount) return
    void runCommand('document.duplicateNodes', { nodeIds: selectedNodeIds })
  }

  const deleteSelected = () => {
    if (!selectionCount) return
    void runCommand('document.deleteNodes', { nodeIds: selectedNodeIds })
  }

  const reorder = (direction: 'up' | 'down' | 'front' | 'back') => {
    if (!selectedNodeIds[0]) return
    void runCommand('document.reorderNode', { nodeId: selectedNodeIds[0], direction })
  }

  const toggleLock = () => {
    if (!selectedNodeIds[0]) return
    void runCommand('document.setNodeLocked', { nodeId: selectedNodeIds[0], locked: !isLocked })
  }

  const toggleVisibility = () => {
    if (!selectedNodeIds[0]) return
    void runCommand('document.setNodeVisibility', { nodeId: selectedNodeIds[0], visible: !isVisible })
  }

  const convertToPath = () => {
    if (!hasConvertible) return
    void runCommand('path.convertToPath', { nodeIds: selectedNodeIds })
  }

  const enterPathEdit = () => {
    if (!canEditPath || !activeNode) return
    setPathEditMode(activeNode.id)
  }

  const exitPathEdit = () => {
    setPathEditMode(null)
  }

  // ── Shape mode strip ───────────────────────────────────────────────────────
  if (mode === 'shape') {
    const shapeTypes: Array<{ type: ShapeDrawType; label: string; icon: React.ReactNode }> = [
      { type: 'rect', label: 'Rect', icon: <Square size={14} /> },
      { type: 'ellipse', label: 'Ellipse', icon: <Circle size={14} /> },
      { type: 'line', label: 'Line', icon: <Minus size={14} /> },
      { type: 'polygon', label: 'Polygon', icon: <Pentagon size={14} /> },
      { type: 'star', label: 'Star', icon: <Star size={14} /> }
    ]
    return stripContainer(
      <>
        {modeBadge('Shape', '#93c5fd')}
        {divider()}
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', flexShrink: 0 }}>Drag to draw:</span>
        {shapeTypes.map(({ type, label, icon }) => (
          <button key={type} style={pill(shapeType === type)} onClick={() => setShapeType(type)}>
            {icon} {label}
          </button>
        ))}
        {divider()}
        <button style={pill(snapEnabled)} onClick={toggleSnapEnabled}><Magnet size={14} /> Snap</button>
        {divider()}
        <button style={pill(false)} onClick={() => setMode('select')}>✗ Cancel</button>
      </>
    )
  }

  // ── Pen mode strip ─────────────────────────────────────────────────────────
  if (mode === 'pen') {
    const penNode = penPathInProgress ? getNodeById(document.root, penPathInProgress.nodeId) : null
    const anchorCount = penNode?.type === 'path'
      ? (parsePathD(penNode.d)?.subpaths?.[0]?.anchors?.length ?? 0)
      : 0

    return stripContainer(
      <>
        {modeBadge('Pen', '#93c5fd')}
        {penPathInProgress && anchorCount > 0 && (
          <>
            {divider()}
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {anchorCount} {anchorCount === 1 ? 'point' : 'points'} — click first point to close
            </span>
          </>
        )}
        {!penPathInProgress && (
          <>
            {divider()}
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', flexShrink: 0 }}>Click to place points</span>
          </>
        )}
        {divider()}
        {penPathInProgress && (
          <button style={pill(false)} onClick={() => void commitPenPath()} title="Commit the path and return to select mode">
            ✓ Done
          </button>
        )}
        <button
          style={{ ...pill(false), color: 'rgba(252,165,165,0.9)' }}
          onClick={discardPenPath}
          title={penPathInProgress ? 'Discard in-progress path' : 'Exit pen mode'}
        >
          ✗ {penPathInProgress ? 'Discard' : 'Cancel'}
        </button>
        {divider()}
        <button style={pill(snapEnabled)} onClick={toggleSnapEnabled}><Magnet size={14} /> Snap</button>
      </>
    )
  }

  // ── Text mode strip ────────────────────────────────────────────────────────
  if (mode === 'text') {
    return stripContainer(
      <>
        {modeBadge('Text', '#93c5fd')}
        {divider()}
        <Type size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', flexShrink: 0 }}>Tap canvas to place text</span>
        {divider()}
        <button style={pill(false)} onClick={() => setMode('select')}>✗ Cancel</button>
      </>
    )
  }

  // ── Paint mode strip ───────────────────────────────────────────────────────
  if (mode === 'paint') {
    return stripContainer(
      <>
        {modeBadge('Paint', '#93c5fd')}
        {divider()}
        <Paintbrush size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
        {selectionCount > 0 ? (
          <>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {selectionCount === 1 ? '1 selected' : `${selectionCount} selected`}
            </span>
            {divider()}
            <button style={pill(false)} onClick={() => openInspectorSection('appearance')}>
              Open Colors
            </button>
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', flexShrink: 0 }}>Select an object to paint</span>
        )}
        {divider()}
        <button style={pill(false)} onClick={() => setMode('select')}>Done</button>
      </>
    )
  }

  // ── Inspect mode strip ─────────────────────────────────────────────────────
  if (mode === 'inspect') {
    return stripContainer(
      <>
        {modeBadge('Inspect', '#93c5fd')}
        {divider()}
        <Search size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
        {firstSelectedNode ? (
          <>
            <span style={{ fontSize: 12, color: '#93c5fd', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {firstSelectedNode.type}{firstSelectedNode.name ? ` — ${firstSelectedNode.name}` : ''}
            </span>
            {divider()}
            <button style={pill(false)} onClick={() => openInspectorSection('quick')}>Open Inspector</button>
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', flexShrink: 0 }}>Select an object to inspect</span>
        )}
      </>
    )
  }

  // ── Path edit mode strip ───────────────────────────────────────────────────
  if (mode === 'path') {
    const activePointId = activePathPointIds?.[0]
    const activePointRef = (() => {
      if (!activePointId || !activeNode || activeNode.type !== 'path') return null
      return findAnchorRef(parsePathD((activeNode as PathNode).d), activePointId)
    })()
    const hasSelectedPoint = !!activePointRef

    return stripContainer(
      <>
        {modeBadge('Edit Path', '#60a5fa')}

        {divider()}

        <button onClick={exitPathEdit} style={pill(false)} title="Done editing — return to select mode">
          ✓ Done
        </button>

        {divider()}

        {selectedNodeIds[0] && (
          <>
            <button
              disabled={!hasSelectedPoint}
              onClick={() => {
                if (selectedNodeIds[0] && activePointRef) void runCommand('path.convertPointType', { nodeId: selectedNodeIds[0], subpathIndex: activePointRef.subpathIndex, anchorIndex: activePointRef.anchorIndex, mode: 'corner' })
              }}
              style={pill(false, !hasSelectedPoint)}
              title="Make selected point a corner"
            >
              Corner
            </button>
            <button
              disabled={!hasSelectedPoint}
              onClick={() => {
                if (selectedNodeIds[0] && activePointRef) void runCommand('path.convertPointType', { nodeId: selectedNodeIds[0], subpathIndex: activePointRef.subpathIndex, anchorIndex: activePointRef.anchorIndex, mode: 'smooth' })
              }}
              style={pill(false, !hasSelectedPoint)}
              title="Make selected point smooth"
            >
              Smooth
            </button>
            <button
              onClick={() => {
                if (selectedNodeIds[0]) void runCommand('path.toggleClosed', { nodeId: selectedNodeIds[0], subpathIndex: activePointRef?.subpathIndex ?? 0 })
              }}
              style={pill(false)}
              title="Toggle path closed/open"
            >
              <Scissors size={14} /> Close/Open
            </button>

            {divider()}

            <button
              disabled={!hasSelectedPoint}
              onClick={() => { if (selectedNodeIds[0] && activePointRef) void runCommand('path.deletePoint', { nodeId: selectedNodeIds[0], subpathIndex: activePointRef.subpathIndex, anchorIndex: activePointRef.anchorIndex }) }}
              style={{ ...pill(false, !hasSelectedPoint), color: hasSelectedPoint ? 'rgba(252,165,165,0.9)' : undefined }}
              title="Delete selected point"
            >
              <Trash2 size={14} /> Del Point
            </button>
          </>
        )}

        {divider()}

        <button onClick={toggleSnapEnabled} style={pill(snapEnabled)} title="Toggle snapping">
          <Magnet size={14} /> Snap
        </button>
      </>
    )
  }

  // ── Structure mode strip (select-like with layer focus) ────────────────────
  const isStructureMode = mode === 'structure'

  // ── Default strip: select / navigate / structure modes ────────────────────
  return stripContainer(
    <>
      {/* Isolation mode indicator */}
      {isolationRootId && (
        <>
          {modeBadge('Group', '#fbbf24')}
          <button style={pill(false)} onClick={() => setIsolationRoot(undefined)}>
            ↩ Exit Group
          </button>
          {divider()}
        </>
      )}

      {/* Mode badge */}
      {modeBadge(MODE_LABELS[mode] ?? mode)}

      {divider()}

      {/* Selection count badge */}
      {selectionCount > 0 && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#93c5fd',
            background: 'rgba(96,165,250,0.15)',
            borderRadius: 8,
            padding: '2px 8px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          {selectionCount === 1 ? '1 selected' : `${selectionCount} selected`}
        </span>
      )}

      {/* Path operations — when selection contains convertible or path nodes */}
      {selectionCount > 0 && !isStructureMode && (
        <>
          {hasConvertible && (
            <>
              <button onClick={convertToPath} style={pill(false)} title="Convert selection to editable path">
                <Spline size={14} /> To Path
              </button>
              {divider()}
            </>
          )}
          {canEditPath && !hasConvertible && (
            <>
              <button onClick={enterPathEdit} style={pill(false)} title="Enter path point-editing mode">
                <Spline size={14} /> Edit Points
              </button>
              {divider()}
            </>
          )}
        </>
      )}

      {/* Shape creation — only in select/navigate mode, not structure */}
      {!isStructureMode && (
        <>
          <button onClick={addRect} style={pill(false)} title="Add Rectangle">
            <Plus size={14} /> Rect
          </button>
          <button onClick={addEllipse} style={pill(false)} title="Add Ellipse">
            <Circle size={14} /> Ellipse
          </button>
          <button onClick={addLine} style={pill(false)} title="Add Line">
            <Minus size={14} /> Line
          </button>
          <button onClick={addPolygon} style={pill(false)} title="Add Polygon">
            <Pentagon size={14} /> Polygon
          </button>
          <button onClick={addStar} style={pill(false)} title="Add Star">
            <Star size={14} /> Star
          </button>
          <button onClick={addText} style={pill(false)} title="Add Text">
            <Type size={14} /> Text
          </button>

          {divider()}
        </>
      )}

      {/* Object actions — visible when selection exists */}
      {selectionCount > 0 && (
        <>
          <button onClick={duplicate} style={pill(false)} title="Duplicate">
            <Copy size={14} /> Dupe
          </button>
          <button onClick={deleteSelected} style={{ ...pill(false), color: 'rgba(252,165,165,0.9)' }} title="Delete">
            <Trash2 size={14} /> Delete
          </button>

          {divider()}

          <button onClick={() => reorder('front')} style={iconPill(false)} title="Bring to Front">
            <ChevronsUp size={14} />
          </button>
          <button onClick={() => reorder('up')} style={iconPill(false)} title="Move Forward">
            <ChevronUp size={14} />
          </button>
          <button onClick={() => reorder('down')} style={iconPill(false)} title="Move Backward">
            <ChevronDown size={14} />
          </button>
          <button onClick={() => reorder('back')} style={iconPill(false)} title="Send to Back">
            <ChevronsDown size={14} />
          </button>

          {divider()}

          <button onClick={toggleLock} style={pill(isLocked)} title={isLocked ? 'Unlock' : 'Lock'}>
            {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
            {isLocked ? 'Locked' : 'Lock'}
          </button>
          <button onClick={toggleVisibility} style={pill(!isVisible)} title={isVisible ? 'Hide' : 'Show'}>
            {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            {isVisible ? 'Visible' : 'Hidden'}
          </button>

          {divider()}
        </>
      )}

      {/* Boolean operations — when 2+ nodes selected */}
      {canBooleanOp && !isStructureMode && (
        <>
          <button onClick={() => void runCommand('path.booleanUnion', { nodeIds: selectedNodeIds })} style={pill(false)} title="Boolean Union">
            <Combine size={14} /> Union
          </button>
          <button onClick={() => void runCommand('path.booleanSubtract', { nodeIds: selectedNodeIds })} style={pill(false)} title="Boolean Subtract (first minus rest)">
            <Scissors size={14} /> Subtract
          </button>
          <button onClick={() => void runCommand('path.booleanIntersect', { nodeIds: selectedNodeIds })} style={pill(false)} title="Boolean Intersect">
            <GitMerge size={14} /> Intersect
          </button>
          <button onClick={() => void runCommand('path.booleanExclude', { nodeIds: selectedNodeIds })} style={pill(false)} title="Boolean Exclude (XOR)">
            Exclude
          </button>

          {divider()}
        </>
      )}

      {/* Align operations — when 2+ nodes selected */}
      {canAlign && (
        <>
          <button onClick={() => void runCommand('document.alignNodes', { nodeIds: selectedNodeIds, align: 'left' })} style={iconPill()} title="Align Left">
            <AlignLeft size={14} />
          </button>
          <button onClick={() => void runCommand('document.alignNodes', { nodeIds: selectedNodeIds, align: 'hcenter' })} style={iconPill()} title="Align Center Horizontally">
            <AlignCenter size={14} />
          </button>
          <button onClick={() => void runCommand('document.alignNodes', { nodeIds: selectedNodeIds, align: 'right' })} style={iconPill()} title="Align Right">
            <AlignRight size={14} />
          </button>
          <button onClick={() => void runCommand('document.alignNodes', { nodeIds: selectedNodeIds, align: 'top' })} style={iconPill()} title="Align Top">
            <AlignStartVertical size={14} />
          </button>
          <button onClick={() => void runCommand('document.alignNodes', { nodeIds: selectedNodeIds, align: 'vcenter' })} style={iconPill()} title="Align Center Vertically">
            <AlignCenterVertical size={14} />
          </button>
          <button onClick={() => void runCommand('document.alignNodes', { nodeIds: selectedNodeIds, align: 'bottom' })} style={iconPill()} title="Align Bottom">
            <AlignEndVertical size={14} />
          </button>

          {divider()}
        </>
      )}

      {/* Distribute — when 3+ nodes selected */}
      {canDistribute && (
        <>
          <button onClick={() => void runCommand('document.distributeNodes', { nodeIds: selectedNodeIds, direction: 'horizontal' })} style={pill(false)} title="Distribute Horizontally">
            Distrib H
          </button>
          <button onClick={() => void runCommand('document.distributeNodes', { nodeIds: selectedNodeIds, direction: 'vertical' })} style={pill(false)} title="Distribute Vertically">
            Distrib V
          </button>

          {divider()}
        </>
      )}

      <button disabled={!canGroup} onClick={groupSelection} style={pill(false, !canGroup)}>
        <Group size={14} /> Group
      </button>
      <button disabled={!canUngroup} onClick={ungroupSelection} style={pill(false, !canUngroup)}>
        <Ungroup size={14} /> Ungroup
      </button>
      {!isStructureMode && (
        <>
          <button onClick={toggleMultiSelectEnabled} style={pill(multiSelectEnabled)}>
            <Layers size={14} /> Multi
          </button>
          <button onClick={toggleAspectRatioLock} style={pill(lockAspectRatio)}>
            {lockAspectRatio ? <Lock size={14} /> : <Unlock size={14} />}
            Aspect
          </button>
          <button onClick={toggleSnapEnabled} style={pill(snapEnabled)} title="Toggle snapping">
            <Magnet size={14} /> Snap
          </button>
        </>
      )}
    </>
  )
}
