import { Hand, MousePointer2, Square, PenTool, Type, Paintbrush, LayoutGrid, Search } from 'lucide-react'
import { useEditorStore, type EditorMode } from '@/stores/editorStore'
import type { LucideIcon } from 'lucide-react'

const modeConfig: { mode: EditorMode; icon: LucideIcon; label: string }[] = [
  { mode: 'navigate', icon: Hand, label: 'Move' },
  { mode: 'select', icon: MousePointer2, label: 'Select' },
  { mode: 'shape', icon: Square, label: 'Shape' },
  { mode: 'pen', icon: PenTool, label: 'Pen' },
  { mode: 'text', icon: Type, label: 'Text' },
  { mode: 'paint', icon: Paintbrush, label: 'Paint' },
  { mode: 'structure', icon: LayoutGrid, label: 'Struct' },
  { mode: 'inspect', icon: Search, label: 'Inspect' }
]

export function EditorBottomBar() {
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)

  return (
    <nav
      className="hide-scrollbar"
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        background: '#111111',
        paddingLeft: 8,
        paddingRight: 8,
        paddingBottom: 'var(--sai-bottom, 0px)',
        flexShrink: 0
      }}
    >
      {modeConfig.map(({ mode: m, icon: Icon, label }) => {
        const active = mode === m
        return (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: '0 0 auto',
              width: 46,
              height: 44,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              borderRadius: 10,
              color: active ? '#93c5fd' : 'rgba(255,255,255,0.6)',
              background: active ? 'rgba(96,165,250,0.15)' : 'transparent'
            }}
          >
            <Icon size={20} />
            <span style={{ fontSize: 9, lineHeight: 1 }}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
