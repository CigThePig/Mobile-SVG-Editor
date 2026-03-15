import { useMemo } from 'react'
import { ArrowLeft, Copy } from 'lucide-react'
import { useNavigation } from '@/app/routing/NavigationContext'
import { useEditorStore } from '@/stores/editorStore'
import { getNodeById } from '@/features/documents/utils/documentMutations'
import { getNodeBounds } from '@/features/selection/utils/nodeBounds'
import type { PathNode, SvgNode } from '@/model/nodes/nodeTypes'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function PropTable({ rows }: { rows: Array<{ label: string; value: string | number | undefined }> }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <tbody>
        {rows.map(({ label, value }) => value != null && (
          <tr key={label} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <td style={{ padding: '6px 0', color: 'rgba(255,255,255,0.45)', width: '40%' }}>{label}</td>
            <td style={{ padding: '6px 0', color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace', textAlign: 'right' }}>
              {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function nodeStyleRows(node: SvgNode) {
  const s = (node as { style?: { fill?: { kind: string; color?: string }; stroke?: { color?: string; width?: number }; opacity?: number } }).style
  if (!s) return []
  const rows: Array<{ label: string; value: string | number | undefined }> = []
  if (s.fill?.kind) rows.push({ label: 'Fill', value: s.fill.kind === 'solid' ? (s.fill.color ?? 'solid') : s.fill.kind })
  if (s.stroke?.color) rows.push({ label: 'Stroke', value: s.stroke.color })
  if (s.stroke?.width != null) rows.push({ label: 'Stroke width', value: s.stroke.width })
  if (s.opacity != null) rows.push({ label: 'Opacity', value: s.opacity })
  return rows
}

function nodeGeometryRows(node: SvgNode): Array<{ label: string; value: string | number | undefined }> {
  switch (node.type) {
    case 'rect': {
      const n = node as { x: number; y: number; width: number; height: number; rx?: number }
      return [
        { label: 'x', value: n.x }, { label: 'y', value: n.y },
        { label: 'width', value: n.width }, { label: 'height', value: n.height },
        ...(n.rx ? [{ label: 'rx', value: n.rx }] : [])
      ]
    }
    case 'ellipse': {
      const n = node as { cx: number; cy: number; rx: number; ry: number }
      return [{ label: 'cx', value: n.cx }, { label: 'cy', value: n.cy }, { label: 'rx', value: n.rx }, { label: 'ry', value: n.ry }]
    }
    case 'circle': {
      const n = node as { cx: number; cy: number; r: number }
      return [{ label: 'cx', value: n.cx }, { label: 'cy', value: n.cy }, { label: 'r', value: n.r }]
    }
    case 'line': {
      const n = node as { x1: number; y1: number; x2: number; y2: number }
      return [{ label: 'x1', value: n.x1 }, { label: 'y1', value: n.y1 }, { label: 'x2', value: n.x2 }, { label: 'y2', value: n.y2 }]
    }
    case 'text': {
      const n = node as { x: number; y: number; content?: string }
      return [{ label: 'x', value: n.x }, { label: 'y', value: n.y }, { label: 'content', value: n.content }]
    }
    case 'path':
      return []
    default:
      return []
  }
}

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text)
}

export function InspectPage() {
  const { navigate } = useNavigation()
  const document = useEditorStore((s) => s.activeDocument)
  const selectedNodeIds = useEditorStore((s) => s.selection.selectedNodeIds)

  const selectedNodes = useMemo(
    () => selectedNodeIds.map((id) => getNodeById(document.root, id)).filter((n): n is SvgNode => Boolean(n)),
    [selectedNodeIds, document]
  )
  const node = selectedNodes[0]

  const bounds = useMemo(() => node ? getNodeBounds(node) : null, [node])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100dvh',
      paddingTop: 'var(--sai-top, 0px)',
      background: '#0a0a0a',
      color: '#fff'
    }}>
      <header style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: '#111',
        flexShrink: 0,
        gap: 8
      }}>
        <button
          onClick={() => navigate('editor')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#93c5fd', fontSize: 14, cursor: 'pointer', padding: '0 4px' }}
        >
          <ArrowLeft size={18} /> Editor
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 600, flex: 1, textAlign: 'center', margin: 0 }}>Inspect</h1>
        <div style={{ width: 72 }} />
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px' }}>
        {!node ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', paddingTop: 40, fontSize: 14 }}>
            Select an object in the editor, then return here to inspect it.
          </div>
        ) : (
          <>
            <Section title="Node">
              <PropTable rows={[
                { label: 'Type', value: node.type },
                { label: 'ID', value: node.id },
                { label: 'Name', value: (node as { name?: string }).name },
                { label: 'Visible', value: String(node.visible !== false) },
                { label: 'Locked', value: String(node.locked === true) },
                ...nodeGeometryRows(node),
                ...nodeStyleRows(node)
              ]} />
            </Section>

            {node.transform && (
              <Section title="Transform">
                <PropTable rows={[
                  { label: 'translateX', value: node.transform.translateX },
                  { label: 'translateY', value: node.transform.translateY },
                  { label: 'rotate', value: node.transform.rotate },
                  { label: 'scaleX', value: node.transform.scaleX },
                  { label: 'scaleY', value: node.transform.scaleY }
                ]} />
              </Section>
            )}

            {bounds && (
              <Section title="Computed Bounds">
                <PropTable rows={[
                  { label: 'x', value: bounds.x },
                  { label: 'y', value: bounds.y },
                  { label: 'width', value: bounds.width },
                  { label: 'height', value: bounds.height }
                ]} />
              </Section>
            )}

            {node.type === 'path' && (
              <Section title="Path Data">
                <div style={{ position: 'relative' }}>
                  <pre style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: '10px 36px 10px 12px',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: 'rgba(255,255,255,0.7)',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    margin: 0
                  }}>
                    {(node as PathNode).d}
                  </pre>
                  <button
                    onClick={() => copyToClipboard((node as PathNode).d)}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'rgba(255,255,255,0.08)',
                      border: 'none',
                      borderRadius: 6,
                      padding: 4,
                      cursor: 'pointer',
                      color: 'rgba(255,255,255,0.55)',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Copy path data"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </Section>
            )}

            {selectedNodes.length > 1 && (
              <Section title="Selection">
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                  {selectedNodes.length} objects selected. Showing details for the first selected object above.
                </p>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
