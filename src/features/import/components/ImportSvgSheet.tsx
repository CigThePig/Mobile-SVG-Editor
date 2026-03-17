import { useState, useRef } from 'react'
import { X, ArrowLeft, FileUp, ClipboardPaste, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import { parseSvgString } from '../svgParseDocument'
import { commitImportResult } from '../svgImportCommands'
import type { SvgImportResult } from '../svgImportTypes'
import { ImportPreview } from './ImportPreview'
import { ImportSummaryCard } from './ImportSummaryCard'
import { ImportDiagnosticsPanel } from './ImportDiagnosticsPanel'
import type { ImportDiagnostic } from '@/model/document/documentTypes'

// ── ImportSvgSheet ────────────────────────────────────────────────────────────
// Two-step import flow:
//   Step 1 (input): paste / file / clipboard / drag-and-drop
//   Step 2 (preview): thumbnail + summary + diagnostics + serialization option

type Step = 'input' | 'preview'

interface ImportSvgSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete?: () => void
}

export function ImportSvgSheet({ open, onOpenChange, onImportComplete }: ImportSvgSheetProps) {
  const [step, setStep] = useState<Step>('input')
  const [pasteText, setPasteText] = useState('')
  const [previewResult, setPreviewResult] = useState<SvgImportResult | null>(null)
  const [previewSvg, setPreviewSvg] = useState('')
  const [serializationMode, setSerializationMode] = useState<'roundtrip' | 'normalized'>('roundtrip')
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleClose = () => {
    if (loading) return
    resetState()
    onOpenChange(false)
  }

  const resetState = () => {
    setStep('input')
    setPasteText('')
    setPreviewResult(null)
    setPreviewSvg('')
    setSerializationMode('roundtrip')
    setShowDiagnostics(false)
    setError(null)
    setDragOver(false)
  }

  const goBack = () => {
    setStep('input')
    setPreviewResult(null)
    setPreviewSvg('')
    setError(null)
    setShowDiagnostics(false)
  }

  // Parse SVG and advance to preview step (no side effects)
  const handleParse = (svgString: string) => {
    const trimmed = svgString.trim()
    if (!trimmed) {
      setError('No SVG content provided')
      return
    }
    if (!trimmed.includes('<svg') && !trimmed.includes('<SVG')) {
      setError('Content does not appear to be SVG (no <svg> element found)')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = parseSvgString(trimmed)
      setPreviewResult(result)
      setPreviewSvg(trimmed)
      setSerializationMode(result.fidelityTier === 1 ? 'normalized' : 'roundtrip')
      setStep('preview')
    } catch (e) {
      setError(`Parse failed: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  const handlePasteImport = () => {
    handleParse(pasteText)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const text = await file.text()
      handleParse(text)
    } catch (e) {
      setError(`File read failed: ${String(e)}`)
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handleClipboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim().toLowerCase().includes('<svg')) {
        setError('No SVG found in clipboard')
        setLoading(false)
        return
      }
      handleParse(text)
    } catch {
      setError('Clipboard access denied or unavailable')
      setLoading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const file = e.dataTransfer.files?.[0]
    if (file && (file.type === 'image/svg+xml' || file.name.endsWith('.svg'))) {
      setLoading(true)
      try {
        const text = await file.text()
        handleParse(text)
      } catch {
        setError('Could not read dropped file')
        setLoading(false)
      }
      return
    }

    // Try text/plain or text/html as SVG string
    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/html')
    if (text) {
      handleParse(text)
    } else {
      setError('Dropped content is not an SVG file or SVG text')
    }
  }

  const handleCommit = async () => {
    if (!previewResult) return
    setLoading(true)
    try {
      // Apply user-chosen serialization mode before committing
      previewResult.doc.serializationMode = serializationMode
      await commitImportResult(previewResult)
      resetState()
      onOpenChange(false)
      onImportComplete?.()
    } catch (e) {
      setError(`Import failed: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  const diagnostics: ImportDiagnostic[] = previewResult?.doc.diagnostics ?? []

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
      onDragOver={step === 'input' ? handleDragOver : undefined}
      onDragLeave={step === 'input' ? handleDragLeave : undefined}
      onDrop={step === 'input' ? handleDrop : undefined}
    >
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: '16px 16px 0 0',
          border: '1px solid rgba(255,255,255,0.12)',
          borderBottom: 'none',
          width: '100%',
          maxWidth: 520,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: dragOver ? '2px solid #3b82f6' : 'none',
          outlineOffset: -2,
        }}
      >
        {/* Handle bar */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.18)',
            alignSelf: 'center',
            margin: '12px 0 0',
          }}
        />

        {step === 'input' ? (
          <InputStep
            pasteText={pasteText}
            setPasteText={setPasteText}
            error={error}
            loading={loading}
            dragOver={dragOver}
            fileInputRef={fileInputRef}
            onClose={handleClose}
            onFile={() => fileInputRef.current?.click()}
            onClipboard={() => void handleClipboard()}
            onPasteImport={handlePasteImport}
            onFileChange={(e) => void handleFileChange(e)}
          />
        ) : (
          <PreviewStep
            previewResult={previewResult!}
            previewSvg={previewSvg}
            diagnostics={diagnostics}
            serializationMode={serializationMode}
            setSerializationMode={setSerializationMode}
            showDiagnostics={showDiagnostics}
            setShowDiagnostics={setShowDiagnostics}
            loading={loading}
            error={error}
            onBack={goBack}
            onClose={handleClose}
            onCommit={() => void handleCommit()}
          />
        )}
      </div>
    </div>
  )
}

