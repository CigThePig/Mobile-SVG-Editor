import { ArrowLeft } from 'lucide-react'
import { useNavigation } from '@/app/routing/NavigationContext'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { db } from '@/db/dexie/db'

const ANGLE_OPTIONS = [5, 10, 15, 22.5, 30, 45, 90]
const EXPORT_SCALES = [1, 2, 3]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: '0 0 12px' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  color: '#fff',
  padding: '6px 10px',
  fontSize: 13,
  width: 80,
  textAlign: 'right'
}

const selectStyle: React.CSSProperties = {
  background: 'rgba(30,30,30,0.95)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  color: '#fff',
  padding: '6px 10px',
  fontSize: 13
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: on ? '#818cf8' : 'rgba(255,255,255,0.15)',
        position: 'relative',
        cursor: 'pointer',
        border: 'none',
        flexShrink: 0
      }}
      onClick={() => onChange(!on)}
      aria-label={on ? 'On' : 'Off'}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: on ? 22 : 2,
        width: 20,
        height: 20,
        borderRadius: 10,
        background: '#fff',
        display: 'block'
      }} />
    </button>
  )
}

export function SettingsPage() {
  const { navigate } = useNavigation()
  const settings = useSettingsStore()
  const view = useEditorStore((s) => s.view)

  const handleGridSizeChange = (v: number) => {
    settings.setDefaultGridSize(v)
    useEditorStore.setState((state) => {
      state.view.snapConfig.gridSize = Math.max(1, v)
    })
  }

  const handleAngleSnapChange = (v: number) => {
    settings.setAngleSnapDegrees(v)
    useEditorStore.setState((state) => {
      state.view.snapConfig.angleSnapDegrees = v
    })
  }

  const handleClearAll = async () => {
    if (!confirm('Delete ALL documents and snapshots? This cannot be undone.')) return
    await db.documents.clear()
    await db.snapshots.clear()
    navigate('home')
  }

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
        <h1 style={{ fontSize: 16, fontWeight: 600, flex: 1, textAlign: 'center', margin: 0 }}>Settings</h1>
        <div style={{ width: 72 }} />
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        <Section title="Snap & Grid">
          <Row label="Default grid size (px)">
            <input
              type="number"
              min={1}
              max={200}
              value={settings.defaultGridSize}
              style={inputStyle}
              onChange={(e) => handleGridSizeChange(Number(e.target.value))}
            />
          </Row>
          <Row label="Snap threshold (px)">
            <input
              type="range"
              min={4}
              max={40}
              step={1}
              value={settings.snapThresholdPx}
              style={{ width: 100 }}
              onChange={(e) => settings.setSnapThresholdPx(Number(e.target.value))}
            />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', minWidth: 28 }}>
              {settings.snapThresholdPx}px
            </span>
          </Row>
          <Row label="Angle snap">
            <select
              value={settings.angleSnapDegrees}
              style={selectStyle}
              onChange={(e) => handleAngleSnapChange(Number(e.target.value))}
            >
              {ANGLE_OPTIONS.map((deg) => (
                <option key={deg} value={deg}>{deg}°</option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title="View">
          <Row label="Outline mode by default">
            <Toggle on={settings.outlineModeDefault} onChange={settings.setOutlineModeDefault} />
          </Row>
          <Row label="Show guides by default">
            <Toggle on={view.showGuides} onChange={(v) => {
              useEditorStore.setState((state) => { state.view.showGuides = v })
            }} />
          </Row>
          <Row label="Show grid by default">
            <Toggle on={view.showGrid} onChange={(v) => {
              useEditorStore.setState((state) => { state.view.showGrid = v })
            }} />
          </Row>
        </Section>

        <Section title="Export">
          <Row label="Default export scale">
            <div style={{ display: 'flex', gap: 6 }}>
              {EXPORT_SCALES.map((s) => (
                <button
                  key={s}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: settings.defaultExportScale === s ? '#818cf8' : 'rgba(255,255,255,0.15)',
                    background: settings.defaultExportScale === s ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.06)',
                    color: settings.defaultExportScale === s ? '#c7d2fe' : 'rgba(255,255,255,0.7)',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                  onClick={() => settings.setDefaultExportScale(s)}
                >
                  {s}×
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section title="About">
          <Row label="Version">
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>0.0.1</span>
          </Row>
          <Row label="Clear all documents">
            <button
              onClick={() => void handleClearAll()}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: 'rgba(252,165,165,0.9)',
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Delete All
            </button>
          </Row>
        </Section>
      </div>
    </div>
  )
}
