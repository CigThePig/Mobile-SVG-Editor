import { AlertTriangle, Info } from 'lucide-react'
import type { SvgImportResult } from '../svgImportTypes'

// ── ImportSummaryCard ─────────────────────────────────────────────────────────
// Compact embeddable card showing fidelity tier, editability breakdown, and
// diagnostic counts. Designed for embedding inside ImportSvgSheet preview step.

interface ImportSummaryCardProps {
  result: SvgImportResult
}

const TIER_COLOR: Record<1 | 2 | 3, string> = {
  1: '#4ade80',
  2: '#facc15',
  3: '#f87171',
}

const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Fully Normalized',
  2: 'Mostly Preserved',
  3: 'Raw Preserved',
}

export function ImportSummaryCard({ result }: ImportSummaryCardProps) {
  const { fidelityTier, editabilityBreakdown, diagnosticCount, warningCount, errorCount } =
    result
  const tierColor = TIER_COLOR[fidelityTier]
  const tierLabel = TIER_LABEL[fidelityTier]
  const totalNodes = Object.values(editabilityBreakdown).reduce((a, b) => a + b, 0)
  const infoCount = diagnosticCount - errorCount - warningCount

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Fidelity tier row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Fidelity
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: tierColor,
            padding: '2px 8px',
            borderRadius: 6,
            background: `${tierColor}18`,
          }}
        >
          Tier {fidelityTier}: {tierLabel}
        </span>
      </div>

      {/* Editability breakdown */}
      {totalNodes > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Editability
          </span>
          <EditabilityRow level={1} count={editabilityBreakdown[1]} total={totalNodes} label="Full" color="#4ade80" />
          <EditabilityRow level={2} count={editabilityBreakdown[2]} total={totalNodes} label="Partial" color="#facc15" />
          <EditabilityRow level={3} count={editabilityBreakdown[3]} total={totalNodes} label="Preserved" color="#f87171" />
          <EditabilityRow level={4} count={editabilityBreakdown[4]} total={totalNodes} label="Display-only" color="#a78bfa" />
        </div>
      )}

      {/* Diagnostics */}
      {diagnosticCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>
            Issues
          </span>
          {errorCount > 0 && (
            <DiagBadge
              icon={<AlertTriangle size={11} />}
              count={errorCount}
              label="error"
              color="#f87171"
              bg="rgba(248,113,113,0.12)"
            />
          )}
          {warningCount > 0 && (
            <DiagBadge
              icon={<AlertTriangle size={11} />}
              count={warningCount}
              label="warning"
              color="#facc15"
              bg="rgba(250,204,21,0.12)"
            />
          )}
          {infoCount > 0 && (
            <DiagBadge
              icon={<Info size={11} />}
              count={infoCount}
              label="info"
              color="#93c5fd"
              bg="rgba(147,197,253,0.12)"
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EditabilityRow({
  level,
  count,
  total,
  label,
  color,
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 56, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
        L{level} {label}
      </div>
      <div
        style={{
          flex: 1,
          height: 5,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.07)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <div style={{ width: 26, fontSize: 11, color, textAlign: 'right' }}>{count}</div>
    </div>
  )
}

function DiagBadge({
  icon,
  count,
  label,
  color,
  bg,
}: {
  icon: React.ReactNode
  count: number
  label: string
  color: string
  bg: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 6,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {icon}
      {count} {label}{count !== 1 ? 's' : ''}
    </div>
  )
}
