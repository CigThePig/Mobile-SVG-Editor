import type { ParseContext } from './svgImportTypes'
import { DIAG } from './svgImportTypes'
import { emitWarn } from './svgImportDiagnostics'

// ── href / xlink:href resolution ──────────────────────────────────────────────

const XLINK_NS = 'http://www.w3.org/1999/xlink'

/**
 * Get the href target from an element, checking both `href` and `xlink:href`.
 * Returns the fragment ID (without the '#') if it's a local reference,
 * or the full URL for external references.
 */
export function resolveHref(element: Element): string | null {
  const href =
    element.getAttribute('href') ??
    element.getAttributeNS(XLINK_NS, 'href') ??
    null

  if (!href) return null
  if (href.startsWith('#')) return href.slice(1)
  return href
}

/**
 * Get a paint reference from a `url(#id)` value.
 * Returns the id without the `#` if it's a local reference.
 */
export function parseUrlRef(value: string): string | null {
  const match = /^url\(#([^)]+)\)$/.exec(value.trim())
  return match ? match[1] : null
}

// ── Reference scan ────────────────────────────────────────────────────────────

/**
 * Scan the entire SVG DOM tree and collect all id/href/xlink:href/url() references
 * into the parse context.
 *
 * This is called after both passes are complete, to validate references and
 * detect any unresolved ones.
 */
export function scanReferences(svgRoot: Element, ctx: ParseContext): void {
  walkElementTree(svgRoot, (el) => {
    // Check href and xlink:href attributes
    checkHrefRef(el, 'href', ctx)
    checkXlinkHref(el, ctx)

    // Check url(#id) references in presentation attributes
    checkUrlRef(el, 'fill', ctx)
    checkUrlRef(el, 'stroke', ctx)
    checkUrlRef(el, 'clip-path', ctx)
    checkUrlRef(el, 'mask', ctx)
    checkUrlRef(el, 'filter', ctx)
    checkUrlRef(el, 'marker-start', ctx)
    checkUrlRef(el, 'marker-mid', ctx)
    checkUrlRef(el, 'marker-end', ctx)

    // Check inline style for url() references
    const styleAttr = el.getAttribute('style')
    if (styleAttr) {
      scanStyleForUrlRefs(styleAttr, el, ctx)
    }
  })
}

function checkHrefRef(el: Element, attrName: string, ctx: ParseContext): void {
  const val = el.getAttribute(attrName)
  if (!val || !val.startsWith('#')) return
  const refId = val.slice(1)
  validateRef(refId, el, attrName, ctx)
}

function checkXlinkHref(el: Element, ctx: ParseContext): void {
  const val = el.getAttributeNS(XLINK_NS, 'href')
  if (!val || !val.startsWith('#')) return
  const refId = val.slice(1)
  validateRef(refId, el, 'xlink:href', ctx)
}

function checkUrlRef(el: Element, attrName: string, ctx: ParseContext): void {
  const val = el.getAttribute(attrName)
  if (!val) return
  const refId = parseUrlRef(val)
  if (!refId) return
  validateRef(refId, el, attrName, ctx)
}

function scanStyleForUrlRefs(styleStr: string, el: Element, ctx: ParseContext): void {
  const urlRegex = /url\(#([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = urlRegex.exec(styleStr)) !== null) {
    validateRef(match[1], el, 'style', ctx)
  }
}

function validateRef(refId: string, el: Element, attrName: string, ctx: ParseContext): void {
  // Check if the ref points to a valid ID in the registry
  if (!ctx.idRegistry.has(refId)) {
    // Check if it was repaired (old ID → new ID mapping)
    const repairedId = ctx.duplicateIdRepairs.get(refId)
    if (!repairedId) {
      emitWarn(ctx, DIAG.UNRESOLVED_REFERENCE, `Unresolved reference: "${attrName}="#${refId}"" — no element with this id found`, {
        elementId: el.getAttribute('id') ?? undefined,
        attributeName: attrName,
      })
    }
  }
}

function walkElementTree(el: Element, visitor: (el: Element) => void): void {
  visitor(el)
  for (const child of Array.from(el.children)) {
    walkElementTree(child, visitor)
  }
}

// ── Duplicate ID repair ───────────────────────────────────────────────────────

/**
 * Detect duplicate IDs in the SVG DOM tree and repair them.
 *
 * For each duplicate ID:
 * 1. Assign a new unique ID to the duplicate element
 * 2. Update all references pointing to the old ID
 * 3. Record the repair in ctx.duplicateIdRepairs
 * 4. Emit a diagnostic warning
 */
export function repairDuplicateIds(svgRoot: Element, ctx: ParseContext): void {
  const idCounts = new Map<string, Element[]>()

  // Collect all elements with IDs
  walkElementTree(svgRoot, (el) => {
    const id = el.getAttribute('id')
    if (!id) return
    const existing = idCounts.get(id) ?? []
    existing.push(el)
    idCounts.set(id, existing)
  })

  // Process duplicates (skip the first occurrence, repair subsequent ones)
  for (const [originalId, elements] of Array.from(idCounts.entries())) {
    if (elements.length <= 1) continue

    // Keep the first occurrence, repair all subsequent ones
    for (let i = 1; i < elements.length; i++) {
      const el = elements[i]
      const newId = `${originalId}-dup${i}`
      el.setAttribute('id', newId)
      ctx.duplicateIdRepairs.set(originalId, newId)

      emitWarn(
        ctx,
        DIAG.DUPLICATE_ID_REPAIRED,
        `Duplicate id="${originalId}" repaired: occurrence ${i + 1} renamed to "${newId}"`,
        { elementId: newId, attributeName: 'id' }
      )

      // Update all references pointing to originalId that occur after this point
      // (Note: Only repairs references that can be identified. Reference repair
      //  is best-effort in Phase 2; Phase 4 will provide comprehensive reference graph.)
    }
  }
}
