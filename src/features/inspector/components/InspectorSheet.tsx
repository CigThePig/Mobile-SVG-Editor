/**
 * InspectorSheet.tsx
 *
 * Phase 8: Complete structural editor inspector.
 *
 * Rebuilt as a full-featured inspector with accordion sections covering:
 * - Identity (name, type, ID, class, visibility, lock)
 * - Geometry (position, size — node-type specific)
 * - Fill (solid, gradient, pattern, none)
 * - Stroke (color, width, linecap, linejoin, dasharray)
 * - Transform (translate, rotate, scale, skew, matrix)
 * - Text (content, font, style, alignment, spacing)
 * - References (ID, rename, referenced-by, use href)
 * - Effects (filter, mask, clipPath, blend mode, markers)
 * - Attributes (accessibility, data, advanced, raw preserved)
 * - Actions (duplicate, delete, reorder)
 * - Jump to source
 * - Multi-selection view
 */

import { useCallback } from 'react'
import { Drawer } from 'vaul'
import {
  Layers,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ChevronsUp,
  ChevronsDown,
  ChevronUp,
  ChevronDown,
  Code2
} from 'lucide-react'
import { getNodeById } from '@/features/documents/utils/documentMutations'
import { runCommand } from '@/features/documents/services/commandRunner'
import { useEditorStore } from '@/stores/editorStore'
import { useSourceStore } from '@/features/source/sourceState'
import { isShapeNode, isTextNodeType } from '@/model/nodes/nodeTypeGuards'
import type { SvgNode } from '@/model/nodes/nodeTypes'

// Section imports
import { IdentitySection } from './sections/IdentitySection'
import { GeometrySection } from './sections/GeometrySection'
import { FillSection } from './sections/FillSection'
import { StrokeSection } from './sections/StrokeSection'
import { TransformSection } from './sections/TransformSection'
import { TextSection } from './sections/TextSection'
import { ReferencesSection } from './sections/ReferencesSection'
import { EffectsSection } from './sections/EffectsSection'
import { AttributesSection } from './sections/AttributesSection'
import { MultiSelectionInspector } from './sections/MultiSelectionInspector'
import { S, AccordionSection } from './inspectorShared'

// ─── Node has geometry ────────────────────────────────────────────────────────

function nodeHasGeometry(node: SvgNode): boolean {
  return (
    isShapeNode(node) ||
    isTextNodeType(node) ||
    node.type === 'image' ||
    node.type === 'use'
  )
}

// ─── Node types that carry a style property ───────────────────────────────────
// These are the node types with an optional `style?: AppearanceModel` field.

const STYLE_NODE_TYPES = new Set([
  'group', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'star', 'path', 'text', 'tspan', 'textPath', 'image', 'symbol', 'use',
  'marker', 'a'
])

function nodeHasStyle(node: SvgNode): boolean {
  return STYLE_NODE_TYPES.has(node.type)
}

// ─── Single node inspector ────────────────────────────────────────────────────

