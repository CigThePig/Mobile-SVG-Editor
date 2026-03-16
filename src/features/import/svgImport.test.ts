// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { parseSvgString } from './svgParseDocument'
import { parseTransform } from './svgParseTransforms'
import { parseInlineStyle } from './svgParseStyles'
import { parseViewBox } from './svgParseMetadata'
import type { SvgNode, RootNode } from '@/model/nodes/nodeTypes'

// ── Fixture helpers ───────────────────────────────────────────────────────────

function svg(content: string, attrs = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" ${attrs}>${content}</svg>`
}

/** Get root children — RootNode always has children[] */
function children(result: ReturnType<typeof parseSvgString>): SvgNode[] {
  return ((result.doc.root as RootNode).children) ?? []
}

// ── 1. Simple shapes-only SVG ─────────────────────────────────────────────────

describe('parseSvgString — simple shapes', () => {
  it('parses rect, circle, path into Tier 1 document', () => {
    const result = parseSvgString(svg(`
      <rect id="r1" x="10" y="20" width="100" height="50" fill="#ff0000"/>
      <circle id="c1" cx="50" cy="50" r="30" fill="#0000ff"/>
      <path id="p1" d="M0,0 L100,100 Z" stroke="#000" stroke-width="2"/>
    `))
    expect(result.fidelityTier).toBe(1)
    expect(result.errorCount).toBe(0)
    const nodes = children(result)
    expect(nodes).toHaveLength(3)
    const rect = nodes[0]
    expect(rect.type).toBe('rect')
    if (rect.type === 'rect') {
      expect(rect.x).toBe(10)
      expect(rect.y).toBe(20)
      expect(rect.width).toBe(100)
      expect(rect.height).toBe(50)
      expect(rect.style?.fill).toEqual({ kind: 'solid', color: '#ff0000' })
    }
    const circle = nodes[1]
    expect(circle.type).toBe('circle')
    if (circle.type === 'circle') {
      expect(circle.cx).toBe(50)
      expect(circle.cy).toBe(50)
      expect(circle.r).toBe(30)
    }
    const path = nodes[2]
    expect(path.type).toBe('path')
    if (path.type === 'path') {
      expect(path.d).toBe('M0,0 L100,100 Z')
    }
  })

  it('assigns preservation metadata to all nodes', () => {
    const result = parseSvgString(svg(`<rect id="r1" x="0" y="0" width="50" height="50"/>`))
    const rect = children(result)[0]
    expect(rect.preservation?.editabilityLevel).toBe(1)
    expect(rect.preservation?.sourceElementName).toBe('rect')
  })

  it('sets document width/height from viewBox', () => {
    const result = parseSvgString(svg(''))
    expect(result.doc.width).toBe(200)
    expect(result.doc.height).toBe(200)
    expect(result.doc.viewBox).toEqual({ x: 0, y: 0, width: 200, height: 200 })
  })
})

// ── 2. Gradients ──────────────────────────────────────────────────────────────

describe('parseSvgString — gradients', () => {
  it('parses linearGradient into resources', () => {
    const result = parseSvgString(svg(`
      <defs>
        <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ff0000"/>
          <stop offset="100%" stop-color="#0000ff"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="50" fill="url(#grad1)"/>
    `))
    expect(result.doc.resources.gradients).toHaveLength(1)
    const grad = result.doc.resources.gradients[0]
    expect(grad.type).toBe('linearGradient')
    expect(grad.id).toBe('grad1')
    expect(grad.stops).toHaveLength(2)
    expect(grad.stops[0].color).toBe('#ff0000')
    expect(grad.stops[1].color).toBe('#0000ff')
  })

  it('parses radialGradient into resources', () => {
    const result = parseSvgString(svg(`
      <defs>
        <radialGradient id="radial1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="white"/>
          <stop offset="100%" stop-color="black"/>
        </radialGradient>
      </defs>
    `))
    const grad = result.doc.resources.gradients[0]
    expect(grad.type).toBe('radialGradient')
    expect(grad.cx).toBe('50%')
    expect(grad.cy).toBe('50%')
    expect(grad.r).toBe('50%')
  })

  it('parses url(#id) fill reference', () => {
    const result = parseSvgString(svg(`
      <defs>
        <linearGradient id="g1"><stop offset="0%" stop-color="red"/></linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="50" fill="url(#g1)"/>
    `))
    const rect = children(result).find(n => n.type === 'rect')
    if (rect?.type === 'rect') {
      expect(rect.style?.fill?.kind).toBe('gradient')
      if (rect.style?.fill?.kind === 'gradient') {
        expect(rect.style.fill.resourceId).toBe('g1')
      }
    }
  })
})

