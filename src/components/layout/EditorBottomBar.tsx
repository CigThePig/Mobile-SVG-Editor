import { useEditorStore, type EditorMode } from '@/stores/editorStore'

const modes: EditorMode[] = ['navigate', 'select', 'shape', 'pen', 'text', 'paint', 'structure', 'inspect']

export function EditorBottomBar() {
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)

  return (
    <nav
      style={{
        height: 64,
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        background: '#111111'
      }}
    >
      {modes.map((item) => (
        <button
          key={item}
          onClick={() => setMode(item)}
          style={{
            color: mode === item ? '#ffffff' : 'rgba(255,255,255,0.7)',
            background: mode === item ? 'rgba(255,255,255,0.08)' : 'transparent',
            textTransform: 'capitalize',
            fontSize: 12
          }}
        >
          {item}
        </button>
      ))}
    </nav>
  )
}
