/**
 * TextSection.tsx
 *
 * Inspector section for text node editing: content, font, style, alignment,
 * spacing, and advanced typography attributes.
 */

import { useCallback } from 'react'
import { runCommand } from '@/features/documents/services/commandRunner'
import type { SvgNode, TextNode, TextStyleModel } from '@/model/nodes/nodeTypes'
import { S, AccordionSection, NumberEditor, SelectRow, TextareaEditor, InlineInput } from '../inspectorShared'

// ─── Component ────────────────────────────────────────────────────────────────

export function TextSection({ node }: { node: SvgNode }) {
  if (node.type !== 'text' && node.type !== 'tspan') return null

  const textNode = node as TextNode
  const nodeId = node.id
  const ts = textNode.textStyle ?? {}

  const updateTextStyle = useCallback(
    (patch: Partial<TextStyleModel>) => {
      void runCommand('document.updateNodeProperties', {
        nodeId,
        properties: { textStyle: { ...ts, ...patch } }
      })
    },
    [nodeId, ts]
  )

  const updateContent = useCallback(
    (content: string) => {
      void runCommand('document.updateNodeProperties', { nodeId, properties: { content } })
    },
    [nodeId]
  )

  return (
    <AccordionSection title="Text" defaultOpen>
      {/* Content */}
      <TextareaEditor
        label="Content"
        value={textNode.content ?? ''}
        onCommit={updateContent}
        rows={3}
      />

      {/* Font */}
      <InlineInput
        label="Font family"
        value={ts.fontFamily ?? ''}
        onCommit={(v) => updateTextStyle({ fontFamily: v || undefined })}
        placeholder="sans-serif"
      />

      <NumberEditor
        label="Font size"
        value={ts.fontSize ?? 16}
        min={4}
        max={1000}
        step={0.5}
        onCommit={(fontSize) => updateTextStyle({ fontSize })}
      />

      <SelectRow
        label="Font weight"
        value={String(ts.fontWeight ?? 'normal')}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'bold', label: 'Bold' },
          { value: '100', label: 'Thin (100)' },
          { value: '200', label: 'Extra Light (200)' },
          { value: '300', label: 'Light (300)' },
          { value: '400', label: 'Regular (400)' },
          { value: '500', label: 'Medium (500)' },
          { value: '600', label: 'Semi Bold (600)' },
          { value: '700', label: 'Bold (700)' },
          { value: '800', label: 'Extra Bold (800)' },
          { value: '900', label: 'Black (900)' }
        ]}
        onChange={(fontWeight) => updateTextStyle({ fontWeight })}
      />

      <SelectRow
        label="Font style"
        value={ts.fontStyle ?? 'normal'}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'italic', label: 'Italic' },
          { value: 'oblique', label: 'Oblique' }
        ]}
        onChange={(fontStyle) => updateTextStyle({ fontStyle: fontStyle as TextStyleModel['fontStyle'] })}
      />

      {/* Alignment */}
      <SelectRow
        label="Text anchor"
        value={ts.textAnchor ?? 'start'}
        options={[
          { value: 'start', label: 'Start' },
          { value: 'middle', label: 'Middle' },
          { value: 'end', label: 'End' }
        ]}
        onChange={(textAnchor) => updateTextStyle({ textAnchor: textAnchor as TextStyleModel['textAnchor'] })}
      />

      <SelectRow
        label="Baseline"
        value={ts.dominantBaseline ?? 'auto'}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'alphabetic', label: 'Alphabetic' },
          { value: 'middle', label: 'Middle' },
          { value: 'hanging', label: 'Hanging' },
          { value: 'mathematical', label: 'Mathematical' },
          { value: 'text-bottom', label: 'Text Bottom' },
          { value: 'text-top', label: 'Text Top' }
        ]}
        onChange={(dominantBaseline) => updateTextStyle({ dominantBaseline })}
      />

      {/* Spacing */}
      <NumberEditor
        label="Letter spacing"
        value={ts.letterSpacing ?? 0}
        step={0.1}
        onCommit={(letterSpacing) => updateTextStyle({ letterSpacing })}
      />

      <NumberEditor
        label="Line height"
        value={ts.lineHeight ?? 1.2}
        min={0}
        max={10}
        step={0.05}
        onCommit={(lineHeight) => updateTextStyle({ lineHeight })}
      />

      {/* Advanced */}
      <SelectRow
        label="Writing mode"
        value={ts.writingMode ?? 'horizontal-tb'}
        options={[
          { value: 'horizontal-tb', label: 'Horizontal' },
          { value: 'vertical-rl', label: 'Vertical R→L' },
          { value: 'vertical-lr', label: 'Vertical L→R' }
        ]}
        onChange={(writingMode) => updateTextStyle({ writingMode })}
      />

      <InlineInput
        label="Decoration"
        value={ts.textDecoration ?? ''}
        onCommit={(v) => updateTextStyle({ textDecoration: v || undefined })}
        placeholder="none"
      />
    </AccordionSection>
  )
}
