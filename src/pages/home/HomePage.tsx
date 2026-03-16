import { useEffect, useState, useMemo } from 'react'
import { Plus, FileText, Trash2, ArrowRight } from 'lucide-react'
import { listRecentDocuments, createAndSaveDocument, deleteDocument } from '@/db/dexie/queries'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useNavigation } from '@/app/routing/NavigationContext'
import type { DocumentRecord } from '@/db/dexie/db'
import { serializeDocumentToSvg } from '@/features/export/svgSerializer'
import type { SvgDocument } from '@/model/document/documentTypes'

function DocumentThumbnail({ doc }: { doc: SvgDocument }) {
  const html = useMemo(() => {
    const truncated: SvgDocument = {
      ...doc,
      root: { ...doc.root, children: doc.root.children.slice(0, 30) }
    }
    const svgString = serializeDocumentToSvg(truncated)
    return svgString
      .replace(/^<\?xml[^?]*\?>\n?/, '')
      .replace(
        /<svg([^>]*)>/,
        (_, attrs) => {
          const cleaned = attrs
            .replace(/\s*width="[^"]*"/, '')
            .replace(/\s*height="[^"]*"/, '')
          return `<svg${cleaned} width="40" height="40" preserveAspectRatio="xMidYMid meet" style="display:block;opacity:0.7">`
        }
      )
  }, [doc])

  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function HomePage() {
  const [docs, setDocs] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const replaceDocument = useEditorStore((s) => s.replaceDocument)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const clearHistory = useHistoryStore((s) => s.clear)
  const { navigate } = useNavigation()

  const refresh = async () => {
    const list = await listRecentDocuments(50)
    setDocs(list)
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const handleOpen = (record: DocumentRecord) => {
    replaceDocument(record.data)
    clearSelection()
    clearHistory()
    navigate('editor')
  }

  const handleNew = async () => {
    const doc = await createAndSaveDocument('Untitled SVG')
    replaceDocument(doc)
    clearSelection()
    clearHistory()
    navigate('editor')
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await deleteDocument(id)
    await refresh()
    setDeletingId(null)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>My Documents</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          {docs.length} {docs.length === 1 ? 'document' : 'documents'}
        </div>
      </div>

      {/* Document list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '40px 0' }}>Loading…</div>
        )}

        {!loading && docs.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <FileText size={40} strokeWidth={1} />
            <div>No documents yet. Create one to get started.</div>
          </div>
        )}

        {docs.map((record) => (
          <div
            key={record.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              marginBottom: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              cursor: 'pointer'
            }}
            onClick={() => handleOpen(record)}
          >
            {/* Thumbnail */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                flexShrink: 0,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <DocumentThumbnail doc={record.data} />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {record.title || 'Untitled SVG'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                {record.data.width} × {record.data.height} · {formatDate(record.updatedAt)}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => void handleDelete(record.id)}
                disabled={deletingId === record.id}
                style={{
                  width: 34, height: 34,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: 'rgba(252,165,165,0.8)',
                  cursor: 'pointer',
                  opacity: deletingId === record.id ? 0.4 : 1
                }}
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => handleOpen(record)}
                style={{
                  width: 34, height: 34,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8,
                  background: 'rgba(96,165,250,0.15)',
                  border: '1px solid rgba(96,165,250,0.25)',
                  color: '#93c5fd',
                  cursor: 'pointer'
                }}
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New document button */}
      <div style={{ padding: '16px 20px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
        <button
          onClick={() => void handleNew()}
          style={{
            width: '100%', height: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            borderRadius: 14,
            background: '#3b82f6',
            color: '#fff',
            fontSize: 15, fontWeight: 600,
            cursor: 'pointer',
            border: 'none'
          }}
        >
          <Plus size={20} />
          New Document
        </button>
      </div>
    </div>
  )
}
