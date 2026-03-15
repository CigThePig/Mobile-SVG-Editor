import { useState, useEffect, useCallback } from 'react'
import { Drawer } from 'vaul'
import { Camera, RotateCcw, Trash2, Clock } from 'lucide-react'
import { saveSnapshot, listSnapshots, deleteSnapshot, saveDocument } from '@/db/dexie/queries'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import type { SnapshotRecord } from '@/db/dexie/queries'

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const S = {
  sectionHeader: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 4, marginTop: 12
  } as React.CSSProperties,
  actionBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '6px 12px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12, cursor: 'pointer', flexShrink: 0
  } as React.CSSProperties,
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SnapshotsSheet({ open, onOpenChange }: Props) {
  const activeDocument = useEditorStore((s) => s.activeDocument)
  const replaceDocument = useEditorStore((s) => s.replaceDocument)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const clearHistory = useHistoryStore((s) => s.clear)
  const undoStack = useHistoryStore((s) => s.undoStack)

  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([])
  const [labelInput, setLabelInput] = useState('')
  const [showLabelInput, setShowLabelInput] = useState(false)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    const list = await listSnapshots(activeDocument.id)
    setSnapshots(list)
  }, [activeDocument.id])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const handleSave = async () => {
    setSaving(true)
    const label = labelInput.trim() || `Snapshot ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    await saveSnapshot(activeDocument.id, activeDocument, label)
    setLabelInput('')
    setShowLabelInput(false)
    await refresh()
    setSaving(false)
  }

  const handleRestore = async (snapshot: SnapshotRecord) => {
    replaceDocument(snapshot.data)
    clearSelection()
    clearHistory()
    await saveDocument(snapshot.data)
    onOpenChange(false)
  }

  const handleDelete = async (id: string) => {
    await deleteSnapshot(id)
    await refresh()
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
        <Drawer.Content
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            maxHeight: '80dvh',
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            background: 'rgba(18,18,18,0.98)', backdropFilter: 'blur(16px)',
            paddingBottom: 'calc(var(--sai-bottom, 0px) + 8px)',
            zIndex: 50, display: 'flex', flexDirection: 'column', outline: 'none',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.5)'
          }}
        >
          <Drawer.Handle style={{ background: 'rgba(255,255,255,0.2)', marginTop: 8 }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 8px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Snapshots</div>
            <button
              onClick={() => setShowLabelInput((v) => !v)}
              style={{ ...S.actionBtn, background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.25)', color: '#93c5fd' }}
            >
              <Camera size={13} />
              Save Snapshot
            </button>
          </div>

          {showLabelInput && (
            <div style={{ padding: '4px 16px 12px', display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Label (optional)"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSave() }}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: '#fff', fontSize: 13,
                  padding: '8px 12px', outline: 'none'
                }}
                autoFocus
              />
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                style={{ ...S.actionBtn, background: '#3b82f6', border: '1px solid #2563eb', color: '#fff', opacity: saving ? 0.5 : 1 }}
              >
                Save
              </button>
            </div>
          )}

          <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px' }}>
            {/* Saved snapshots */}
            <div style={S.sectionHeader}>Saved Snapshots</div>
            {snapshots.length === 0 && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: '12px 0' }}>
                No snapshots yet. Save one to create a restore point.
              </div>
            )}
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <Camera size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {snap.label || 'Snapshot'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{formatDate(snap.createdAt)}</div>
                </div>
                <button
                  onClick={() => void handleRestore(snap)}
                  style={{ ...S.actionBtn, padding: '5px 10px', color: '#93c5fd' }}
                  title="Restore this snapshot"
                >
                  <RotateCcw size={12} />
                  Restore
                </button>
                <button
                  onClick={() => void handleDelete(snap.id)}
                  style={{ ...S.actionBtn, padding: '5px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(252,165,165,0.8)' }}
                  title="Delete snapshot"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {/* History log */}
            {undoStack.length > 0 && (
              <>
                <div style={{ ...S.sectionHeader, marginTop: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={10} />
                  Session History
                </div>
                {[...undoStack].reverse().slice(0, 20).map((entry, i) => (
                  <div
                    key={entry.id ?? i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)'
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{entry.label}</div>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                ))}
              </>
            )}

            <div style={{ height: 16 }} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
