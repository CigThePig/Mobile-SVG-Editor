import { nanoid } from 'nanoid'
import type {
  TextNode,
  TspanNode,
  TextPathNode,
  TextStyleModel,
} from '@/model/nodes/nodeTypes'
import type { ParseContext } from './svgImportTypes'
import { resolveElementStyle, parseCssLength } from './svgParseStyles'
import { parseTransform } from './svgParseTransforms'
import { buildPreservationMeta } from './svgImportPreservation'
import { getEditabilityLevel } from './svgImportPreservation'
import { resolveHref } from './svgParseReferences'

// ── Text element parsing ──────────────────────────────────────────────────────

const TEXT_KNOWN_ATTRS = new Set([
  'id', 'x', 'y', 'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust',
  'transform', 'class', 'style', 'visibility', 'display',
  'font-family', 'font-size', 'font-weight', 'font-style',
  'text-anchor', 'dominant-baseline', 'fill', 'stroke', 'opacity',
  'letter-spacing', 'word-spacing', 'line-height', 'text-decoration',
  'writing-mode', 'xml:space',
])

/**
 * Parse a `<text>` element into a TextNode.
 * Recursively parses `<tspan>` and `<textPath>` children.
 */
export function parseTextElement(el: Element, ctx: ParseContext): TextNode {
  const id = el.getAttribute('id') ?? nanoid(8)
  const resolvedStyle = resolveElementStyle(el, ctx)

  const x = parseFloat(el.getAttribute('x') ?? resolvedStyle['x'] ?? '0')
  const y = parseFloat(el.getAttribute('y') ?? resolvedStyle['y'] ?? '0')

  const textStyle = extractTextStyle(resolvedStyle, el)
  const transform = parseTransform(el.getAttribute('transform'), ctx, id)

  // Determine children: tspan, textPath, or plain text content
  const childElements = Array.from(el.childNodes)
  const runs: TspanNode[] = []
  let plainContent = ''

  for (const child of childElements) {
    if (child.nodeType === Node.TEXT_NODE) {
      plainContent += child.textContent ?? ''
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as Element
      if (childEl.localName === 'tspan') {
        const tspan = parseTspanElement(childEl, ctx)
        if (tspan) runs.push(tspan)
      } else if (childEl.localName === 'textPath') {
        const textPath = parseTextPathElement(childEl, ctx)
        if (textPath) {
          // textPath is a special child — add as a run of type 'textPath'
          // We store it by adding to runs after casting appropriately
          // TextPathNode and TspanNode are distinct; the TextNode.runs
          // only accepts TspanNode[], so we add the textPath as a special tspan wrapper
          runs.push(wrapTextPathAsTspan(textPath))
        }
      }
    }
  }

  const preservation = buildPreservationMeta({
    element: el,
    editabilityLevel: getEditabilityLevel(el.localName, el.namespaceURI),
    knownAttrs: TEXT_KNOWN_ATTRS,
  })

  const node: TextNode = {
    id,
    type: 'text',
    name: el.getAttribute('data-name') ?? undefined,
    visible: el.getAttribute('visibility') !== 'hidden' && el.getAttribute('display') !== 'none',
    locked: false,
    x: isNaN(x) ? 0 : x,
    y: isNaN(y) ? 0 : y,
    content: plainContent.trim(),
    runs: runs.length > 0 ? runs : undefined,
    textStyle,
    transform,
    className: el.getAttribute('class') ?? undefined,
    preservation,
  }

  return node
}

// ── Tspan parsing ─────────────────────────────────────────────────────────────

const TSPAN_KNOWN_ATTRS = new Set([
  'id', 'x', 'y', 'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust',
  'class', 'style', 'visibility', 'display',
  'font-family', 'font-size', 'font-weight', 'font-style',
  'text-anchor', 'dominant-baseline', 'fill', 'stroke', 'opacity',
])

export function parseTspanElement(el: Element, ctx: ParseContext): TspanNode | null {
  const id = el.getAttribute('id') ?? nanoid(8)
  const resolvedStyle = resolveElementStyle(el, ctx)

  const x = parseFloat(el.getAttribute('x') ?? '')
  const y = parseFloat(el.getAttribute('y') ?? '')
  const dx = parseFloat(el.getAttribute('dx') ?? '')
  const dy = parseFloat(el.getAttribute('dy') ?? '')
  const rotate = parseFloat(el.getAttribute('rotate') ?? '')
  const textLength = parseFloat(el.getAttribute('textLength') ?? '')

  const textStyle = extractTextStyle(resolvedStyle, el)

  // Parse nested children
  const childRuns: TspanNode[] = []
  let content = ''

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      content += child.textContent ?? ''
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as Element
      if (childEl.localName === 'tspan') {
        const nested = parseTspanElement(childEl, ctx)
        if (nested) childRuns.push(nested)
      }
    }
  }

  const preservation = buildPreservationMeta({
    element: el,
    editabilityLevel: 2,
    knownAttrs: TSPAN_KNOWN_ATTRS,
  })

  const node: TspanNode = {
    id,
    type: 'tspan',
    visible: true,
    locked: false,
    content: childRuns.length > 0 ? undefined : content,
    runs: childRuns.length > 0 ? childRuns : undefined,
    textStyle,
    preservation,
    className: el.getAttribute('class') ?? undefined,
  }

  if (!isNaN(x)) node.x = x
  if (!isNaN(y)) node.y = y
  if (!isNaN(dx)) node.dx = dx
  if (!isNaN(dy)) node.dy = dy
  if (!isNaN(rotate)) node.rotate = rotate
  if (!isNaN(textLength)) node.textLength = textLength

  return node
}