// ── 3. Style block with class selectors ──────────────────────────────────────

describe('parseSvgString — style blocks', () => {
  it('parses <style> block and applies class selectors', () => {
    const result = parseSvgString(svg(`
      <style>.red { fill: #ff0000; stroke: #000; stroke-width: 2; }</style>
      <rect id="r1" class="red" x="0" y="0" width="50" height="50"/>
    `))
    expect(result.doc.resources.styleBlocks).toHaveLength(1)
    expect(result.doc.resources.styleBlocks[0].cssText).toContain('.red')
    const rect = children(result).find(n => n.type === 'rect')
    expect(rect).toBeDefined()
    if (rect?.type === 'rect') {
      expect(rect.style?.fill).toBeDefined()
      expect(rect.style?.fill?.kind).toBe('solid')
    }
  })

  it('sets fidelityTier to 2 when style blocks present', () => {
    const result = parseSvgString(svg(`
      <style>.x { fill: red; }</style>
      <rect class="x" x="0" y="0" width="10" height="10"/>
    `))
    expect(result.fidelityTier).toBeGreaterThanOrEqual(2)
  })

  it('stores style blocks in resources for round-trip', () => {
    const cssText = '.cls-1 { fill: blue; opacity: 0.5; }'
    const result = parseSvgString(svg(`<style>${cssText}</style>`))
    expect(result.doc.resources.styleBlocks[0].cssText).toBe(cssText)
  })
})

// ── 4. Text and tspan ─────────────────────────────────────────────────────────

describe('parseSvgString — text elements', () => {
  it('parses simple <text> element', () => {
    const result = parseSvgString(svg(`
      <text x="10" y="50" font-family="Arial" font-size="16">Hello World</text>
    `))
    const text = children(result).find(n => n.type === 'text')
    expect(text).toBeDefined()
    if (text?.type === 'text') {
      expect(text.x).toBe(10)
      expect(text.y).toBe(50)
      expect(text.content).toBe('Hello World')
      expect(text.textStyle?.fontFamily).toBe('Arial')
      expect(text.textStyle?.fontSize).toBe(16)
    }
  })

  it('parses <text> with <tspan> children', () => {
    const result = parseSvgString(svg(`
      <text x="10" y="30">
        <tspan dy="10" font-weight="bold">Bold text</tspan>
        <tspan dy="20" font-style="italic">Italic text</tspan>
      </text>
    `))
    const text = children(result).find(n => n.type === 'text')
    expect(text?.type).toBe('text')
    if (text?.type === 'text') {
      expect(text.runs).toHaveLength(2)
      if (text.runs) {
        expect(text.runs[0].type).toBe('tspan')
        expect(text.runs[0].content).toBe('Bold text')
        expect(text.runs[0].dy).toBe(10)
        expect(text.runs[1].type).toBe('tspan')
      }
    }
  })
})

// ── 5. Use and symbol ─────────────────────────────────────────────────────────

describe('parseSvgString — use and symbol', () => {
  it('parses <symbol> and <use>', () => {
    const result = parseSvgString(svg(`
      <defs>
        <symbol id="icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/>
        </symbol>
      </defs>
      <use href="#icon" x="10" y="10" width="24" height="24"/>
    `))
    expect(result.doc.resources.symbols).toHaveLength(1)
    expect(result.doc.resources.symbols[0].id).toBe('icon')
    const useNode = children(result).find(n => n.type === 'use')
    expect(useNode).toBeDefined()
    if (useNode?.type === 'use') {
      expect(useNode.href).toBe('icon')
      expect(useNode.x).toBe(10)
      expect(useNode.y).toBe(10)
    }
  })
})

// ── 6. ClipPath and mask ──────────────────────────────────────────────────────

describe('parseSvgString — clipPath and mask', () => {
  it('parses <clipPath> element', () => {
    const result = parseSvgString(svg(`
      <defs>
        <clipPath id="clip1">
          <rect x="0" y="0" width="50" height="50"/>
        </clipPath>
      </defs>
      <rect x="0" y="0" width="100" height="100" clip-path="url(#clip1)"/>
    `))
    const defsNode = children(result).find(n => n.type === 'defs')
    expect(defsNode?.type).toBe('defs')
    if (defsNode?.type === 'defs') {
      const clipPath = defsNode.children.find(n => n.type === 'clipPath')
      expect(clipPath).toBeDefined()
      expect(clipPath?.id).toBe('clip1')
    }
    const rect = children(result).find(n => n.type === 'rect')
    if (rect?.type === 'rect') {
      expect(rect.style?.clipPathRef).toBe('clip1')
    }
  })
})

