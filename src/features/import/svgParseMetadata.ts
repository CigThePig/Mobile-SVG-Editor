import type { ViewBox } from '@/model/document/documentTypes'
import type { ParseContext } from './svgImportTypes'
import { DIAG } from './svgImportTypes'
import { emitWarn } from './svgImportDiagnostics'

// ── SVG root metadata parsing ─────────────────────────────────────────────────

export interface SvgRootMetadata {
  width: number
  height: number
  viewBox: ViewBox
  namespaces: Record<string, string>
  /** preserveAspectRatio if present */
  preserveAspectRatio?: string
}

/**
 * Parse the root `<svg>` element attributes.
 * Extracts width, height, viewBox, and all xmlns:* namespace declarations.
 */
export function parseSvgRootMetadata(
  svgElement: Element,
  ctx: ParseContext
): SvgRootMetadata {
  // Extract namespace declarations
  const namespaces: Record<string, string> = {}
  for (const attr of Array.from(svgElement.attributes)) {
    if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) {
      const prefix = attr.name === 'xmlns' ? '' : attr.name.slice(6)
      if (prefix) {
        namespaces[prefix] = attr.value
        ctx.namespaces[prefix] = attr.value
      }
    }
  }

  // Parse width and height
  const widthStr = svgElement.getAttribute('width')
  const heightStr = svgElement.getAttribute('height')
  const viewBoxStr = svgElement.getAttribute('viewBox')

  let width = 0
  let height = 0
  let viewBox: ViewBox = { x: 0, y: 0, width: 0, height: 0 }

  // Parse viewBox first (gives us the intrinsic size)
  if (viewBoxStr) {
    const parsed = parseViewBox(viewBoxStr)
    if (parsed) {
      viewBox = parsed
      width = parsed.width
      height = parsed.height
    } else {
      emitWarn(ctx, DIAG.MISSING_VIEWBOX, `Could not parse viewBox="${viewBoxStr}"`, {
        attributeName: 'viewBox',
      })
    }
  }

  // Parse explicit width/height (override viewBox-derived values if present)
  if (widthStr) {
    const w = parseSvgLength(widthStr)
    if (w != null) width = w
  }
  if (heightStr) {
    const h = parseSvgLength(heightStr)
    if (h != null) height = h
  }

  // If no viewBox but we have width/height, derive viewBox from them
  if (!viewBoxStr && (width > 0 || height > 0)) {
    viewBox = { x: 0, y: 0, width, height }
  }

  // Emit warning if both width and height are still 0
  if (width === 0 && height === 0) {
    emitWarn(ctx, DIAG.MISSING_VIEWBOX, 'SVG element has no width/height or viewBox; defaulting to 800×600')
    width = 800
    height = 600
    viewBox = { x: 0, y: 0, width: 800, height: 600 }
  }

  const preserveAspectRatio = svgElement.getAttribute('preserveAspectRatio') ?? undefined

  return { width, height, viewBox, namespaces, preserveAspectRatio }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a viewBox attribute string into a ViewBox object.
 * Accepts space or comma separated: "x y width height"
 */
export function parseViewBox(viewBoxStr: string): ViewBox | null {
  const parts = viewBoxStr.trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return null
  const [x, y, width, height] = parts
  return { x, y, width, height }
}

/**
 * Parse an SVG length value to a number.
 * Handles: bare numbers, px, pt, em, mm, cm, %, etc.
 * For percentage and em, returns the numeric part only (absolute conversion requires context).
 */
export function parseSvgLength(value: string): number | null {
  if (!value) return null
  const trimmed = value.trim()
  // Handle percentage — return as-is numeric (caller decides scaling)
  const n = parseFloat(trimmed)
  if (isNaN(n)) return null
  return n
}

/**
 * Collect all id attributes in the entire SVG document tree into ctx.idRegistry.
 * Also populates ctx.seenIds for duplicate detection.
 * Must be called before pass 2 begins.
 */
export function collectAllIds(root: Element, ctx: ParseContext): void {
  walkElementTree(root, (el) => {
    const id = el.getAttribute('id')
    if (!id) return
    const localName = el.localName
    if (ctx.seenIds.has(id)) {
      // Mark as duplicate — repair happens in normalize pass
      ctx.idRegistry.set(id, localName)
    } else {
      ctx.seenIds.add(id)
      ctx.idRegistry.set(id, localName)
    }
  })
}

function walkElementTree(el: Element, visitor: (el: Element) => void): void {
  visitor(el)
  for (const child of Array.from(el.children)) {
    walkElementTree(child, visitor)
  }
}
