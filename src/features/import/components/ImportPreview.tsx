import type { SvgImportResult } from '../svgImportTypes'

// ── ImportPreview ──────────────────────────────────────────────────────────────
// Renders a visual thumbnail of the to-be-imported SVG alongside document
// metadata. Intentionally side-effect-free — does not commit anything.

interface ImportPreviewProps {
  svgString: string
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

export function ImportPreview({ svgString, result }: ImportPreviewProps) {
  const { doc, fidelityTier } = result
  const tierColor = TIER_COLOR[fidelityTier]
  const tierLabel = TIER_LABEL[fidelityTier]

  // Safe SVG data URL for <img> preview — avoids scripting risks
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svgString)}`

  const dimensionLabel =
    doc.width && doc.height ? `${Math.round(doc.width)} × ${Math.round(doc.height)}` : null

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
        alignItems: 'center',
      }}
    >
      {/* SVG thumbnail */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={dataUrl}
          alt="SVG preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Metadata */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.9)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {doc.title || 'Untitled SVG'}
        </div>

        {dimensionLabel && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            {dimensionLabel} px
          </div>
        )}

        {/* Fidelity tier badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            marginTop: 2,
            padding: '2px 8px',
            borderRadius: 6,
            background: `${tierColor}18`,
            border: `1px solid ${tierColor}40`,
            width: 'fit-content',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: tierColor,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: tierColor }}>
            Tier {fidelityTier}: {tierLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