// ── Input step ────────────────────────────────────────────────────────────────

interface InputStepProps {
  pasteText: string
  setPasteText: (v: string) => void
  error: string | null
  loading: boolean
  dragOver: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onClose: () => void
  onFile: () => void
  onClipboard: () => void
  onPasteImport: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function InputStep({
  pasteText, setPasteText, error, loading, dragOver,
  fileInputRef, onClose, onFile, onClipboard, onPasteImport, onFileChange,
}: InputStepProps) {
  return (
    <>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
          Import SVG
        </span>
        <button
          onClick={onClose}
          style={iconBtnStyle}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {dragOver && (
          <div
            style={{
              padding: '16px',
              borderRadius: 10,
              border: '2px dashed #3b82f6',
              background: 'rgba(59,130,246,0.08)',
              color: '#93c5fd',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 4,
            }}
          >
            Drop SVG file here
          </div>
        )}

        {/* Open file */}
        <button
          onClick={onFile}
          disabled={loading}
          style={actionBtnStyle(loading)}
        >
          <FileUp size={18} />
          Open SVG file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg,image/svg+xml"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />

        {/* Clipboard */}
        <button
          onClick={onClipboard}
          disabled={loading}
          style={actionBtnStyle(loading)}
        >
          <ClipboardPaste size={18} />
          Paste from clipboard
        </button>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'rgba(255,255,255,0.3)',
            fontSize: 12,
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          or paste SVG code
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Paste area */}
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={`<svg xmlns="http://www.w3.org/2000/svg" ...>`}
          disabled={loading}
          style={{
            width: '100%',
            minHeight: 110,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.3)',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: 'monospace',
            fontSize: 11,
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />

        {error && <ErrorBanner message={error} />}

        {/* Drag-and-drop hint */}
        {!dragOver && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingTop: 2 }}>
            You can also drag and drop an SVG file here
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 20px 24px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
        }}
      >
        <button onClick={onClose} disabled={loading} style={cancelBtnStyle}>
          Cancel
        </button>
        <button
          onClick={onPasteImport}
          disabled={loading || !pasteText.trim()}
          style={{
            ...primaryBtnStyle,
            background: pasteText.trim() && !loading ? '#3b82f6' : 'rgba(59,130,246,0.3)',
            cursor: loading || !pasteText.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          <Upload size={14} />
          {loading ? 'Parsing…' : 'Preview'}
        </button>
      </div>
    </>
  )
}