// ── TextPath parsing ──────────────────────────────────────────────────────────

const TEXTPATH_KNOWN_ATTRS = new Set([
  'id', 'href', 'xlink:href', 'startOffset', 'method', 'spacing',
  'class', 'style', 'textLength', 'lengthAdjust',
])

export function parseTextPathElement(el: Element, ctx: ParseContext): TextPathNode | null {
  const id = el.getAttribute('id') ?? nanoid(8)
  const href = resolveHref(el)
  if (!href) return null

  const startOffsetStr = el.getAttribute('startOffset')
  let startOffset: number | string | undefined
  if (startOffsetStr) {
    if (startOffsetStr.endsWith('%')) {
      startOffset = startOffsetStr
    } else {
      const n = parseFloat(startOffsetStr)
      startOffset = isNaN(n) ? startOffsetStr : n
    }
  }

  const method = el.getAttribute('method') as TextPathNode['method'] ?? undefined
  const spacing = el.getAttribute('spacing') as TextPathNode['spacing'] ?? undefined

  // Content and nested tspans
  const childRuns: TspanNode[] = []
  let content = ''

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      content += child.textContent ?? ''
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as Element
      if (childEl.localName === 'tspan') {
        const tspan = parseTspanElement(childEl, ctx)
        if (tspan) childRuns.push(tspan)
      }
    }
  }

  const preservation = buildPreservationMeta({
    element: el,
    editabilityLevel: 2,
    knownAttrs: TEXTPATH_KNOWN_ATTRS,
  })

  const node: TextPathNode = {
    id,
    type: 'textPath',
    visible: true,
    locked: false,
    href,
    startOffset,
    method,
    spacing,
    content: childRuns.length > 0 ? undefined : content,
    runs: childRuns.length > 0 ? childRuns : undefined,
    preservation,
  }

  return node
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractTextStyle(
  resolvedStyle: Record<string, string>,
  el: Element
): TextStyleModel | undefined {
  const fontFamily = resolvedStyle['font-family'] ?? el.getAttribute('font-family')
  const fontSize = resolvedStyle['font-size'] ?? el.getAttribute('font-size')
  const fontWeight = resolvedStyle['font-weight'] ?? el.getAttribute('font-weight')
  const fontStyle = resolvedStyle['font-style'] ?? el.getAttribute('font-style')
  const textAnchor = resolvedStyle['text-anchor'] ?? el.getAttribute('text-anchor')
  const dominantBaseline = resolvedStyle['dominant-baseline'] ?? el.getAttribute('dominant-baseline')
  const letterSpacing = resolvedStyle['letter-spacing'] ?? el.getAttribute('letter-spacing')
  const textDecoration = resolvedStyle['text-decoration'] ?? el.getAttribute('text-decoration')
  const writingMode = resolvedStyle['writing-mode'] ?? el.getAttribute('writing-mode')

  const style: TextStyleModel = {}
  if (fontFamily) style.fontFamily = fontFamily.replace(/['"]/g, '').trim()
  if (fontSize) {
    const n = parseCssLength(fontSize)
    if (n != null) style.fontSize = n
  }
  if (fontWeight) style.fontWeight = fontWeight
  if (fontStyle) style.fontStyle = fontStyle as TextStyleModel['fontStyle']
  if (textAnchor) style.textAnchor = textAnchor as TextStyleModel['textAnchor']
  if (dominantBaseline) style.dominantBaseline = dominantBaseline
  if (letterSpacing) {
    const n = parseCssLength(letterSpacing)
    if (n != null) style.letterSpacing = n
  }
  if (textDecoration) style.textDecoration = textDecoration
  if (writingMode) style.writingMode = writingMode

  return Object.keys(style).length > 0 ? style : undefined
}

/**
 * Wrap a TextPathNode as a TspanNode for storage in TextNode.runs.
 * This is a compatibility wrapper since TextNode.runs only accepts TspanNode[].
 * The actual TextPathNode data is accessible via preservation.
 */
function wrapTextPathAsTspan(textPath: TextPathNode): TspanNode {
  return {
    id: textPath.id,
    type: 'tspan',
    visible: true,
    locked: false,
    content: textPath.content,
    runs: textPath.runs,
    preservation: textPath.preservation,
  }
}
