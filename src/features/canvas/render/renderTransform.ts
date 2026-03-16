import type { TransformModel } from '@/model/nodes/nodeTypes'

/**
 * Converts a TransformModel into an SVG transform attribute string.
 *
 * Priority:
 *   1. If `matrix` is set, emit as `matrix(a b c d e f)` and skip decomposed fields.
 *   2. Otherwise build from decomposed fields: translate → pivot-translate → rotate →
 *      scale → skewX/Y → pivot-untranslate.
 */
export function transformToSvgString(transform?: TransformModel): string | undefined {
  if (!transform) return undefined

  // Raw matrix takes priority over all decomposed fields
  if (transform.matrix) {
    const [a, b, c, d, e, f] = transform.matrix
    return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`
  }

  const parts: string[] = []

  if (transform.translateX || transform.translateY) {
    parts.push(`translate(${transform.translateX ?? 0} ${transform.translateY ?? 0})`)
  }

  if (transform.pivotX != null && transform.pivotY != null) {
    parts.push(`translate(${transform.pivotX} ${transform.pivotY})`)
  }

  if (transform.rotate) {
    parts.push(`rotate(${transform.rotate})`)
  }

  if (transform.scaleX != null || transform.scaleY != null) {
    parts.push(`scale(${transform.scaleX ?? 1} ${transform.scaleY ?? 1})`)
  }

  if (transform.skewX) parts.push(`skewX(${transform.skewX})`)
  if (transform.skewY) parts.push(`skewY(${transform.skewY})`)

  if (transform.pivotX != null && transform.pivotY != null) {
    parts.push(`translate(${-transform.pivotX} ${-transform.pivotY})`)
  }

  return parts.length ? parts.join(' ') : undefined
}
