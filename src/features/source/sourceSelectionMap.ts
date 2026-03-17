/**
 * src/features/source/sourceSelectionMap.ts
 *
 * Maps SVG node IDs to character ranges in the serialized SVG text.
 * Used for bidirectional selection sync between the canvas and the source editor.
 *
 * Algorithm: string scanning for id="<nodeId>" occurrences inside opening tags,
 * then finds the corresponding closing tag to compute the element's full range.
 * This is fast and good enough for selection highlighting — no full XML parse needed.
 */

export interface SourceRange {
  /** Character index of the opening '<' of the element's start tag */
  start: number
  /** Character index just after the last character of the element (closing '>' or '/>' ) */
  end: number
  /** Character index of the attribute value start (after id=") */
  idStart: number
}

/** Map from node ID to its source range */
export type SelectionMap = Map<string, SourceRange>

/**
 * Build a SelectionMap from a serialized SVG text.
 *
 * Scans for id="..." patterns and finds the element boundary for each one.
 */
export function buildSelectionMap(svgText: string): SelectionMap {
  const map: SelectionMap = new Map()

  // Match id="..." or id='...' attributes
  // We look for: id="value" or id='value'
  const idPattern = /\bid=["']([^"']+)["']/g
  let match: RegExpExecArray | null

  while ((match = idPattern.exec(svgText)) !== null) {
    const nodeId = match[1]
    const idAttrStart = match.index

    // Find the start of the element: scan backward from idAttrStart to find '<'
    const elementStart = findElementStart(svgText, idAttrStart)
    if (elementStart === -1) continue

    // Find the end of the element (full element including children)
    const tagName = getTagName(svgText, elementStart)
    if (!tagName) continue

    const elementEnd = findElementEnd(svgText, elementStart, tagName)
    if (elementEnd === -1) continue

    map.set(nodeId, {
      start: elementStart,
      end: elementEnd,
      idStart: idAttrStart,
    })
  }

  return map
}

/**
 * Find the character range for a specific node ID in the map.
 */
export function findRangeForNodeId(map: SelectionMap, nodeId: string): SourceRange | null {
  return map.get(nodeId) ?? null
}

/**
 * Find the node ID whose element range contains the given character offset.
 * Returns the most specific (deepest/last) match.
 */
export function findNodeIdAtOffset(map: SelectionMap, offset: number): string | null {
  let bestId: string | null = null
  let bestSize = Infinity

  for (const [id, range] of map) {
    if (offset >= range.start && offset <= range.end) {
      const size = range.end - range.start
      if (size < bestSize) {
        bestSize = size
        bestId = id
      }
    }
  }

  return bestId
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function findElementStart(text: string, fromIndex: number): number {
  // Scan backward to find the '<' that opens this element
  let i = fromIndex
  while (i >= 0) {
    if (text[i] === '<') {
      // Make sure this isn't a closing tag
      if (text[i + 1] !== '/') return i
      return -1
    }
    if (text[i] === '>') {
      // We crossed into a previous element — shouldn't happen with well-formed SVG
      return -1
    }
    i--
  }
  return -1
}

function getTagName(text: string, elementStart: number): string | null {
  // Extract tag name from '<tagName ...'
  const afterLt = elementStart + 1
  const tagMatch = /^([A-Za-z][A-Za-z0-9:.-]*)/.exec(text.slice(afterLt))
  return tagMatch ? tagMatch[1] : null
}

function findElementEnd(text: string, elementStart: number, tagName: string): number {
  // Check if self-closing: <tag ... />
  // Find the end of the opening tag first
  const openTagEnd = findOpenTagEnd(text, elementStart)
  if (openTagEnd === -1) return -1

  // Self-closing
  if (text[openTagEnd - 1] === '/') {
    return openTagEnd
  }

  // Find matching closing tag </tagName>
  // We need to handle nesting: count opens and closes
  let depth = 1
  let pos = openTagEnd

  const openPattern = new RegExp(`<${escapeRegex(tagName)}(?=[\\s>/>])`, 'g')
  const closePattern = new RegExp(`</${escapeRegex(tagName)}>`, 'g')
  openPattern.lastIndex = pos
  closePattern.lastIndex = pos

  // Simple approach: scan forward character by character for matching close tag
  while (pos < text.length) {
    // Look for next <
    const nextOpen = text.indexOf(`<${tagName}`, pos)
    const nextClose = text.indexOf(`</${tagName}>`, pos)

    if (nextClose === -1) return -1 // malformed

    if (nextOpen !== -1 && nextOpen < nextClose) {
      // Check it's a proper opening tag (followed by space or >)
      const afterTagName = text[nextOpen + 1 + tagName.length]
      if (afterTagName === ' ' || afterTagName === '\n' || afterTagName === '\t' || afterTagName === '>' || afterTagName === '/') {
        depth++
        pos = nextOpen + tagName.length + 1
      } else {
        pos = nextOpen + 1
      }
    } else {
      depth--
      if (depth === 0) {
        return nextClose + tagName.length + 3 // length of </tagName>
      }
      pos = nextClose + tagName.length + 3
    }
  }

  return -1
}

function findOpenTagEnd(text: string, elementStart: number): number {
  // Scan forward to find the '>' that ends the opening tag
  // Handle attributes with quoted strings
  let i = elementStart + 1
  let inQuote: string | null = null

  while (i < text.length) {
    const ch = text[i]
    if (inQuote) {
      if (ch === inQuote) inQuote = null
    } else if (ch === '"' || ch === "'") {
      inQuote = ch
    } else if (ch === '>') {
      return i + 1
    }
    i++
  }
  return -1
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
