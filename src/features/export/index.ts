/**
 * src/features/export/index.ts
 *
 * Unified public API for SVG document serialization.
 *
 * Dispatches between Mode A (normalized) and Mode B (round-trip) based on
 * the document's serializationMode field or the caller-supplied override.
 *
 * Mode A (normalized):
 *   - Clean, consistently formatted SVG
 *   - For editor-native documents (fidelityTier=1, serializationMode='normalized')
 *   - Optional pretty-printing and svgo optimization (never the default)
 *
 * Mode B (round-trip):
 *   - Preservation-respecting SVG with rawAttributes/rawChildren intact
 *   - For imported documents (fidelityTier=2/3, serializationMode='roundtrip')
 *   - Optional diff-match-patch change summary
 *   - Never applies svgo or any destructive transformation
 */

import type { SvgDocument } from '@/model/document/documentTypes'
import {
  serializeDocumentNormalized,
  type NormalizedSerializeOpts,
} from './svgSerializeNormalized'
import {
  serializeDocumentRoundTrip,
  serializeDocumentRoundTripFull,
  computeRoundTripDiff,
  type RoundTripSerializeOpts,
  type RoundTripSerializeResult,
  type RoundTripChangeSummary,
} from './svgSerializeRoundTrip'

// ── Public types ──────────────────────────────────────────────────────────────

export type SerializeMode = 'normalized' | 'roundtrip'

export interface SerializeOptions {
  /**
   * Override the serialization mode.
   * Defaults to doc.serializationMode, which is set by the import engine:
   *   'normalized' for Tier-1 (editor-native) documents
   *   'roundtrip'  for Tier-2/3 (imported) documents
   */
  mode?: SerializeMode

  // ── Mode A options ─────────────────────────────────────────────────────────

  /**
   * Run output through prettier + prettier-plugin-xml for clean formatting.
   * Mode A only. Default: false.
   */
  prettify?: boolean

  /**
   * Run output through svgo for optimization.
   * Mode A only. NEVER the default — explicit opt-in only per architectural contract.
   * Do NOT enable unless the user explicitly requested optimization.
   */
  applyOptimizations?: boolean

  // ── Mode B options ─────────────────────────────────────────────────────────

  /**
   * Compute a change summary comparing the output to the original source SVG.
   * Requires doc.sourceSvg to be set (populated during import).
   * Mode B only. Default: false (skip for performance).
   */
  computeChangeSummary?: boolean
}

// ── Re-exports ────────────────────────────────────────────────────────────────

export type { NormalizedSerializeOpts, RoundTripSerializeOpts, RoundTripSerializeResult, RoundTripChangeSummary }
export { serializeDocumentNormalized, serializeDocumentRoundTrip, serializeDocumentRoundTripFull, computeRoundTripDiff }

// ── Unified entry point ───────────────────────────────────────────────────────

/**
 * Serialize an SvgDocument to an SVG XML string.
 *
 * Automatically selects Mode A or Mode B based on doc.serializationMode,
 * unless overridden by opts.mode.
 *
 * This is the primary function all consumers should use.
 */
export function serializeSvgDocument(doc: SvgDocument, opts: SerializeOptions = {}): string {
  const mode: SerializeMode = opts.mode ?? doc.serializationMode ?? 'normalized'

  if (mode === 'roundtrip') {
    return serializeDocumentRoundTrip(doc, {
      computeChangeSummary: opts.computeChangeSummary,
    })
  }

  return serializeDocumentNormalized(doc, {
    prettify: opts.prettify,
    applyOptimizations: opts.applyOptimizations,
  })
}

/**
 * Like serializeSvgDocument but returns the full result object.
 * Useful when you need the change summary from a round-trip export.
 */
export function serializeSvgDocumentFull(
  doc: SvgDocument,
  opts: SerializeOptions = {}
): RoundTripSerializeResult & { mode: SerializeMode } {
  const mode: SerializeMode = opts.mode ?? doc.serializationMode ?? 'normalized'

  if (mode === 'roundtrip') {
    const result = serializeDocumentRoundTripFull(doc, {
      computeChangeSummary: opts.computeChangeSummary,
    })
    return { ...result, mode }
  }

  const svg = serializeDocumentNormalized(doc, {
    prettify: opts.prettify,
    applyOptimizations: opts.applyOptimizations,
  })
  return { svg, mode }
}
