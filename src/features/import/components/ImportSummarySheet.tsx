import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { SvgImportResult } from '../svgImportTypes'

// ── Import Summary Sheet ──────────────────────────────────────────────────────

interface ImportSummarySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: SvgImportResult | null
}

export function ImportSummarySheet({ open, onOpenChange, result }: ImportSummarySheetProps) {
  if (!open || !result) return null

  const { fidelityTier, diagnosticCount, warningCount, errorCount, editabilityBreakdown } = result

  const tierLabel = fidelityTier === 1 ? 'Fully Normalized' : fidelityTier === 2 ? 'Mostly Preserved' : 'Raw Preserved'
  const tierColor = fidelityTier === 1 ? '#4ade80' : fidelityTier === 2 ? '#facc15' : '#f87171'
  const tierIcon = fidelityTier === 1 ? '✓' : fidelityTier === 2 ? '~' : '!'

  const totalNodes = Object.values(editabilityBreakdown).reduce((a, b) => a + b, 0)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        padding: '0 0 0 0',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false) }}
    >
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: '16px 16px 0 0',
          border: '1px solid rgba(255,255,255,0.12)',
          borderBottom: 'none',
          width: '100%',
          maxWidth: 480,
          padding: '20px 20px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Handle bar */}
        <div style={{
          width: 32, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.2)',
          alignSelf: 'center',
          marginBottom: 4,
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            Import Complete
          </span>
          <button
            onClick={() => onOpenChange(false)}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Fidelity tier badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${tierColor}33`,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `${tierColor}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: tierColor,
          }}>
            {tierIcon}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              Fidelity Tier {fidelityTier}: {tierLabel}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {fidelityTier === 1 && 'All elements are fully editable'}
              {fidelityTier === 2 && 'Most elements editable; some features preserved'}
              {fidelityTier === 3 && 'Contains raw-preserved or display-only content'}
            </div>
          </div>
        </div>

        {/* Editability breakdown */}
        {totalNodes > 0 && (
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
              ELEMENT EDITABILITY
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <EditabilityRow level={1} count={editabilityBreakdown[1]} total={totalNodes} label="Full" color="#4ade80" />
              <EditabilityRow level={2} count={editabilityBreakdown[2]} total={totalNodes} label="Partial" color="#facc15" />
              <EditabilityRow level={3} count={editabilityBreakdown[3]} total={totalNodes} label="Preserved" color="#f87171" />
              <EditabilityRow level={4} count={editabilityBreakdown[4]} total={totalNodes} label="Display-only" color="#a78bfa" />
            </div>
          </div>
        )}

        {/* Diagnostics summary */}
        {diagnosticCount > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            {errorCount > 0 && (
              <DiagBadge icon={<AlertTriangle size={14} />} count={errorCount} label="error" color="#f87171" bg="#f8717115" />
            )}
            {warningCount > 0 && (
              <DiagBadge icon={<AlertTriangle size={14} />} count={warningCount} label="warning" color="#facc15" bg="#facc1515" />
            )}
            {diagnosticCount - errorCount - warningCount > 0 && (
              <DiagBadge
                icon={<Info size={14} />}
                count={diagnosticCount - errorCount - warningCount}
                label="info"
                color="#93c5fd"
                bg="#93c5fd15"
              />
            )}
          </div>
        )}

        {/* Success message if no issues */}
        {diagnosticCount === 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            color: '#4ade80', fontSize: 13,
          }}>
            <CheckCircle size={16} />
            Clean import — no issues detected
          </div>
        )}

        {/* Done button */}
        <button
          onClick={() => onOpenChange(false)}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            background: '#3b82f6',
            color: 'white',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EditabilityRow({
  level, count, total, label, color
}: {
  level: number
  count: number
  total: number
  label: string
  color: string
}) {
  if (count === 0) return null
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 60, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
        L{level} {label}
      </div>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <div style={{ width: 30, fontSize: 11, color, textAlign: 'right' }}>{count}</div>
    </div>
  )
}

function DiagBadge({
  icon, count, label, color, bg
}: {
  icon: React.ReactNode
  count: number
  label: string
  color: string
  bg: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 8,
      background: bg, color,
      fontSize: 12, fontWeight: 500,
    }}>
      {icon}
      {count} {label}{count !== 1 ? 's' : ''}
    </div>
  )
}
