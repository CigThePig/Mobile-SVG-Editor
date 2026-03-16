import { nanoid } from 'nanoid'
import type {
  GradientResource,
  GradientStop,
  MarkerResource,
  SymbolResource,
  StyleBlockResource,
} from '@/model/resources/resourceTypes'
import type { ParseContext } from './svgImportTypes'
import { parseFilter } from './svgParseFilters'
import { parsePattern } from './svgParsePatterns'
import { parseStyleBlock } from './svgParseStyles'
import { DIAG } from './svgImportTypes'
import { emitInfo } from './svgImportDiagnostics'

// ── Pass 1: Defs resource collection ─────────────────────────────────────────

/**
 * First pass: walk all `<defs>` elements (and the root `<svg>` for any
 * directly-nested resources) and collect all resources into `ctx.resources`.
 *
 * Also parses `<style>` blocks found anywhere in the document tree.
 */
export function collectResources(svgRoot: Element, ctx: ParseContext): void {
  // Process style blocks first (they affect the entire document)
  collectStyleBlocks(svgRoot, ctx)

  // Process all defs elements
  const defsEls = svgRoot.querySelectorAll('defs')
  for (const defsEl of Array.from(defsEls)) {
    processDefsChildren(defsEl, ctx)
  }

  // Also process any gradient/filter/pattern/marker/symbol directly under <svg>
  // (not wrapped in defs) — this is valid SVG
  processTopLevelResources(svgRoot, ctx)
}

function collectStyleBlocks(svgRoot: Element, ctx: ParseContext): void {
  const styleEls = svgRoot.querySelectorAll('style')
  for (const styleEl of Array.from(styleEls)) {
    const cssText = styleEl.textContent ?? ''
    if (!cssText.trim()) continue

    ctx.hasStyleBlocks = true

    // Parse the CSS into ctx.cssRulesBySelector
    parseStyleBlock(cssText, ctx)

    // Store in resources.styleBlocks for round-trip preservation
    const id = styleEl.getAttribute('id') ?? nanoid(8)
    const media = styleEl.getAttribute('media') ?? undefined
    const resource: StyleBlockResource = {
      id,
      type: 'styleBlock',
      cssText,
      media,
    }
    ctx.resources.styleBlocks.push(resource)
  }
}

function processDefsChildren(defsEl: Element, ctx: ParseContext): void {
  for (const child of Array.from(defsEl.children)) {
    processResourceElement(child, ctx)
  }
}

function processTopLevelResources(svgRoot: Element, ctx: ParseContext): void {
  const resourceTags = new Set([
    'linearGradient', 'radialGradient', 'filter', 'pattern', 'marker', 'symbol',
    'clipPath', 'mask',
  ])
  for (const child of Array.from(svgRoot.children)) {
    if (child.tagName === 'defs') continue // already handled
    if (resourceTags.has(child.localName)) {
      processResourceElement(child, ctx)
    }
  }
}

function processResourceElement(el: Element, ctx: ParseContext): void {
  switch (el.localName) {
    case 'linearGradient':
    case 'radialGradient':
      processGradient(el, ctx)
      break
    case 'filter':
      processFilter(el, ctx)
      break
    case 'pattern':
      processPattern(el, ctx)
      break
    case 'marker':
      processMarker(el, ctx)
      break
    case 'symbol':
      processSymbol(el, ctx)
      break
    case 'style':
      // Style elements inside defs — already processed via querySelectorAll
      break
    // clipPath and mask are processed as nodes in pass 2 (they appear in the node tree)
    default:
      // Unknown defs children — they will be picked up during pass 2 node traversal
      break
  }
}

// ── Gradient parsing ──────────────────────────────────────────────────────────

function processGradient(el: Element, ctx: ParseContext): void {
  const id = el.getAttribute('id')
  if (!id) return

  const isLinear = el.localName === 'linearGradient'
  const stops = parseGradientStops(el)

  // If no stops, check for href/xlink:href inheritance
  const href = el.getAttribute('href') ?? el.getAttributeNS('http://www.w3.org/1999/xlink', 'href')

  const gradientUnits = el.getAttribute('gradientUnits') as GradientResource['gradientUnits'] ?? undefined
  const gradientTransform = el.getAttribute('gradientTransform') ?? undefined
  const spreadMethod = el.getAttribute('spreadMethod') as GradientResource['spreadMethod'] ?? undefined

  const resource: GradientResource = {
    id,
    name: id,
    type: isLinear ? 'linearGradient' : 'radialGradient',
    stops,
    gradientUnits,
    gradientTransform,
    spreadMethod,
    href: href ?? undefined,
  }

  if (isLinear) {
    const x1 = el.getAttribute('x1')
    const y1 = el.getAttribute('y1')
    const x2 = el.getAttribute('x2')
    const y2 = el.getAttribute('y2')
    if (x1 != null) resource.x1 = parseGradientCoord(x1)
    if (y1 != null) resource.y1 = parseGradientCoord(y1)
    if (x2 != null) resource.x2 = parseGradientCoord(x2)
    if (y2 != null) resource.y2 = parseGradientCoord(y2)
  } else {
    const cx = el.getAttribute('cx')
    const cy = el.getAttribute('cy')
    const r = el.getAttribute('r')
    const fx = el.getAttribute('fx')
    const fy = el.getAttribute('fy')
    const fr = el.getAttribute('fr')
    if (cx != null) resource.cx = parseGradientCoord(cx)
    if (cy != null) resource.cy = parseGradientCoord(cy)
    if (r != null) resource.r = parseGradientCoord(r)
    if (fx != null) resource.fx = parseGradientCoord(fx)
    if (fy != null) resource.fy = parseGradientCoord(fy)
    if (fr != null) resource.fr = parseGradientCoord(fr)
  }

  ctx.resources.gradients.push(resource)
}

