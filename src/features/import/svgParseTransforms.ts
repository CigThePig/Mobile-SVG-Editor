import type { TransformModel } from '@/model/nodes/nodeTypes'
import type { ParseContext } from './svgImportTypes'
import { DIAG } from './svgImportTypes'
import { emitWarn } from './svgImportDiagnostics'

// ── Transform string parsing ──────────────────────────────────────────────────

/**
 * Parse an SVG `transform` attribute string into a `TransformModel`.
 *
 * Supports: translate, rotate, scale, skewX, skewY, matrix
 * For complex transforms (chained, matrix-only), stores the raw matrix.
 *
 * Returns undefined if the transform string is empty or invalid.
 */
export function parseTransform(
  transformStr: string | null | undefined,
  ctx?: ParseContext,
  elementId?: string
): TransformModel | undefined {
  if (!transformStr || !transformStr.trim()) return undefined

  const str = transformStr.trim()

  try {
    const transforms = parseTransformList(str)
    if (transforms.length === 0) return undefined

    // Single transform: map directly to TransformModel components
    if (transforms.length === 1) {
      return singleTransformToModel(transforms[0])
    }

    // Multiple transforms: compute combined matrix
    const matrix = combineTransforms(transforms)
    return { matrix }
  } catch (e) {
    if (ctx) {
      emitWarn(ctx, DIAG.MALFORMED_TRANSFORM, `Malformed transform: "${str}": ${String(e)}`, {
        elementId,
        attributeName: 'transform',
      })
    }
    // Store as raw matrix (identity) so the element isn't broken
    return undefined
  }
}

// ── Individual transform parsers ──────────────────────────────────────────────

interface ParsedTransform {
  type: 'translate' | 'rotate' | 'scale' | 'skewX' | 'skewY' | 'matrix'
  values: number[]
}

function parseTransformList(str: string): ParsedTransform[] {
  const result: ParsedTransform[] = []
  // Match transform function calls
  const regex = /(\w+)\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(str)) !== null) {
    const type = match[1] as ParsedTransform['type']
    const valStr = match[2].trim()
    const values = valStr
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((v) => {
        const n = parseFloat(v)
        if (isNaN(n)) throw new Error(`Invalid number: "${v}"`)
        return n
      })
    result.push({ type, values })
  }
  return result
}

function singleTransformToModel(t: ParsedTransform): TransformModel {
  switch (t.type) {
    case 'translate':
      return {
        translateX: t.values[0] ?? 0,
        translateY: t.values[1] ?? 0,
      }

    case 'scale':
      return {
        scaleX: t.values[0] ?? 1,
        scaleY: t.values.length > 1 ? t.values[1] : (t.values[0] ?? 1),
      }

    case 'rotate': {
      const angle = t.values[0] ?? 0
      const cx = t.values[1]
      const cy = t.values[2]
      const model: TransformModel = { rotate: angle }
      if (cx != null && cy != null) {
        model.pivotX = cx
        model.pivotY = cy
      }
      return model
    }

    case 'skewX':
      return { skewX: t.values[0] ?? 0 }

    case 'skewY':
      return { skewY: t.values[0] ?? 0 }

    case 'matrix': {
      const [a, b, c, d, e, f] = t.values
      if (t.values.length !== 6) {
        throw new Error('matrix() requires exactly 6 values')
      }
      // Store the raw matrix and also try to decompose simple cases
      const mat: [number, number, number, number, number, number] = [a, b, c, d, e, f]
      const model: TransformModel = { matrix: mat }

      // If it's a pure translation (a=1, b=0, c=0, d=1)
      if (a === 1 && b === 0 && c === 0 && d === 1) {
        model.translateX = e
        model.translateY = f
      }

      return model
    }

    default:
      return {}
  }
}

// ── Matrix math for chained transforms ───────────────────────────────────────

type Mat3x3 = [number, number, number, number, number, number] // [a,b,c,d,e,f] 2D affine

function identityMatrix(): Mat3x3 {
  return [1, 0, 0, 1, 0, 0]
}

function multiplyMatrix(m1: Mat3x3, m2: Mat3x3): Mat3x3 {
  const [a1, b1, c1, d1, e1, f1] = m1
  const [a2, b2, c2, d2, e2, f2] = m2
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ]
}

function transformToMatrix(t: ParsedTransform): Mat3x3 {
  switch (t.type) {
    case 'translate':
      return [1, 0, 0, 1, t.values[0] ?? 0, t.values[1] ?? 0]

    case 'scale': {
      const sx = t.values[0] ?? 1
      const sy = t.values.length > 1 ? (t.values[1] ?? 1) : sx
      return [sx, 0, 0, sy, 0, 0]
    }

    case 'rotate': {
      const angle = ((t.values[0] ?? 0) * Math.PI) / 180
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const cx = t.values[1] ?? 0
      const cy = t.values[2] ?? 0
      if (cx === 0 && cy === 0) {
        return [cos, sin, -sin, cos, 0, 0]
      }
      // rotate(angle, cx, cy) = translate(cx,cy) * rotate(angle) * translate(-cx,-cy)
      return [
        cos,
        sin,
        -sin,
        cos,
        cx - cx * cos + cy * sin,
        cy - cx * sin - cy * cos,
      ]
    }

    case 'skewX': {
      const angle = ((t.values[0] ?? 0) * Math.PI) / 180
      return [1, 0, Math.tan(angle), 1, 0, 0]
    }

    case 'skewY': {
      const angle = ((t.values[0] ?? 0) * Math.PI) / 180
      return [1, Math.tan(angle), 0, 1, 0, 0]
    }

    case 'matrix':
      if (t.values.length !== 6) throw new Error('matrix() requires 6 values')
      return t.values as Mat3x3

    default:
      return identityMatrix()
  }
}

function combineTransforms(transforms: ParsedTransform[]): [number, number, number, number, number, number] {
  let result = identityMatrix()
  for (const t of transforms) {
    result = multiplyMatrix(result, transformToMatrix(t))
  }
  return result
}

// ── gradientTransform / patternTransform passthrough ─────────────────────────

/**
 * Parse a transform attribute from a resource element.
 * Returns the raw string (for round-trip) and also a TransformModel if parseable.
 */
export function parseResourceTransform(
  transformStr: string | null | undefined
): { raw: string; model?: TransformModel } | undefined {
  if (!transformStr) return undefined
  const model = parseTransform(transformStr)
  return { raw: transformStr, model }
}
