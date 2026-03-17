/**
 * EffectsSection.tsx
 *
 * Inspector section for SVG effects and references:
 * filterRef, maskRef, clipPathRef, blendMode, and marker refs.
 */

import { useCallback } from 'react'
import { X } from 'lucide-react'
import { runCommand } from '@/features/documents/services/commandRunner'
import type { SvgNode, AppearanceModel } from '@/model/nodes/nodeTypes'
import { S, AccordionSection, SelectRow } from '../inspectorShared'

// ─── Blend mode options ───────────────────────────────────────────────────────

const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light',
  'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStyle(node: SvgNode): AppearanceModel {
  return (node as { style?: AppearanceModel }).style ?? {}
}

const STYLE_NODE_TYPES = new Set(['group', 'rect', 'circle', 'ellipse', 'line', 'polyline',
  'polygon', 'star', 'path', 'text', 'tspan', 'textPath', 'image', 'symbol', 'use', 'marker', 'a'])

function hasStyle(node: SvgNode): boolean {
  return STYLE_NODE_TYPES.has(node.type)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EffectsSection({ node }: { node: SvgNode }) {
  const nodeId = node.id

  if (!hasStyle(node)) return null

  const style = getStyle(node)

  const updateStyle = useCallback(
    (patch: Partial<AppearanceModel>) => {
      void runCommand('document.updateNodeStyle', { nodeId, style: patch })
    },
    [nodeId]
  )

  const hasAnyEffect =
    style.filterRef || style.maskRef || style.clipPathRef || style.blendMode ||
    style.markerStartRef || style.markerMidRef || style.markerEndRef

  return (
    <AccordionSection title="Effects" defaultOpen={Boolean(hasAnyEffect)}>
      {/* Filter */}
      <RefInput
        label="Filter"
        value={style.filterRef}
        placeholder="url(#filter-id)"
        onCommit={(v) => updateStyle({ filterRef: v || undefined })}
        onClear={() => updateStyle({ filterRef: undefined })}
      />

      {/* Mask */}
      <RefInput
        label="Mask"
        value={style.maskRef}
        placeholder="url(#mask-id)"
        onCommit={(v) => updateStyle({ maskRef: v || undefined })}
        onClear={() => updateStyle({ maskRef: undefined })}
      />

      {/* Clip path */}
      <RefInput
        label="Clip path"
        value={style.clipPathRef}
        placeholder="url(#clip-id)"
        onCommit={(v) => updateStyle({ clipPathRef: v || undefined })}
        onClear={() => updateStyle({ clipPathRef: undefined })}
      />

      {/* Blend mode */}
      <SelectRow
        label="Blend mode"
        value={style.blendMode ?? 'normal'}
        options={BLEND_MODES.map((m) => ({ value: m, label: m }))}
        onChange={(blendMode) => updateStyle({ blendMode: blendMode === 'normal' ? undefined : blendMode })}
      />

      {/* Marker start */}
      <RefInput
        label="Marker start"
        value={style.markerStartRef}
        placeholder="url(#marker-id)"
        onCommit={(v) => updateStyle({ markerStartRef: v || undefined })}
        onClear={() => updateStyle({ markerStartRef: undefined })}
      />

      {/* Marker mid */}
      <RefInput
        label="Marker mid"
        value={style.markerMidRef}
        placeholder="url(#marker-id)"
        onCommit={(v) => updateStyle({ markerMidRef: v || undefined })}
        onClear={() => updateStyle({ markerMidRef: undefined })}
      />

      {/* Marker end */}
      <RefInput
        label="Marker end"
        value={style.markerEndRef}
        placeholder="url(#marker-id)"
        onCommit={(v) => updateStyle({ markerEndRef: v || undefined })}
        onClear={() => updateStyle({ markerEndRef: undefined })}
      />

      {!hasAnyEffect && (
        <div style={{ paddingBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            No effects applied. Enter a resource reference above.
          </span>
        </div>
      )}
    </AccordionSection>
  )
}

// ─── RefInput ─────────────────────────────────────────────────────────────────

function RefInput({
  label,
  value,
  placeholder,
  onCommit,
  onClear
}: {
  label: string
  value: string | undefined
  placeholder: string
  onCommit: (v: string) => void
  onClear: () => void
}) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
        <input
          type="text"
          defaultValue={value ?? ''}
          placeholder={placeholder}
          style={{ ...S.input, width: 140, textAlign: 'left', ...S.mono, fontSize: 10 }}
          onBlur={(e) => onCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        {value && (
          <button
            onClick={onClear}
            style={{
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="Clear"
          >
            <X size={10} />
          </button>
        )}
      </div>
    </div>
  )
}
