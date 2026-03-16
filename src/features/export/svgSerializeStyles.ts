/**
 * svgSerializeStyles.ts
 *
 * CSS style block serialization for SVG <style> elements.
 *
 * Mode A (normalized): Uses css-tree to parse CSS text into an AST and
 *   re-serializes it cleanly (normalizes whitespace, consistent formatting).
 *
 * Mode B (round-trip): Emits CSS text verbatim to preserve original formatting,
 *   comments, and any CSS features that css-tree might not perfectly preserve.
 *
 * css-tree is imported dynamically to avoid issues in test environments that
 * do not support all css-tree features.
 */

import type { StyleBlockResource } from '@/model/resources/resourceTypes'
import type { SerializeMode } from './svgSerializeUtils'
import { xmlEscape } from './svgSerializeUtils'

// ── css-tree integration ──────────────────────────────────────────────────────

/**
 * Parse CSS text into a normalized string using css-tree.
 * Returns the original text if css-tree fails to parse it (safe fallback).
 */
export function parseAndReserializeCSS(cssText: string): string {
  try {
    // Dynamic import is not usable synchronously; use require-style import
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const csstree = require('css-tree') as typeof import('css-tree')
    const ast = csstree.parse(cssText, { parseValue: false, parseAtrulePrelude: false })
    return csstree.generate(ast)
  } catch {
    // If css-tree fails (invalid CSS, unsupported syntax), return as-is
    return cssText
  }
}

// ── Style block serialization ─────────────────────────────────────────────────

/**
 * Serialize a StyleBlockResource to a <style> element string.
 *
 * Mode A: normalizes CSS text via css-tree for clean, consistent output.
 * Mode B: preserves CSS text verbatim to maintain round-trip fidelity.
 */
export function serializeStyleBlock(sb: StyleBlockResource, mode: SerializeMode): string {
  const media = sb.media ? ` media="${xmlEscape(sb.media)}"` : ''
  const cssText = mode === 'normalized' ? parseAndReserializeCSS(sb.cssText) : sb.cssText
  return `<style type="text/css"${media}>\n${cssText}\n</style>`
}

/**
 * Serialize a raw CSS text string as a <style> element.
 * Used for StyleNode instances in the document tree.
 */
export function serializeStyleElement(cssText: string, mediaQuery: string | undefined, mode: SerializeMode): string {
  const media = mediaQuery ? ` media="${xmlEscape(mediaQuery)}"` : ''
  const text = mode === 'normalized' ? parseAndReserializeCSS(cssText) : cssText
  return `<style type="text/css"${media}>${text}</style>`
}
