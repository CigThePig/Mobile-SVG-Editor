import type { FilterResource } from '@/model/resources/resourceTypes'
import type { ParseContext } from './svgImportTypes'
import { DIAG } from './svgImportTypes'
import { emitInfo } from './svgImportDiagnostics'
import { serializeChildren } from './svgImportPreservation'

// ── Filter parsing ────────────────────────────────────────────────────────────

/**
 * Parse a `<filter>` element into a FilterResource.
 *
 * Filter primitives (feBlend, feGaussianBlur, etc.) are complex and highly
 * varied. Phase 2 stores them as raw XML for safe round-trip preservation.
 * Phase 10+ will add structured editing support for filter primitives.
 */
export function parseFilter(filterEl: Element, ctx: ParseContext): FilterResource | null {
  const id = filterEl.getAttribute('id')
  if (!id) return null

  // Parse basic positioning attributes
  const x = filterEl.getAttribute('x') ?? undefined
  const y = filterEl.getAttribute('y') ?? undefined
  const width = filterEl.getAttribute('width') ?? undefined
  const height = filterEl.getAttribute('height') ?? undefined
  const filterUnits = filterEl.getAttribute('filterUnits') as FilterResource['filterUnits'] ?? undefined
  const primitiveUnits = filterEl.getAttribute('primitiveUnits') as FilterResource['primitiveUnits'] ?? undefined

  // Store the entire filter element contents as raw XML
  const rawXml = buildFilterRawXml(filterEl)

  const diagId = emitInfo(
    ctx,
    DIAG.FILTER_PRESERVED_RAW,
    `Filter "${id}" stored as raw XML — editing requires Phase 10+`,
    { elementId: id }
  )

  const resource: FilterResource = {
    id,
    name: id,
    type: 'filter',
    rawXml,
  }

  // Only assign defined numeric/string values
  if (x != null) resource.x = x
  if (y != null) resource.y = y
  if (width != null) resource.width = width
  if (height != null) resource.height = height
  if (filterUnits) resource.filterUnits = filterUnits
  if (primitiveUnits) resource.primitiveUnits = primitiveUnits

  void diagId
  return resource
}

/**
 * Serialize a filter element back to raw XML string (including the wrapping <filter> tag).
 */
function buildFilterRawXml(filterEl: Element): string {
  const id = filterEl.getAttribute('id') ?? ''
  let attrs = `id="${escapeAttr(id)}"`

  const attrsToCopy = ['x', 'y', 'width', 'height', 'filterUnits', 'primitiveUnits', 'color-interpolation-filters']
  for (const attrName of attrsToCopy) {
    const val = filterEl.getAttribute(attrName)
    if (val != null) attrs += ` ${attrName}="${escapeAttr(val)}"`
  }

  // Copy any other attributes
  for (const attr of Array.from(filterEl.attributes)) {
    if (attr.name !== 'id' && !attrsToCopy.includes(attr.name)) {
      attrs += ` ${attr.name}="${escapeAttr(attr.value)}"`
    }
  }

  const innerXml = serializeChildren(filterEl)
  return `<filter ${attrs}>${innerXml}</filter>`
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
