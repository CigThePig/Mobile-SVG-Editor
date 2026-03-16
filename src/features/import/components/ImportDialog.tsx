import { useState, useRef } from 'react'
import { FileUp, ClipboardPaste, X, Upload } from 'lucide-react'
import { importSvgString, importSvgFile, importSvgFromClipboard } from '../svgImportCommands'
import type { SvgImportResult } from '../svgImportTypes'

// ── Import Dialog ─────────────────────────────────────────────────────────────

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete?: (result: SvgImportResult) => void
}

export function ImportDialog({ open, onOpenChange, onImportComplete }: ImportDialogProps) {
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleClose = () => {
    if (loading) return
    setPasteText('')
    setError(null)
    onOpenChange(false)
  }

  const handlePasteImport = async () => {
    const text = pasteText.trim()
    if (!text) {
      setError('Please paste SVG code above')
      return
    }
    if (!text.includes('<svg') && !text.includes('<SVG')) {
      setError('Content does not appear to be SVG (no <svg> element found)')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await importSvgString(text)
      onOpenChange(false)
      setPasteText('')
      onImportComplete?.(result)
    } catch (e) {
      setError(`Import failed: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const result = await importSvgFile(file)
      onOpenChange(false)
      onImportComplete?.(result)
    } catch (e) {
      setError(`Import failed: ${String(e)}`)
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handleClipboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await importSvgFromClipboard()
      if (!result) {
        setError('No SVG found in clipboard')
        return
      }
      onOpenChange(false)
      onImportComplete?.(result)
    } catch (e) {
      setError(`Clipboard import failed: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.12)',
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            Import SVG
          </span>
          <button
            onClick={handleClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)',
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          {/* File picker */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.85)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
            }}
          >
            <FileUp size={18} />
            Open SVG file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,image/svg+xml"
            style={{ display: 'none' }}
            onChange={(e) => void handleFileChange(e)}
          />

          {/* Clipboard */}
          <button
            onClick={() => void handleClipboard()}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.85)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
            }}
          >
            <ClipboardPaste size={18} />
            Import from clipboard
          </button>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'rgba(255,255,255,0.3)', fontSize: 12,
          }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            or paste SVG code
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* Paste area */}
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; ...>..."
            disabled={loading}
            style={{
              width: '100%',
              minHeight: 120,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.3)',
              color: 'rgba(255,255,255,0.8)',
              fontFamily: 'monospace',
              fontSize: 11,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />

          {/* Error message */}
          {error && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handlePasteImport()}
            disabled={loading || !pasteText.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: pasteText.trim() && !loading ? '#3b82f6' : 'rgba(59,130,246,0.3)',
              color: 'white',
              fontSize: 14,
              cursor: loading || !pasteText.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 500,
            }}
          >
            <Upload size={14} />
            {loading ? 'Importing…' : 'Import SVG'}
          </button>
        </div>
      </div>
    </div>
  )
}
