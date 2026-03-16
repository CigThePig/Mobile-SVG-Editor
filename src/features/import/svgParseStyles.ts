import * as csstree from 'css-tree'
import type { ParseContext } from './svgImportTypes'
import { DIAG } from './svgImportTypes'
import { emitWarn } from './svgImportDiagnostics'

// ── Style block parsing ───────────────────────────────────────────────────────

/**
 * Parse a `<style>` element's text content using css-tree.
 * Populates `ctx.cssRulesBySelector` with merged property maps.
 * Each call merges rules (later rules override earlier ones, as per CSS cascade).
 */
export function parseStyleBlock(cssText: string, ctx: ParseContext): void {
  if (!cssText.trim()) return

  let ast: csstree.CssNode
  try {
    ast = csstree.parse(cssText, { parseValue: false, onParseError: () => {} })
  } catch {
    emitWarn(ctx, DIAG.INVALID_CSS, `Failed to parse <style> block CSS`)
    // Store the raw text anyway — it will still be available in StyleBlockResource
    return
  }

  // Walk all Rule nodes
  csstree.walk(ast, (node) => {
    if (node.type !== 'Rule') return
    const rule = node as csstree.Rule

    // Get selector text
    const selectorText = csstree.generate(rule.prelude)

    // Get declarations as a map
    const declarations: Record<string, string> = {}
    if (rule.block?.type === 'Block') {
      csstree.walk(rule.block, (decl) => {
        if (decl.type !== 'Declaration') return
        const declNode = decl as csstree.Declaration
        const prop = declNode.property.toLowerCase()
        const value = csstree.generate(declNode.value)
        declarations[prop] = value
      })
    }

    // Merge into existing selector entry (later rules win)
    if (Object.keys(declarations).length > 0) {
      const existing = ctx.cssRulesBySelector.get(selectorText) ?? {}
      ctx.cssRulesBySelector.set(selectorText, { ...existing, ...declarations })
    }
  })
}

// ── Inline style attribute parsing ───────────────────────────────────────────

/**
 * Parse the `style=""` attribute value into a CSS property map.
 * Returns an empty object if the string is empty or unparseable.
 */
export function parseInlineStyle(styleAttr: string | null | undefined): Record<string, string> {
  if (!styleAttr?.trim()) return {}

  const result: Record<string, string> = {}
  try {
    const ast = csstree.parse(styleAttr, {
      context: 'declarationList',
      parseValue: false,
      onParseError: () => {},
    })
    csstree.walk(ast, (node) => {
      if (node.type !== 'Declaration') return
      const decl = node as csstree.Declaration
      result[decl.property.toLowerCase()] = csstree.generate(decl.value)
    })
  } catch {
    // Fallback: simple split on semicolons
    for (const part of styleAttr.split(';')) {
      const colonIdx = part.indexOf(':')
      if (colonIdx === -1) continue
      const prop = part.slice(0, colonIdx).trim().toLowerCase()
      const value = part.slice(colonIdx + 1).trim()
      if (prop && value) result[prop] = value
    }
  }
  return result
}

// ── Resolved style computation for an element ────────────────────────────────

/**
 * Compute the merged style property map for an element.
 *
 * Priority (last wins):
 * 1. Stylesheet rules matching the element's class attribute
 * 2. Stylesheet rules matching the element's id
 * 3. Stylesheet rules matching the element's tag name
 * 4. Presentation attributes on the element
 * 5. Inline style="" attribute
 */
export function resolveElementStyle(
  element: Element,
  ctx: ParseContext
): Record<string, string> {
  const merged: Record<string, string> = {}

  // 1. Tag-name rules (lowest specificity)
  const tagRules = ctx.cssRulesBySelector.get(element.localName)
  if (tagRules) Object.assign(merged, tagRules)

  // 2. Class-based rules  (.className)
  const classAttr = element.getAttribute('class')
  if (classAttr) {
    for (const cls of classAttr.trim().split(/\s+/)) {
      const classRules = ctx.cssRulesBySelector.get(`.${cls}`)
      if (classRules) Object.assign(merged, classRules)
    }
  }

  // 3. ID-based rules (#id)
  const idAttr = element.getAttribute('id')
  if (idAttr) {
    const idRules = ctx.cssRulesBySelector.get(`#${idAttr}`)
    if (idRules) Object.assign(merged, idRules)
  }

  // 4. Presentation attributes (they're inherited from style sheets but overridden by inline)
  const presentationProps = [
    'fill', 'fill-opacity', 'fill-rule',
    'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
    'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
    'opacity', 'display', 'visibility',
    'font-family', 'font-size', 'font-weight', 'font-style',
    'text-anchor', 'dominant-baseline',
    'clip-path', 'mask', 'filter',
    'marker-start', 'marker-mid', 'marker-end',
    'mix-blend-mode', 'color',
  ]
  for (const prop of presentationProps) {
    const val = element.getAttribute(prop)
    if (val != null) merged[prop] = val
  }

  // 5. Inline style attribute (highest specificity)
  const styleAttr = element.getAttribute('style')
  if (styleAttr) {
    const inlineProps = parseInlineStyle(styleAttr)
    Object.assign(merged, inlineProps)
  }

  return merged
}

// ── CSS value helpers ─────────────────────────────────────────────────────────

/**
 * Extract a number from a CSS dimension value.
 * Handles: "12", "12px", "12pt", "12em", "12%".
 * Returns undefined if not a number.
 */
export function parseCssLength(value: string | undefined): number | undefined {
  if (!value) return undefined
  const n = parseFloat(value)
  return isNaN(n) ? undefined : n
}

/**
 * Normalize a color value to a consistent format.
 * Simply passes it through — color normalization is handled by the appearance parser.
 */
export function normalizeCssColor(value: string | undefined): string | undefined {
  if (!value || value === 'inherit' || value === 'currentColor') return undefined
  if (value === 'none') return 'none'
  return value
}
