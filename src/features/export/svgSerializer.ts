/**
 * svgSerializer.ts — Backward-compatibility shim
 *
 * This file previously contained the monolithic SVG serializer.
 * It has been refactored into focused modules in Phase 3:
 *
 *   svgSerializeUtils.ts      — shared XML helpers
 *   svgSerializeTransforms.ts — TransformModel → transform string
 *   svgSerializeText.ts       — text/tspan/textPath serialization
 *   svgSerializeStyles.ts     — CSS style block serialization
 *   svgSerializeResources.ts  — gradient/filter/pattern/marker serialization
 *   svgSerializeNormalized.ts — Mode A: normalized output
 *   svgSerializeRoundTrip.ts  — Mode B: round-trip-safe output
 *   index.ts                  — unified entry point (serializeSvgDocument)
 *
 * This shim re-exports the unified API so existing call sites continue to work.
 * Prefer importing from './index' or '@/features/export' directly.
 */

export { serializeSvgDocument, serializeSvgDocumentFull } from './index'

/**
 * @deprecated Use serializeSvgDocument instead.
 * This alias exists for backward compatibility with pre-Phase-3 code.
 */
export { serializeSvgDocument as serializeDocumentToSvg } from './index'
