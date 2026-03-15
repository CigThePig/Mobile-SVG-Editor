import { useState, useCallback } from 'react'
import { ArrowLeft, Download, Copy, Check } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { useNavigation } from '@/app/routing/NavigationContext'
import { serializeDocumentToSvg } from '@/features/export/svgSerializer'

export function ExportPage() {
  const activeDocument = useEditorStore((s) => s.activeDocument)
  const { navigate } = useNavigation()
  const [copied, setCopied] = useState(false)

  const svgString = serializeDocumentToSvg(activeDocument)
  const blobUrl = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }))

  const handleDownload = useCallback(() => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }))
    a.download = `${activeDocument.title || 'untitled'}.svg`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  }, [svgString, activeDocument.title])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(svgString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [svgString])

  const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 20px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14, fontWeight: 600,
    cursor: 'pointer', flex: 1, justifyContent: 'center'
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          height: 52,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: '#111111',
          flexShrink: 0
        }}
      >
        <button
          onClick={() => navigate('editor')}
          style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: 'none', color: '#fff', cursor: 'pointer' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 600, textAlign: 'center' }}>Export SVG</div>
        <div style={{ width: 36 }} />
      </div>

      {/* Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 16 }}>
        {/* SVG preview */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 220,
            position: 'relative'
          }}
        >
          {/* Checkerboard for transparency */}
          <div
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'repeating-conic-gradient(rgba(255,255,255,0.05) 0% 25%, transparent 0% 50%)',
              backgroundSize: '16px 16px'
            }}
          />
          <img
            src={blobUrl}
            alt="SVG preview"
            style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain', position: 'relative', zIndex: 1 }}
            onLoad={() => URL.revokeObjectURL(blobUrl)}
          />
        </div>

        {/* Doc info */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 6 }}>{activeDocument.title || 'Untitled SVG'}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {activeDocument.width} × {activeDocument.height}px · {(svgString.length / 1024).toFixed(1)} KB
          </div>
        </div>

        {/* SVG source preview */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            SVG Source
          </div>
          <pre
            style={{
              margin: 0,
              padding: '12px',
              fontSize: 11,
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'monospace',
              overflowX: 'auto',
              maxHeight: 180,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            {svgString.slice(0, 600)}{svgString.length > 600 ? '\n…' : ''}
          </pre>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleDownload} style={{ ...iconBtn, background: '#3b82f6', border: '1px solid #2563eb', color: '#fff' }}>
            <Download size={16} />
            Download SVG
          </button>
          <button onClick={() => void handleCopy()} style={iconBtn}>
            {copied ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy SVG'}
          </button>
        </div>
      </div>
    </div>
  )
}