// ── Preview step ──────────────────────────────────────────────────────────────

interface PreviewStepProps {
  previewResult: SvgImportResult
  previewSvg: string
  diagnostics: ImportDiagnostic[]
  serializationMode: 'roundtrip' | 'normalized'
  setSerializationMode: (m: 'roundtrip' | 'normalized') => void
  showDiagnostics: boolean
  setShowDiagnostics: (v: boolean) => void
  loading: boolean
  error: string | null
  onBack: () => void
  onClose: () => void
  onCommit: () => void
}

function PreviewStep({
  previewResult, previewSvg, diagnostics,
  serializationMode, setSerializationMode,
  showDiagnostics, setShowDiagnostics,
  loading, error, onBack, onClose, onCommit,
}: PreviewStepProps) {
  const hasDiagnostics = diagnostics.length > 0
  const showModeOption = previewResult.fidelityTier > 1

  return (
    <>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <button onClick={onBack} style={iconBtnStyle} aria-label="Back">
          <ArrowLeft size={16} />
        </button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
          Preview Import
        </span>
        <button onClick={onClose} style={iconBtnStyle} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {/* SVG preview + metadata */}
        <ImportPreview svgString={previewSvg} result={previewResult} />

        {/* Stats card */}
        <ImportSummaryCard result={previewResult} />

        {/* Diagnostics toggle */}
        {hasDiagnostics && (
          <div>
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <span>
                {previewResult.diagnosticCount} import issue{previewResult.diagnosticCount !== 1 ? 's' : ''}
              </span>
              {showDiagnostics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showDiagnostics && (
              <div style={{ marginTop: 6 }}>
                <ImportDiagnosticsPanel diagnostics={diagnostics} />
              </div>
            )}
          </div>
        )}

        {/* Serialization mode option (only for Tier 2–3 imports) */}
        {showModeOption && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Serialization mode
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <ModeButton
                active={serializationMode === 'roundtrip'}
                onClick={() => setSerializationMode('roundtrip')}
                label="Round-trip safe"
                description="Preserves all original structure"
              />
              <ModeButton
                active={serializationMode === 'normalized'}
                onClick={() => setSerializationMode('normalized')}
                label="Normalize"
                description="Clean editor-native output"
              />
            </div>
          </div>
        )}

        {error && <ErrorBanner message={error} />}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 20px 24px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
        }}
      >
        <button onClick={onBack} disabled={loading} style={cancelBtnStyle}>
          Back
        </button>
        <button
          onClick={onCommit}
          disabled={loading}
          style={{
            ...primaryBtnStyle,
            background: loading ? 'rgba(59,130,246,0.3)' : '#3b82f6',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <Upload size={14} />
          {loading ? 'Importing…' : 'Import SVG'}
        </button>
      </div>
    </>
  )
}

// ── Mode selection button ─────────────────────────────────────────────────────

function ModeButton({
  active,
  onClick,
  label,
  description,
}: {
  active: boolean
  onClick: () => void
  label: string
  description: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 10px',
        borderRadius: 8,
        border: active ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(255,255,255,0.10)',
        background: active ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
        color: active ? '#93c5fd' : 'rgba(255,255,255,0.6)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 10, opacity: 0.7 }}>{description}</div>
    </button>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const iconBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: 'rgba(255,255,255,0.07)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(255,255,255,0.6)',
  flexShrink: 0,
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'transparent',
  color: 'rgba(255,255,255,0.7)',
  fontSize: 14,
  cursor: 'pointer',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  color: 'white',
  fontSize: 14,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const actionBtnStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '13px 16px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.05)',
  color: disabled ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 14,
})

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        background: 'rgba(239,68,68,0.12)',
        border: '1px solid rgba(239,68,68,0.3)',
        color: '#fca5a5',
        fontSize: 13,
      }}
    >
      {message}
    </div>
  )
}
