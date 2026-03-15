import { Hand, MousePointer2, Square, PenTool, Type, Paintbrush, LayoutGrid, Search } from 'lucide-react'
import { useEditorStore, type EditorMode } from '@/stores/editorStore'
import type { LucideIcon } from 'lucide-react'

const modeConfig: { mode: EditorMode; icon: LucideIcon; label: string; available: boolean }[] = [
  { mode: 'navigate', icon: Hand, label: 'Pan', available: true },
  { mode: 'select', icon: MousePointer2, label: 'Select', available: true },
  { mode: 'shape', icon: Square, label: 'Shape', available: true },
  { mode: 'pen', icon: PenTool, label: 'Pen', available: true },
  { mode: 'text', icon: Type, label: 'Text', available: true },
  { mode: 'paint', icon: Paintbrush, label: 'Paint', available: true },
  { mode: 'structure', icon: LayoutGrid, label: 'Structure', available: true },
  { mode: 'inspect', icon: Search, label: 'Inspect', available: true }
]

export function EditorBottomBar() {
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)
  const setPathEditMode = useEditorStore((s) => s.setPathEditMode)
  const discardPenPath = useEditorStore((s) => s.discardPenPath)
  const setLeftPanelOpen = useEditorStore((s) => s.setLeftPanelOpen)
  const openInspectorSection = useEditorStore((s) => s.openInspectorSection)

  const handleModeClick = (m: EditorMode) => {
    // Clicking any non-path tool while in path mode exits path edit
    if (mode === 'path' && m !== 'path') {
      setPathEditMode(null)
      if (m !== 'select') setMode(m)
      return
    }

    // Leaving pen mode with an in-progress path discards it
    if (mode === 'pen' && m !== 'pen') {
      discardPenPath()
      if (m !== 'select') setMode(m)
      // discardPenPath already sets mode to 'select'; if target is select we're done
      if (m === 'select') return
      // otherwise setMode was called above
      return
    }

    // Structure: open layers panel
    if (m === 'structure') {
      setMode(m)
      setLeftPanelOpen(true)
      return
    }

    // Inspect: pin inspector open
    if (m === 'inspect') {
      openInspectorSection('quick')
      setMode(m)
      return
    }

    // Paint: open appearance inspector
    if (m === 'paint') {
      openInspectorSection('appearance')
      setMode(m)
      return
    }

    setMode(m)
  }

  return (
    <nav
      className="hide-scrollbar"
      style={{
        height: 60,
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
      {modeConfig.map(({ mode: m, icon: Icon, label, available }) => {
        // 'path' mode is shown as 'select' active when editing a path
        const active = mode === m || (mode === 'path' && m === 'select')
        return (
          <button
            key={m}
            onClick={() => handleModeClick(m)}
            title={available ? label : `${label} (coming soon)`}
            style={{
              flex: '1 1 0',
              minWidth: 52,
              maxWidth: 72,
              height: 50,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              borderRadius: 12,
              position: 'relative',
              color: active ? '#93c5fd' : available ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)',
              background: active ? 'rgba(96,165,250,0.14)' : 'transparent',
              transition: 'color 0.1s, background 0.1s'
            }}
          >
            {/* Active indicator bar at bottom */}
            {active && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 16,
                  height: 2,
                  borderRadius: 1,
                  background: '#60a5fa'
                }}
              />
            )}
            <Icon size={20} />
            <span style={{ fontSize: 10, lineHeight: 1, fontWeight: active ? 600 : 400 }}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
