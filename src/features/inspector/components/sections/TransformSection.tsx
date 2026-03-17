/**
 * TransformSection.tsx
 *
 * Inspector section for full TransformModel editing:
 * translate, rotate, scale, skew, pivot, and raw matrix display.
 */

import { useCallback } from 'react'
import { RotateCcw } from 'lucide-react'
import { runCommand } from '@/features/documents/services/commandRunner'
import type { SvgNode, TransformModel } from '@/model/nodes/nodeTypes'
import { S, AccordionSection, NumberEditor, SectionHeader } from '../inspectorShared'

// ─── Component ────────────────────────────────────────────────────────────────

export function TransformSection({ node }: { node: SvgNode }) {
  const nodeId = node.id
  const t = node.transform ?? {}

  const update = useCallback(
    (patch: Partial<TransformModel>) => {
      void runCommand('document.updateNodeTransform', { nodeId, transform: patch })
    },
    [nodeId]
  )

  const resetTransform = useCallback(() => {
    void runCommand('document.updateNodeTransform', { nodeId, transform: {} })
  }, [nodeId])

  // If only a raw matrix is present, show it read-only
  const hasMatrix = Boolean(t.matrix)
  const hasDecomposed =
    t.translateX !== undefined ||
    t.translateY !== undefined ||
    t.scaleX !== undefined ||
    t.scaleY !== undefined ||
    t.rotate !== undefined ||
    t.skewX !== undefined ||
    t.skewY !== undefined

  const isEmptyTransform = !hasMatrix && !hasDecomposed

  return (
    <AccordionSection title="Transform">
      {/* Translate */}
      <SectionHeader label="Translate" />
      <NumberEditor
        label="X"
        value={t.translateX ?? 0}
        step={0.5}
        onCommit={(v) => update({ translateX: v })}
      />
      <NumberEditor
        label="Y"
        value={t.translateY ?? 0}
        step={0.5}
        onCommit={(v) => update({ translateY: v })}
      />

      {/* Rotate */}
      <SectionHeader label="Rotate" />
      <NumberEditor
        label="Angle °"
        value={t.rotate ?? 0}
        min={-360}
        max={360}
        step={0.5}
        onCommit={(v) => update({ rotate: v })}
      />

      {/* Scale */}
      <SectionHeader label="Scale" />
      <NumberEditor
        label="Scale X"
        value={t.scaleX ?? 1}
        min={-100}
        max={100}
        step={0.01}
        onCommit={(v) => update({ scaleX: v })}
      />
      <NumberEditor
        label="Scale Y"
        value={t.scaleY ?? 1}
        min={-100}
        max={100}
        step={0.01}
        onCommit={(v) => update({ scaleY: v })}
      />

      {/* Skew */}
      <SectionHeader label="Skew" />
      <NumberEditor
        label="Skew X °"
        value={t.skewX ?? 0}
        min={-89}
        max={89}
        step={0.5}
        onCommit={(v) => update({ skewX: v })}
      />
      <NumberEditor
        label="Skew Y °"
        value={t.skewY ?? 0}
        min={-89}
        max={89}
        step={0.5}
        onCommit={(v) => update({ skewY: v })}
      />

      {/* Pivot (shown only when rotation/scale is active) */}
      {(t.rotate || (t.scaleX && t.scaleX !== 1) || (t.scaleY && t.scaleY !== 1)) && (
        <>
          <SectionHeader label="Pivot" />
          <NumberEditor
            label="Pivot X"
            value={t.pivotX ?? 0}
            step={0.5}
            onCommit={(v) => update({ pivotX: v })}
          />
          <NumberEditor
            label="Pivot Y"
            value={t.pivotY ?? 0}
            step={0.5}
            onCommit={(v) => update({ pivotY: v })}
          />
        </>
      )}

      {/* Raw matrix display (read-only if present) */}
      {hasMatrix && t.matrix && (
        <>
          <SectionHeader label="Matrix (raw)" />
          <MatrixDisplay matrix={t.matrix} />
        </>
      )}

      {/* Reset button */}
      {!isEmptyTransform && (
        <div style={{ paddingTop: 6 }}>
          <button onClick={resetTransform} style={S.actionBtn}>
            <RotateCcw size={12} /> Reset Transform
          </button>
        </div>
      )}
    </AccordionSection>
  )
}

function MatrixDisplay({ matrix }: { matrix: [number, number, number, number, number, number] }) {
  const [a, b, c, d, e, f] = matrix
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 4,
        padding: '4px 0'
      }}
    >
      {[
        ['a', a], ['c', c], ['e', e],
        ['b', b], ['d', d], ['f', f]
      ].map(([label, val]) => (
        <div
          key={String(label)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 6,
            padding: '4px 2px'
          }}
        >
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 1 }}>
            {label}
          </span>
          <span style={{ fontSize: 11, ...S.mono, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>
            {typeof val === 'number' ? (Math.round(val * 1000) / 1000).toString() : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}
