import type { MouseEvent } from 'react'
import type { SvgNode } from '@/model/nodes/nodeTypes'
import { useEditorStore } from '@/stores/editorStore'

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids))
}

function labelForNode(node: SvgNode) {
  return node.name ?? (node.type === 'group' ? 'Group' : node.type)
}

export function LayersPanel() {
  const nodes = useEditorStore((s) => s.activeDocument.root.children)
  const selectedIds = useEditorStore((s) => s.selection.selectedNodeIds)
  const multiSelectEnabled = useEditorStore((s) => s.ui.multiSelectEnabled)
  const setSelection = useEditorStore((s) => s.setSelection)

  const handleSelect = (event: MouseEvent<HTMLButtonElement>, id: string) => {
    const additive = multiSelectEnabled || event.shiftKey
    const isSelected = selectedIds.includes(id)
    if (additive) {
      setSelection(isSelected ? selectedIds.filter((item) => item !== id) : uniqueIds([...selectedIds, id]))
      return
    }
    setSelection([id])
  }

  const renderNodeRow = (node: SvgNode, depth = 0): JSX.Element => {
    const isSelected = selectedIds.includes(node.id)
    const hasChildren = Boolean(node.children?.length)

    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={(event) => handleSelect(event, node.id)}
          style={{
            marginLeft: depth * 12,
            padding: '8px 10px',
            borderRadius: 10,
            background: isSelected ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.04)',
            fontSize: 12,
            textAlign: 'left',
            border: isSelected ? '1px solid rgba(147,197,253,0.4)' : '1px solid transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{node.type}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelForNode(node)}</span>
          </span>
          {hasChildren ? <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{node.children?.length}</span> : null}
        </button>
        {hasChildren ? node.children!.map((child) => renderNodeRow(child, depth + 1)) : null}
      </div>
    )
  }

  return (
    <aside
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 280,
        height: '100%',
        padding: 12,
        borderRight: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(17,17,17,0.95)',
        backdropFilter: 'blur(12px)',
        overflowY: 'auto'
      }}
    >
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Layers</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{selectedIds.length} selected</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {nodes.length === 0 ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>No layers yet</div>
        ) : (
          nodes.map((node) => renderNodeRow(node))
        )}
      </div>
    </aside>
  )
}
