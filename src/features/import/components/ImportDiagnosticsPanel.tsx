import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'
import type { ImportDiagnostic } from '@/model/document/documentTypes'

// ── ImportDiagnosticsPanel ────────────────────────────────────────────────────
// Scrollable panel showing all import diagnostics grouped by severity.
// Side-effect-free — purely a display component.

interface ImportDiagnosticsPanelProps {
  diagnostics: ImportDiagnostic[]
}

function severityOrder(s: ImportDiagnostic['severity']): number {
  if (s === 'error') return 0
  if (s === 'warning') return 1
  return 2
}

const SEVERITY_COLOR: Record<ImportDiagnostic['severity'], string> = {
  error: '#f87171',
  warning: '#facc15',
  info: '#93c5fd',
}

const SEVERITY_BG: Record<ImportDiagnostic['severity'], string> = {
  error: 'rgba(248,113,113,0.10)',
  warning: 'rgba(250,204,21,0.10)',
  info: 'rgba(147,197,253,0.10)',
}

function SeverityIcon({ severity }: { severity: ImportDiagnostic['severity'] }) {
  const color = SEVERITY_COLOR[severity]
  const size = 14
  if (severity === 'error') return <XCircle size={size} color={color} />
  if (severity === 'warning') return <AlertTriangle size={size} color={color} />
  return <Info size={size} color={color} />
}

export function ImportDiagnosticsPanel({ diagnostics }: ImportDiagnosticsPanelProps) {
  if (diagnostics.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 8,
          background: 'rgba(74,222,128,0.08)',
          border: '1px solid rgba(74,222,128,0.2)',
          color: '#4ade80',
          fontSize: 13,
        }}
      >
        <CheckCircle size={15} />
        No issues detected — clean import
      </div>
    )
  }

  const sorted = [...diagnostics].sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxHeight: 240,
        overflowY: 'auto',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.2)',
      }}
    >
      {sorted.map((diag) => (
        <DiagnosticRow key={diag.id} diag={diag} />
      ))}
    </div>
  )
}

function DiagnosticRow({ diag }: { diag: ImportDiagnostic }) {
  const color = SEVERITY_COLOR[diag.severity]
  const bg = SEVERITY_BG[diag.severity]

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '7px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ paddingTop: 1, flexShrink: 0 }}>
        <SeverityIcon severity={diag.severity} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'monospace',
              padding: '1px 5px',
              borderRadius: 4,
              background: bg,
              color,
              letterSpacing: '0.03em',
            }}
          >
            {diag.code}
          </span>
          {diag.elementId && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
              #{diag.elementId}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
          {diag.message}
        </div>
        {diag.attributeName && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontFamily: 'monospace' }}>
            attr: {diag.attributeName}
          </div>
        )}
      </div>
    </div>
  )
}
