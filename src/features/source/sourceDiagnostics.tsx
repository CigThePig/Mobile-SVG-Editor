/**
 * src/features/source/sourceDiagnostics.tsx
 *
 * Diagnostic panel for the source editor.
 * Shows import/parse diagnostics from the last source apply.
 * Adapted from ImportDiagnosticsPanel for the source editor context.
 */

import { AlertTriangle, Info, XCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { ImportDiagnostic } from '@/model/document/documentTypes'

interface SourceDiagnosticsPanelProps {
  diagnostics: ImportDiagnostic[]
  /** Whether the panel is expanded */
  expanded: boolean
  onToggle: () => void
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

function severityOrder(s: ImportDiagnostic['severity']): number {
  if (s === 'error') return 0
  if (s === 'warning') return 1
  return 2
}

function SeverityIcon({ severity }: { severity: ImportDiagnostic['severity'] }) {
  const color = SEVERITY_COLOR[severity]
  const size = 13
  if (severity === 'error') return <XCircle size={size} color={color} />
  if (severity === 'warning') return <AlertTriangle size={size} color={color} />
  return <Info size={size} color={color} />
}

/** The collapsible toggle header row */
function DiagnosticsToggle({
  diagnostics,
  expanded,
  onToggle,
}: {
  diagnostics: ImportDiagnostic[]
  expanded: boolean
  onToggle: () => void
}) {
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length
  const warnCount = diagnostics.filter((d) => d.severity === 'warning').length

  const summaryColor = errorCount > 0 ? '#f87171' : warnCount > 0 ? '#facc15' : '#93c5fd'
  const summaryBg =
    errorCount > 0
      ? 'rgba(248,113,113,0.08)'
      : warnCount > 0
        ? 'rgba(250,204,21,0.08)'
        : 'rgba(147,197,253,0.08)'

  const label =
    errorCount > 0
      ? `${errorCount} error${errorCount !== 1 ? 's' : ''}${warnCount > 0 ? `, ${warnCount} warning${warnCount !== 1 ? 's' : ''}` : ''}`
      : warnCount > 0
        ? `${warnCount} warning${warnCount !== 1 ? 's' : ''}`
        : `${diagnostics.length} info`

  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '6px 12px',
        borderRadius: expanded ? '6px 6px 0 0' : 6,
        border: `1px solid ${summaryBg}`,
        background: summaryBg,
        color: summaryColor,
        fontSize: 12,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {errorCount > 0 ? (
          <XCircle size={13} />
        ) : warnCount > 0 ? (
          <AlertTriangle size={13} />
        ) : (
          <Info size={13} />
        )}
        <span>{label}</span>
      </div>
      {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
    </button>
  )
}

/** A single diagnostic row */
function DiagnosticRow({ diag }: { diag: ImportDiagnostic }) {
  const color = SEVERITY_COLOR[diag.severity]
  const bg = SEVERITY_BG[diag.severity]

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '6px 10px',
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
              padding: '1px 4px',
              borderRadius: 3,
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
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
          {diag.message}
        </div>
        {diag.attributeName && (
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              marginTop: 2,
              fontFamily: 'monospace',
            }}
          >
            attr: {diag.attributeName}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Collapsible diagnostics panel for the source editor footer.
 *
 * Shows a summary toggle row and an expandable list of diagnostics.
 * If there are no diagnostics, renders a compact "No issues" badge.
 */
export function SourceDiagnosticsPanel({
  diagnostics,
  expanded,
  onToggle,
}: SourceDiagnosticsPanelProps) {
  if (diagnostics.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          color: '#4ade80',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        <CheckCircle size={13} />
        No issues
      </div>
    )
  }

  const sorted = [...diagnostics].sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <DiagnosticsToggle diagnostics={diagnostics} expanded={expanded} onToggle={onToggle} />
      {expanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 180,
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderTop: 'none',
            borderRadius: '0 0 6px 6px',
          }}
        >
          {sorted.map((diag) => (
            <DiagnosticRow key={diag.id} diag={diag} />
          ))}
        </div>
      )}
    </div>
  )
}
