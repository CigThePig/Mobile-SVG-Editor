/**
 * svgSerializeTransforms.ts
 *
 * Converts the internal TransformModel to an SVG `transform` attribute string.
 *
 * The transform is emitted in the correct order:
 *   translate(tx, ty) translate(px, py) rotate(a) scale(sx, sy) skewX(x) skewY(y) translate(-px, -py)
 *
 * If a raw matrix is stored (e.g. from an imported affine transform that couldn't
 * be fully decomposed), it is emitted as matrix(a b c d e f) instead.
 */

import type { TransformModel } from '@/model/nodes/nodeTypes'

/**
 * Convert a TransformModel to an SVG `transform` attribute value string.
 * Returns an empty string if the transform is null/undefined or is effectively the identity.
 */
export function transformToSvgString(transform?: TransformModel): string {
  if (!transform) return ''

  // If a raw matrix is present and no decomposed values were set, emit as matrix()
  if (
    transform.matrix &&
    transform.translateX == null &&
    transform.translateY == null &&
    transform.rotate == null &&
    transform.scaleX == null &&
    transform.scaleY == null &&
    transform.skewX == null &&
    transform.skewY == null
  ) {
    const [a, b, c, d, e, f] = transform.matrix
    return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`
  }

  const parts: string[] = []

  // Main translation
  if (transform.translateX || transform.translateY) {
    parts.push(`translate(${transform.translateX ?? 0} ${transform.translateY ?? 0})`)
  }

  // Pivot pre-translate (before rotate/scale so they happen around the pivot point)
  if (transform.pivotX != null && transform.pivotY != null) {
    parts.push(`translate(${transform.pivotX} ${transform.pivotY})`)
  }

  if (transform.rotate) {
    parts.push(`rotate(${transform.rotate})`)
  }

  if (transform.scaleX != null || transform.scaleY != null) {
    const sx = transform.scaleX ?? 1
    const sy = transform.scaleY ?? 1
    // Only emit if non-identity
    if (sx !== 1 || sy !== 1) {
      parts.push(`scale(${sx} ${sy})`)
    }
  }

  if (transform.skewX) parts.push(`skewX(${transform.skewX})`)
  if (transform.skewY) parts.push(`skewY(${transform.skewY})`)

  // Pivot post-translate (undo the pre-translate)
  if (transform.pivotX != null && transform.pivotY != null) {
    parts.push(`translate(${-transform.pivotX} ${-transform.pivotY})`)
  }

  return parts.join(' ')
}

/**
 * Serialize a TransformModel to a `transform="..."` attribute string.
 * Returns an empty string if there is no meaningful transform.
 */
export function transformAttr(transform?: TransformModel): string {
  const value = transformToSvgString(transform)
  return value ? `transform="${value}"` : ''
}

/**
 * Number formatter for transform values.
 * Trims trailing zeros to keep output clean.
 */
export function fmtNum(n: number): string {
  // Use up to 6 decimal places but strip trailing zeros
  const s = n.toFixed(6).replace(/\.?0+$/, '')
  return s === '-0' ? '0' : s
}
