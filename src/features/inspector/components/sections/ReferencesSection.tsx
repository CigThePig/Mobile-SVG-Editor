/**
 * ReferencesSection.tsx
 *
 * Inspector section for ID references, referenced-by relationships,
 * UseNode href editing, and ID rename.
 */

import { useState, useCallback, useMemo } from 'react'
import { Copy, Link, ExternalLink } from 'lucide-react'
import { runCommand } from '@/features/documents/services/commandRunner'
import { useEditorStore } from '@/stores/editorStore'
import { buildReferenceGraph, findReferencesTo } from '@/features/references'
import type { SvgNode, UseNode } from '@/model/nodes/nodeTypes'
import { S, AccordionSection, InlineInput, CountBadge } from '../inspectorShared'

// ─── Component ────────────────────────────────────────────────────────────────

export function ReferencesSection({ node }: { node: SvgNode }) {
  const nodeId = node.id
  const document = useEditorStore((s) => s.activeDocument)
  const setSelection = useEditorStore((s) => s.setSelection)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)

  // Build reference graph to find what references this node
  const refGraph = useMemo(() => buildReferenceGraph(document), [document])
  const referencedBy = useMemo(() => findReferencesTo(refGraph, nodeId), [refGraph, nodeId])

  const copyId = useCallback(() => {
    void navigator.clipboard.writeText(nodeId)
  }, [nodeId])

  const startRename = () => {
    setRenameValue(nodeId)
    setRenaming(true)
  }

  const commitRename = (newId: string) => {
    setRenaming(false)
    const trimmed = newId.trim()
    if (trimmed && trimmed !== nodeId) {
      void runCommand('references.renameId', { oldId: nodeId, newId: trimmed })
    }
  }

  const jumpToTarget = useCallback(
    (targetId: string) => {
      const cleanId = targetId.replace(/^#/, '')
      setSelection([cleanId])
    },
    [setSelection]
  )

  const isUseNode = node.type === 'use'
  const useNode = isUseNode ? (node as UseNode) : null
  const targetId = useNode?.href?.replace(/^#/, '')

  return (
    <AccordionSection
      title="References"
      badge={referencedBy.length > 0 ? <CountBadge count={referencedBy.length} /> : undefined}
    >
      {/* Element ID */}
      <div style={S.row}>
        <span style={S.label}>Element ID</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...S.value, ...S.mono, fontSize: 11, color: node.id ? '#93c5fd' : 'rgba(255,255,255,0.3)' }}>
            {node.id || '(none)'}
          </span>
          {node.id && (
            <button onClick={copyId} style={{ ...S.actionBtnSmall, padding: '2px 6px' }} title="Copy ID">
              <Copy size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Rename ID */}
      {!renaming ? (
        <div style={{ paddingBottom: 4 }}>
          <button onClick={startRename} style={{ ...S.actionBtnSmall, marginTop: 2 }}>
            <Link size={10} /> Rename ID
          </button>
        </div>
      ) : (
        <div style={{ ...S.row, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <span style={S.label}>New ID</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={renameValue}
              autoFocus
              style={{ ...S.inputFull, flex: 1 }}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(renameValue)
                if (e.key === 'Escape') setRenaming(false)
              }}
            />
            <button onClick={() => commitRename(renameValue)} style={S.actionBtnSmall}>
              Apply
            </button>
            <button onClick={() => setRenaming(false)} style={S.actionBtnSmall}>
              Cancel
            </button>
          </div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            All references will be updated automatically.
          </span>
        </div>
      )}

      {/* UseNode href */}
      {isUseNode && useNode && (
        <>
          <div style={{ ...S.sectionHeader, marginTop: 10 }}>Use Target</div>
          <InlineInput
            label="href"
            value={useNode.href}
            onCommit={(href) => {
              void runCommand('document.updateNodeProperties', { nodeId, properties: { href } })
            }}
            placeholder="#element-id"
            mono
          />
          {targetId && (
            <button
              onClick={() => jumpToTarget(targetId)}
              style={{ ...S.actionBtnSmall, marginTop: 4 }}
            >
              <ExternalLink size={10} /> Jump to target
            </button>
          )}
        </>
      )}

      {/* Referenced by */}
      {referencedBy.length > 0 && (
        <>
          <div style={{ ...S.sectionHeader, marginTop: 10 }}>Referenced By</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {referencedBy.slice(0, 10).map((edge) => (
              <div
                key={`${edge.sourceId}-${edge.slot}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 6,
                  gap: 8
                }}
              >
                <span style={{ ...S.mono, fontSize: 11, color: 'rgba(255,255,255,0.6)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {edge.sourceId}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                  via {edge.slot}
                </span>
                <button
                  onClick={() => jumpToTarget(edge.sourceId)}
                  style={{ ...S.actionBtnSmall, padding: '1px 5px' }}
                >
                  <ExternalLink size={9} />
                </button>
              </div>
            ))}
            {referencedBy.length > 10 && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', paddingLeft: 2 }}>
                +{referencedBy.length - 10} more
              </span>
            )}
          </div>
        </>
      )}

      {referencedBy.length === 0 && !isUseNode && (
        <div style={{ paddingBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Not referenced by any element</span>
        </div>
      )}
    </AccordionSection>
  )
}