function parseGradientStops(gradientEl: Element): GradientStop[] {
  const stops: GradientStop[] = []
  for (const child of Array.from(gradientEl.children)) {
    if (child.localName !== 'stop') continue
    const offsetStr = child.getAttribute('offset') ?? '0'
    const offset = parseStopOffset(offsetStr)
    const directColor = child.getAttribute('stop-color')
    const styleColor = parseStopStyleProp(child.getAttribute('style') ?? '', 'stop-color')
    const stopColor = directColor ?? styleColor ?? '#000000'
    const stopOpacityStr = child.getAttribute('stop-opacity') ??
      parseStopStyleProp(child.getAttribute('style') ?? '', 'stop-opacity')
    const stopOpacity = stopOpacityStr != null ? parseFloat(stopOpacityStr) : 1

    stops.push({ offset, color: stopColor, opacity: stopOpacity })
  }
  return stops
}

function parseStopOffset(offsetStr: string): number {
  const trimmed = offsetStr.trim()
  if (trimmed.endsWith('%')) return parseFloat(trimmed) / 100
  return parseFloat(trimmed)
}

function parseStopStyleProp(styleStr: string, prop: string): string | null {
  const match = new RegExp(`${prop}\\s*:\\s*([^;]+)`).exec(styleStr)
  return match ? match[1].trim() : null
}

function parseGradientCoord(val: string): number | string {
  const n = parseFloat(val)
  // If it ends with %, return as string to preserve it
  if (val.trim().endsWith('%')) return val.trim()
  return isNaN(n) ? val : n
}

// ── Filter parsing ────────────────────────────────────────────────────────────

function processFilter(el: Element, ctx: ParseContext): void {
  const resource = parseFilter(el, ctx)
  if (resource) ctx.resources.filters.push(resource)
}

// ── Pattern parsing ───────────────────────────────────────────────────────────

function processPattern(el: Element, ctx: ParseContext): void {
  const resource = parsePattern(el, ctx)
  if (resource) ctx.resources.patterns.push(resource)
}

// ── Marker parsing ────────────────────────────────────────────────────────────

function processMarker(el: Element, ctx: ParseContext): void {
  const id = el.getAttribute('id')
  if (!id) return

  const viewBox = el.getAttribute('viewBox') ?? undefined
  const refX = parseMarkerCoord(el.getAttribute('refX'))
  const refY = parseMarkerCoord(el.getAttribute('refY'))
  const markerWidth = parseMarkerCoord(el.getAttribute('markerWidth'))
  const markerHeight = parseMarkerCoord(el.getAttribute('markerHeight'))
  const orient = el.getAttribute('orient') ?? undefined
  const markerUnits = el.getAttribute('markerUnits') as MarkerResource['markerUnits'] ?? undefined
  const preserveAspectRatio = el.getAttribute('preserveAspectRatio') ?? undefined

  emitInfo(ctx, DIAG.NAMESPACE_PRESERVED, `Marker "${id}" collected`, { elementId: id })

  const resource: MarkerResource = {
    id,
    name: id,
    type: 'marker',
    viewBox,
    refX,
    refY,
    markerWidth,
    markerHeight,
    orient,
    markerUnits,
    preserveAspectRatio,
  }

  ctx.resources.markers.push(resource)
}

function parseMarkerCoord(val: string | null): number | string | undefined {
  if (val == null) return undefined
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}

// ── Symbol parsing ────────────────────────────────────────────────────────────

function processSymbol(el: Element, ctx: ParseContext): void {
  const id = el.getAttribute('id')
  if (!id) return

  const resource: SymbolResource = {
    id,
    name: id,
    type: 'symbol',
    rootNodeId: id, // The SymbolNode in the tree will have this same id
  }

  ctx.resources.symbols.push(resource)
  // Note: the symbol's children will be parsed in pass 2 as a SymbolNode
}
