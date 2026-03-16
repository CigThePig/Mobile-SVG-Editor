import type { PatternResource } from '@/model/resources/resourceTypes'
import type { ParseContext } from './svgImportTypes'
import { DIAG } from './svgImportTypes'
import { emitInfo } from './svgImportDiagnostics'
import { serializeChildren } from './svgImportPreservation'

// ── Pattern parsing ───────────────────────────────────────────────────────────

/**
 * Parse a `<pattern>` element into a PatternResource.
 *
 * Simple patterns with basic attributes are stored with structured fields.
 * Complex patterns (with nested structure) use rawXml fallback.
 */
export function parsePattern(patternEl: Element, ctx: ParseContext): PatternResource | null {
  const id = patternEl.getAttribute('id')
  if (!id) return null

  const x = parseFloat(patternEl.getAttribute('x') ?? '0')
  const y = parseFloat(patternEl.getAttribute('y') ?? '0')
  const width = parseFloat(patternEl.getAttribute('width') ?? '0')
  const height = parseFloat(patternEl.getAttribute('height') ?? '0')
  const patternUnits = patternEl.getAttribute('patternUnits') as PatternResource['patternUnits'] ?? 'objectBoundingBox'
  const patternContentUnits = patternEl.getAttribute('patternContentUnits') as PatternResource['patternContentUnits'] ?? 'userSpaceOnUse'
  const patternTransform = patternEl.getAttribute('patternTransform') ?? undefined
  const viewBox = patternEl.getAttribute('viewBox') ?? undefined
  const preserveAspectRatio = patternEl.getAttribute('preserveAspectRatio') ?? undefined

  // Check if this is a complex pattern that we can't fully structure yet
  const hasComplexChildren = Array.from(patternEl.children).some(
    (child) => !isSimplePatternChild(child.localName)
  )

  const resource: PatternResource = {
    id,
    name: id,
    type: 'pattern',
    x: isNaN(x) ? undefined : x,
    y: isNaN(y) ? undefined : y,
    width: isNaN(width) ? undefined : width,
    height: isNaN(height) ? undefined : height,
    patternUnits,
    patternContentUnits,
    patternTransform,
    viewBox,
    preserveAspectRatio,
  }

  if (hasComplexChildren) {
    // Store as raw XML for complex patterns
    resource.rawXml = buildPatternRawXml(patternEl)
    emitInfo(
      ctx,
      DIAG.PATTERN_PRESERVED_RAW,
      `Pattern "${id}" stored as raw XML — complex pattern content`,
      { elementId: id }
    )
  }
  // Note: simple pattern children would be parsed in Phase 3/10.
  // For Phase 2, we always store raw XML as a safe fallback.
  if (!resource.rawXml) {
    resource.rawXml = buildPatternRawXml(patternEl)
  }

  return resource
}

function isSimplePatternChild(localName: string): boolean {
  return ['rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'g'].includes(localName)
}

function buildPatternRawXml(patternEl: Element): string {
  const id = patternEl.getAttribute('id') ?? ''
  let attrs = `id="${escapeAttr(id)}"`
  for (const attr of Array.from(patternEl.attributes)) {
    if (attr.name !== 'id') {
      attrs += ` ${attr.name}="${escapeAttr(attr.value)}"`
    }
  }
  const innerXml = serializeChildren(patternEl)
  return `<pattern ${attrs}>${innerXml}</pattern>`
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