// ── 7. Filter (raw XML preservation) ─────────────────────────────────────────

describe('parseSvgString — filters', () => {
  it('preserves <filter> as raw XML', () => {
    const result = parseSvgString(svg(`
      <defs>
        <filter id="blur1" x="0" y="0" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5"/>
        </filter>
      </defs>
      <rect x="0" y="0" width="100" height="100" filter="url(#blur1)"/>
    `))
    expect(result.doc.resources.filters).toHaveLength(1)
    const filter = result.doc.resources.filters[0]
    expect(filter.id).toBe('blur1')
    expect(filter.rawXml).toBeDefined()
    expect(filter.rawXml).toContain('feGaussianBlur')
    const filterDiag = result.doc.diagnostics?.find(d => d.code === 'FILTER_PRESERVED_RAW')
    expect(filterDiag).toBeDefined()
  })
})

// ── 8. ForeignObject (rawXml preservation) ────────────────────────────────────

describe('parseSvgString — foreignObject', () => {
  it('preserves foreignObject as rawXml with Level 3 editability', () => {
    const result = parseSvgString(svg(`
      <foreignObject x="10" y="10" width="100" height="50">
        <div xmlns="http://www.w3.org/1999/xhtml">Hello HTML</div>
      </foreignObject>
    `))
    const fo = children(result).find(n => n.type === 'foreignObject')
    expect(fo).toBeDefined()
    expect(fo?.preservation?.editabilityLevel).toBe(3)
    if (fo?.type === 'foreignObject') {
      expect(fo.x).toBe(10)
      expect(fo.y).toBe(10)
      expect(fo.width).toBe(100)
      expect(fo.height).toBe(50)
      expect(fo.rawXml).toContain('Hello HTML')
    }
    expect(result.fidelityTier).toBe(3)
  })
})

// ── 9. Duplicate ID repair ────────────────────────────────────────────────────

describe('parseSvgString — duplicate IDs', () => {
  it('detects and repairs duplicate IDs', () => {
    const result = parseSvgString(svg(`
      <rect id="shape1" x="0" y="0" width="50" height="50"/>
      <circle id="shape1" cx="100" cy="100" r="20"/>
    `))
    const dupDiag = result.doc.diagnostics?.find(d => d.code === 'DUPLICATE_ID_REPAIRED')
    expect(dupDiag).toBeDefined()
    expect(dupDiag?.severity).toBe('warning')
    const rect = children(result).find(n => n.type === 'rect')
    const circle = children(result).find(n => n.type === 'circle')
    expect(rect?.id).toBeDefined()
    expect(circle?.id).toBeDefined()
    expect(rect?.id).not.toBe(circle?.id)
  })
})

// ── 10. Namespace preservation (Inkscape) ────────────────────────────────────

