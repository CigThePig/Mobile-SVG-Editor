import type { PreservationMeta } from '@/model/nodes/nodeTypes'
import {
  LEVEL_1_TAGS,
  LEVEL_2_TAGS,
  DISPLAY_ONLY_TAGS,
  PRESENTATION_ATTRS,
} from './svgImportTypes'

// ── Editability level assignment ──────────────────────────────────────────────

/**
 * Determine the editability level for an SVG element.
 *
 * Level 1 — Full: rect, circle, ellipse, line, polyline, polygon, path, g, defs
 * Level 2 — Partial: text, image, use, symbol, clipPath, mask, marker, filter,
 *                    pattern, style, a, switch, linearGradient, radialGradient
 * Level 3 — Preserved-raw: foreignObject, namespace-prefixed, unknown elements
 * Level 4 — Display-only: SMIL animation, script
 */
export function getEditabilityLevel(localName: string, namespaceURI: string | null): 1 | 2 | 3 | 4 {
  // Check for SMIL / display-only first
  if (DISPLAY_ONLY_TAGS.has(localName)) return 4

  // SVG namespace check: anything not in SVG NS is Level 3
  const svgNS = 'http://www.w3.org/2000/svg'
  if (namespaceURI && namespaceURI !== svgNS) return 3

  if (localName === 'foreignObject') return 3
  if (LEVEL_1_TAGS.has(localName)) return 1
  if (LEVEL_2_TAGS.has(localName)) return 2

  // Unknown SVG element: preserve as Level 3
  return 3
}

// ── Raw attribute collection ──────────────────────────────────────────────────

/**
 * Collect attributes on an element that are NOT in the standard known set.
 * These become `preservation.rawAttributes` for round-trip fidelity.
 *
 * Known structural attributes that are already mapped to typed model fields
 * should be excluded to avoid double-storage.
 */
export function collectRawAttributes(
  element: Element,
  knownAttrs: Set<string>
): Record<string, string> | undefined {
  const raw: Record<string, string> = {}
  let hasAny = false
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name
    // Skip xmlns declarations, known structural attrs, presentation attrs
    if (name.startsWith('xmlns')) continue
    if (knownAttrs.has(name)) continue
    if (PRESENTATION_ATTRS.has(name)) continue
    // Preserve anything else
    raw[name] = attr.value
    hasAny = true
  }
  return hasAny ? raw : undefined
}

// ── Raw children serialization ────────────────────────────────────────────────

/**
 * Serialize all children of an element to a raw XML string.
 * Used to preserve unknown child elements in `preservation.rawChildren`.
 */
export function serializeChildren(element: Element): string {
  let result = ''
  for (const child of Array.from(element.childNodes)) {
    result += serializeNode(child)
  }
  return result
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeText(node.textContent ?? '')
  }
  if (node.nodeType === Node.CDATA_SECTION_NODE) {
    return `<![CDATA[${node.textContent ?? ''}]]>`
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    return `<!--${node.textContent ?? ''}-->`
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    return serializeElement(node as Element)
  }
  return ''
}

function serializeElement(el: Element): string {
  const tag = el.tagName
  let attrs = ''
  for (const attr of Array.from(el.attributes)) {
    attrs += ` ${attr.name}="${escapeAttr(attr.value)}"`
  }
  const childContent = serializeChildren(el)
  if (!childContent && el.childNodes.length === 0) {
    return `<${tag}${attrs}/>`
  }
  return `<${tag}${attrs}>${childContent}</${tag}>`
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── PreservationMeta builder ──────────────────────────────────────────────────

export interface PreservationMetaOptions {
  element: Element
  editabilityLevel: 1 | 2 | 3 | 4
  knownAttrs: Set<string>
  diagnosticIds?: string[]
  /** If true, serialize all element children as rawChildren */
  captureRawChildren?: boolean
  sourceOffset?: number
  /** ParseContext to update with hasRawAttributes flag when unknown attrs are found */
  ctx?: { hasRawAttributes: boolean }
}

export function buildPreservationMeta(opts: PreservationMetaOptions): PreservationMeta {
  const rawAttributes = collectRawAttributes(opts.element, opts.knownAttrs)
  const rawChildren = opts.captureRawChildren ? serializeChildren(opts.element) || undefined : undefined

  if (rawAttributes !== undefined && opts.ctx) {
    opts.ctx.hasRawAttributes = true
  }

  return {
    sourceElementName: opts.element.localName,
    editabilityLevel: opts.editabilityLevel,
    rawAttributes: rawAttributes ?? undefined,
    rawChildren: rawChildren ?? undefined,
    sourceOffset: opts.sourceOffset,
    importDiagnosticIds: opts.diagnosticIds?.length ? opts.diagnosticIds : undefined,
  }
}
