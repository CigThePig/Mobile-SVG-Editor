/**
 * FillSection.tsx
 *
 * Inspector section for fill editing: solid color, gradient reference, pattern reference, or none.
 */

import { useState, useCallback } from 'react'
import { Palette } from 'lucide-react'
import { runCommand } from '@/features/documents/services/commandRunner'
import { useEditorStore } from '@/stores/editorStore'
import { GradientEditorSheet } from '@/features/resources/components/GradientEditorSheet'
import type { SvgNode, AppearanceModel, PaintModel } from '@/model/nodes/nodeTypes'
import { S, AccordionSection, ColorEditor, SelectRow } from '../inspectorShared'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStyle(node: SvgNode): AppearanceModel {
  return (node as { style?: AppearanceModel }).style ?? {}
}

function getFill(node: SvgNode): PaintModel | undefined {
  return getStyle(node).fill
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FillSection({ node }: { node: SvgNode }) {
  const nodeId = node.id
  const style = getStyle(node)
  const fill = getFill(node)
  const [gradientsOpen, setGradientsOpen] = useState(false)

  const document = useEditorStore((s) => s.activeDocument)
  const gradients = document.resources?.gradients ?? []

  // Guard: only render for nodes that have a style property
  const styleNodeTypes = new Set(['group', 'rect', 'circle', 'ellipse', 'line', 'polyline',
    'polygon', 'star', 'path', 'text', 'tspan', 'textPath', 'image', 'symbol', 'use', 'marker', 'a'])
  if (!styleNodeTypes.has(node.type)) return null

  const currentKind = fill?.kind ?? 'solid'

  const setFill = useCallback(
    (newFill: PaintModel) => {
      void runCommand('document.updateNodeStyle', { nodeId, style: { fill: newFill } })
    },
    [nodeId]
  )

  const handleKindChange = (kind: string) => {
    switch (kind) {
      case 'none':
        setFill({ kind: 'none' })
        break
      case 'solid': {
        const existingColor = fill?.kind === 'solid' ? fill.color : '#4f8ef7'
        setFill({ kind: 'solid', color: existingColor ?? '#4f8ef7' })
        break
      }
      case 'gradient': {
        const firstGrad = gradients[0]
        if (firstGrad) setFill({ kind: 'gradient', resourceId: firstGrad.id })
        break
      }
      case 'pattern':
        // Patterns will be handled in Phase 10
        break
    }
  }

  const handleColorChange = useCallback(
    (color: string) => {
      setFill({ kind: 'solid', color })
    },
    [setFill]
  )

  const handleGradientChange = (resourceId: string) => {
    setFill({ kind: 'gradient', resourceId })
  }

  return (
    <>
      <AccordionSection title="Fill" defaultOpen>
        {/* Kind selector */}
        <SelectRow
          label="Type"
          value={currentKind}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'none', label: 'None' },
            { value: 'gradient', label: 'Gradient' },
            { value: 'pattern', label: 'Pattern' }
          ]}
          onChange={handleKindChange}
        />

        {/* Solid color */}
        {fill?.kind === 'solid' && (
          <>
            <ColorEditor
              label="Color"
              color={fill.color ?? '#000000'}
              onChange={handleColorChange}
            />
            {fill.opacity !== undefined && (
              <div style={S.row}>
                <span style={S.label}>Fill opacity</span>
                <span style={S.value}>{Math.round(fill.opacity * 100)}%</span>
              </div>
            )}
          </>
        )}

        {/* None */}
        {fill?.kind === 'none' && (
          <div style={S.row}>
            <span style={S.label}>Fill</span>
            <span style={{ ...S.value, color: 'rgba(255,255,255,0.3)' }}>None</span>
          </div>
        )}

        {/* Gradient */}
        {fill?.kind === 'gradient' && (
          <div style={{ paddingBottom: 8 }}>
            <div style={S.row}>
              <span style={S.label}>Gradient</span>
              <span style={{ ...S.value, ...S.mono, fontSize: 11, color: '#93c5fd' }}>
                {fill.resourceId}
              </span>
            </div>

            {gradients.length > 1 && (
              <SelectRow
                label="Select"
                value={fill.resourceId}
                options={gradients.map((g) => ({ value: g.id, label: g.name ?? g.id }))}
                onChange={handleGradientChange}
              />
            )}

            <button
              onClick={() => setGradientsOpen(true)}
              style={{ ...S.actionBtn, marginTop: 6, gap: 5 }}
            >
              <Palette size={12} /> Edit Gradient
            </button>
          </div>
        )}

        {/* Pattern (Phase 10) */}
        {fill?.kind === 'pattern' && (
          <div style={S.row}>
            <span style={S.label}>Pattern</span>
            <span style={{ ...S.value, ...S.mono, fontSize: 11, color: '#93c5fd' }}>
              {fill.resourceId}
            </span>
          </div>
        )}

        {/* No fill set at all */}
        {fill === undefined && (
          <div style={S.row}>
            <span style={S.label}>Fill</span>
            <span style={{ ...S.value, color: 'rgba(255,255,255,0.3)' }}>Inherited / unset</span>
          </div>
        )}

        {/* Opacity at style level */}
        {style.opacity !== undefined && (
          <div style={S.row}>
            <span style={S.label}>Opacity</span>
            <span style={S.value}>{Math.round(style.opacity * 100)}%</span>
          </div>
        )}
      </AccordionSection>

      <GradientEditorSheet open={gradientsOpen} onOpenChange={setGradientsOpen} />
    </>
  )
}
