import { combineBounds, getNodeBounds } from '@/features/selection/utils/nodeBounds'
import { getNodeById } from '@/features/documents/utils/documentMutations'
import { useEditorStore } from '@/stores/editorStore'

export function InspectorSheet() {
  const section = useEditorStore((s) => s.ui.inspectorSection)
  const lockAspectRatio = useEditorStore((s) => s.ui.lockAspectRatio)
  const multiSelectEnabled = useEditorStore((s) => s.ui.multiSelectEnabled)
  const selection = useEditorStore((s) => s.selection.selectedNodeIds)
  const document = useEditorStore((s) => s.activeDocument)
  const activeNode = selection[0] ? getNodeById(document.root, selection[0]) : undefined
  const selectedNodes = selection.map((id) => getNodeById(document.root, id)).filter(Boolean)
  const combinedBounds = combineBounds(selectedNodes.map((node) => getNodeBounds(node!)).filter(Boolean) as NonNullable<ReturnType<typeof getNodeBounds>>[])

  return (
    <aside
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 320,
        height: '100%',
        padding: 12,
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(17,17,17,0.95)',
        backdropFilter: 'blur(12px)'
      }}
    >
      <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>Inspector</div>
      <div style={{ marginBottom: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Active section: {section}</div>
      <div style={{ marginBottom: 10, fontSize: 12, color: lockAspectRatio ? '#93c5fd' : 'rgba(255,255,255,0.7)' }}>
        Aspect lock: {lockAspectRatio ? 'On' : 'Off'}
      </div>
      <div style={{ marginBottom: 10, fontSize: 12, color: multiSelectEnabled ? '#93c5fd' : 'rgba(255,255,255,0.7)' }}>
        Multi-select: {multiSelectEnabled ? 'On' : 'Off'}
      </div>
      <div style={{ marginBottom: 10, fontSize: 12, color: selection.length > 0 ? '#93c5fd' : 'rgba(255,255,255,0.7)' }}>
        Selection count: {selection.length}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
        {selection.length > 1 && combinedBounds ? (
          <>
            <div style={{ marginBottom: 6 }}>Group transform target</div>
            <div>Bounds: {Math.round(combinedBounds.width)} × {Math.round(combinedBounds.height)}</div>
            <div>Origin: {Math.round(combinedBounds.x)}, {Math.round(combinedBounds.y)}</div>
          </>
        ) : activeNode ? (
          <>
            <div style={{ marginBottom: 6 }}>Selected: {activeNode.name ?? activeNode.type}</div>
            <div>ID: {activeNode.id}</div>
            <div>Type: {activeNode.type}</div>
            <div>Visible: {String(activeNode.visible)}</div>
            <div>Locked: {String(activeNode.locked)}</div>
            <div>Rotation: {Math.round(activeNode.transform?.rotate ?? 0)}°</div>
          </>
        ) : (
          'No selection'
        )}
      </div>
    </aside>
  )
}