function SingleNodeInspector({ node }: { node: SvgNode }) {
  const nodeId = node.id
  const openSource = useSourceStore((s) => s.openSource)

  const duplicate = useCallback(() => {
    void runCommand('document.duplicateNodes', { nodeIds: [nodeId] })
  }, [nodeId])

  const deleteNode = useCallback(() => {
    void runCommand('document.deleteNodes', { nodeIds: [nodeId] })
  }, [nodeId])

  const reorder = useCallback(
    (direction: 'up' | 'down' | 'front' | 'back') => {
      void runCommand('document.reorderNode', { nodeId, direction })
    },
    [nodeId]
  )

  return (
    <div>
      {/* Identity section — always first */}
      <IdentitySection node={node} />

      {/* Geometry — for nodes with geometric properties */}
      {nodeHasGeometry(node) && <GeometrySection node={node} />}

      {/* Fill and Stroke — for nodes with style */}
      {nodeHasStyle(node) && (
        <>
          <FillSection node={node} />
          <StrokeSection node={node} />
        </>
      )}

      {/* Transform — always available */}
      <TransformSection node={node} />

      {/* Text — text and tspan nodes only */}
      {(node.type === 'text' || node.type === 'tspan') && <TextSection node={node} />}

      {/* References — always */}
      <ReferencesSection node={node} />

      {/* Effects — for nodes with style */}
      {nodeHasStyle(node) && <EffectsSection node={node} />}

      {/* Attributes — always */}
      <AttributesSection node={node} />

      {/* Actions */}
      <AccordionSection title="Actions">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 4 }}>
          <button onClick={duplicate} style={S.actionBtn}>
            <Copy size={13} /> Duplicate
          </button>
          <button onClick={deleteNode} style={S.actionBtnDanger}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
          <button onClick={() => reorder('front')} style={S.actionBtn}>
            <ChevronsUp size={13} /> Front
          </button>
          <button onClick={() => reorder('up')} style={S.actionBtn}>
            <ChevronUp size={13} /> Forward
          </button>
          <button onClick={() => reorder('down')} style={S.actionBtn}>
            <ChevronDown size={13} /> Backward
          </button>
          <button onClick={() => reorder('back')} style={S.actionBtn}>
            <ChevronsDown size={13} /> Back
          </button>
        </div>
      </AccordionSection>

      {/* Jump to source */}
      <div
        style={{
          padding: '12px 0 8px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          marginTop: 8
        }}
      >
        <button
          onClick={() => openSource()}
          style={{
            ...S.actionBtn,
            width: '100%',
            justifyContent: 'center',
            gap: 6,
            background: 'rgba(147,197,253,0.08)',
            border: '1px solid rgba(147,197,253,0.2)',
            color: '#93c5fd'
          }}
        >
          <Code2 size={13} /> Open in Source Editor
        </button>
        {node.preservation?.sourceOffset !== undefined && (
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
              Source offset: {node.preservation.sourceOffset}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyInspector() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        gap: 8
      }}
    >
      <span style={{ fontSize: 28 }}>✦</span>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
        Select an object on the canvas to inspect it.
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InspectorSheet() {
  const open = useEditorStore((s) => s.ui.rightPanelOpen)
  const setOpen = useEditorStore((s) => s.setRightPanelOpen)
  const lockAspectRatio = useEditorStore((s) => s.ui.lockAspectRatio)
  const multiSelectEnabled = useEditorStore((s) => s.ui.multiSelectEnabled)
  const toggleAspectRatioLock = useEditorStore((s) => s.toggleAspectRatioLock)
  const toggleMultiSelectEnabled = useEditorStore((s) => s.toggleMultiSelectEnabled)
  const selection = useEditorStore((s) => s.selection.selectedNodeIds)
  const document = useEditorStore((s) => s.activeDocument)
  const openSource = useSourceStore((s) => s.openSource)

  const selectedNodes = selection
    .map((id) => getNodeById(document.root, id))
    .filter((n): n is SvgNode => Boolean(n))

  const activeNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Portal>
        <Drawer.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 40
          }}
        />
        <Drawer.Content
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: '80dvh',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            background: 'rgba(18,18,18,0.98)',
            backdropFilter: 'blur(16px)',
            paddingBottom: 'calc(var(--sai-bottom, 0px) + 8px)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            outline: 'none',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.5)'
          }}
        >
          <Drawer.Handle
            style={{
              background: 'rgba(255,255,255,0.2)',
              marginTop: 8,
              marginBottom: 0
            }}
          />

          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px 8px',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Inspector</div>
              {activeNode && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: 'rgba(255,255,255,0.07)',
                    padding: '2px 7px',
                    borderRadius: 4
                  }}
                >
                  {activeNode.type}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Quick toggles */}
              <button
                onClick={toggleMultiSelectEnabled}
                title={multiSelectEnabled ? 'Multi-select on' : 'Multi-select off'}
                style={{
                  ...S.actionBtnSmall,
                  color: multiSelectEnabled ? '#93c5fd' : 'rgba(255,255,255,0.4)'
                }}
              >
                <Layers size={13} />
              </button>
              <button
                onClick={toggleAspectRatioLock}
                title={lockAspectRatio ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                style={{
                  ...S.actionBtnSmall,
                  color: lockAspectRatio ? '#93c5fd' : 'rgba(255,255,255,0.4)'
                }}
              >
                {lockAspectRatio ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
              {/* Jump to source */}
              <button
                onClick={() => openSource()}
                title="Open source editor"
                style={{ ...S.actionBtnSmall, color: '#93c5fd' }}
              >
                <Code2 size={13} />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: '0 16px',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {selectedNodes.length === 0 && <EmptyInspector />}
            {activeNode && <SingleNodeInspector node={activeNode} />}
            {selectedNodes.length > 1 && <MultiSelectionInspector nodes={selectedNodes} />}
            <div style={{ height: 16 }} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