describe('parseSvgString — namespace preservation', () => {
  it('preserves xmlns namespace declarations', () => {
    const result = parseSvgString(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="100" height="100" viewBox="0 0 100 100">
        <rect x="0" y="0" width="50" height="50"/>
      </svg>`
    )
    expect(result.doc.namespaces?.inkscape).toBe('http://www.inkscape.org/namespaces/inkscape')
  })

  it('handles elements with non-SVG namespace by preserving them', () => {
    const result = parseSvgString(svg(`
      <rect x="0" y="0" width="50" height="50"/>
    `, 'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"'))
    expect(children(result).some(n => n.type === 'rect')).toBe(true)
  })
})

// ── 11. Complex transforms ────────────────────────────────────────────────────

describe('parseTransform — transform attribute parsing', () => {
  it('parses translate(x, y)', () => {
    const t = parseTransform('translate(10, 20)')
    expect(t?.translateX).toBe(10)
    expect(t?.translateY).toBe(20)
  })

  it('parses scale(sx, sy)', () => {
    const t = parseTransform('scale(2, 3)')
    expect(t?.scaleX).toBe(2)
    expect(t?.scaleY).toBe(3)
  })

  it('parses rotate(angle)', () => {
    const t = parseTransform('rotate(45)')
    expect(t?.rotate).toBe(45)
  })

  it('parses rotate(angle, cx, cy)', () => {
    const t = parseTransform('rotate(90, 50, 50)')
    expect(t?.rotate).toBe(90)
    expect(t?.pivotX).toBe(50)
    expect(t?.pivotY).toBe(50)
  })

  it('parses matrix(...)', () => {
    const t = parseTransform('matrix(1, 0, 0, 1, 10, 20)')
    expect(t?.matrix).toBeDefined()
    expect(t?.translateX).toBe(10)
    expect(t?.translateY).toBe(20)
  })

  it('parses skewX(angle)', () => {
    const t = parseTransform('skewX(30)')
    expect(t?.skewX).toBe(30)
  })

  it('returns undefined for empty string', () => {
    expect(parseTransform('')).toBeUndefined()
    expect(parseTransform(null)).toBeUndefined()
  })

  it('stores matrix for chained transforms', () => {
    const t = parseTransform('translate(10, 0) rotate(45)')
    expect(t?.matrix).toBeDefined()
  })
})

// ── 12. Nested groups with inherited styles ───────────────────────────────────

describe('parseSvgString — nested groups', () => {
  it('parses nested groups preserving hierarchy', () => {
    const result = parseSvgString(svg(`
      <g id="outer" transform="translate(10, 10)">
        <g id="inner" opacity="0.5">
          <rect id="r1" x="0" y="0" width="50" height="50" fill="blue"/>
        </g>
      </g>
    `))
    const outer = children(result).find(n => n.id === 'outer')
    expect(outer?.type).toBe('group')
    if (outer?.type === 'group') {
      expect(outer.transform?.translateX).toBe(10)
      const inner = outer.children.find(n => n.id === 'inner')
      expect(inner?.type).toBe('group')
      if (inner?.type === 'group') {
        const rect = inner.children.find(n => n.type === 'rect')
        expect(rect).toBeDefined()
      }
    }
  })

  it('parses polyline and polygon points', () => {
    const result = parseSvgString(svg(`
      <polyline points="0,0 50,50 100,0"/>
      <polygon points="0,0 50,100 100,0"/>
    `))
    const polyline = children(result).find(n => n.type === 'polyline')
    expect(polyline?.type).toBe('polyline')
    if (polyline?.type === 'polyline') {
      expect(polyline.points).toHaveLength(3)
      expect(polyline.points[0]).toEqual({ x: 0, y: 0 })
      expect(polyline.points[1]).toEqual({ x: 50, y: 50 })
    }
    const polygon = children(result).find(n => n.type === 'polygon')
    expect(polygon?.type).toBe('polygon')
  })
})

// ── parseInlineStyle ──────────────────────────────────────────────────────────

describe('parseInlineStyle', () => {
  it('parses fill and stroke from inline style', () => {
    const props = parseInlineStyle('fill: #ff0000; stroke: blue; stroke-width: 2px;')
    expect(props['fill']).toBe('#ff0000')
    expect(props['stroke']).toBe('blue')
    expect(props['stroke-width']).toBe('2px')
  })

  it('returns empty object for empty string', () => {
    expect(parseInlineStyle('')).toEqual({})
    expect(parseInlineStyle(null)).toEqual({})
  })
})

// ── parseViewBox ──────────────────────────────────────────────────────────────

describe('parseViewBox', () => {
  it('parses space-separated viewBox', () => {
    const vb = parseViewBox('0 0 800 600')
    expect(vb).toEqual({ x: 0, y: 0, width: 800, height: 600 })
  })

  it('parses comma-separated viewBox', () => {
    const vb = parseViewBox('10,20,400,300')
    expect(vb).toEqual({ x: 10, y: 20, width: 400, height: 300 })
  })

  it('returns null for invalid viewBox', () => {
    expect(parseViewBox('not a viewbox')).toBeNull()
    expect(parseViewBox('1 2 3')).toBeNull()
  })
})

// ── Error handling ────────────────────────────────────────────────────────────

describe('parseSvgString — error handling', () => {
  it('handles invalid XML gracefully', () => {
    const result = parseSvgString('<svg><unclosed>')
    expect(result).toBeDefined()
    expect(result.doc).toBeDefined()
  })

  it('handles empty string', () => {
    const result = parseSvgString('')
    expect(result).toBeDefined()
    expect(result.errorCount).toBeGreaterThan(0)
  })

  it('handles non-SVG XML', () => {
    const result = parseSvgString('<html><body>Not SVG</body></html>')
    expect(result.errorCount).toBeGreaterThan(0)
  })
})

// ── idRegistry ───────────────────────────────────────────────────────────────

describe('parseSvgString — idRegistry', () => {
  it('builds idRegistry for all elements with ids', () => {
    const result = parseSvgString(svg(`
      <rect id="r1" x="0" y="0" width="50" height="50"/>
      <circle id="c1" cx="50" cy="50" r="25"/>
    `))
    expect(result.doc.idRegistry).toBeDefined()
    expect(result.doc.idRegistry?.['r1']).toBe('rect')
    expect(result.doc.idRegistry?.['c1']).toBe('circle')
  })
})
