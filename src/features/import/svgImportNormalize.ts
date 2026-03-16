import type { SvgDocument } from '@/model/document/documentTypes'
import type { SvgNode } from '@/model/nodes/nodeTypes'
import type { ParseContext } from './svgImportTypes'

// ── Fidelity tier calculation ─────────────────────────────────────────────────

/**
 * Calculate the fidelity tier for an imported document based on what was found
 * during parsing.
 *
 * Tier 1: all elements are Level 1 (fully editable); no style blocks; no unknown elements
 * Tier 2: has Level 2 elements (partial support) or style blocks but no preserved/raw content
 * Tier 3: has Level 3 or Level 4 content (preserved raw elements, SMIL, foreignObject, etc.)
 */
export function calculateFidelityTier(ctx: ParseContext): 1 | 2 | 3 {
  if (ctx.hasPreservedContent || ctx.hasUnknownElements || ctx.hasDisplayOnlyContent) {
    return 3
  }
  if (
    ctx.hasStyleBlocks ||
    ctx.resources.filters.length > 0 ||
    ctx.resources.patterns.length > 0 ||
    ctx.resources.symbols.length > 0 || // symbol resources (Level 2)
    ctx.hasLevel2Nodes ||               // Level-2 tree nodes (text, use, image, etc.)
    ctx.hasRawAttributes                // any unknown attributes preserved on any node
  ) {
    return 2
  }
  return 1
}

/**
 * Finalize the document after both parse passes:
 * - Set fidelityTier and serializationMode
 * - Set idRegistry from the ParseContext
 * - Set namespaces
 * - Set diagnostics
 */
export function finalizeDocument(doc: SvgDocument, ctx: ParseContext): SvgDocument {
  const fidelityTier = calculateFidelityTier(ctx)

  // Convert idRegistry map to plain object
  const idRegistry: Record<string, string> = {}
  for (const [id, nodeType] of Array.from(ctx.idRegistry.entries())) {
    idRegistry[id] = nodeType
  }

  return {
    ...doc,
    fidelityTier,
    serializationMode: fidelityTier >= 2 ? 'roundtrip' : 'normalized',
    idRegistry: Object.keys(idRegistry).length > 0 ? idRegistry : undefined,
    namespaces: Object.keys(ctx.namespaces).length > 0 ? ctx.namespaces : undefined,
    diagnostics: ctx.diagnostics.length > 0 ? [...ctx.diagnostics] : undefined,
  }
}

// ── Editability breakdown ─────────────────────────────────────────────────────

/**
 * Count nodes by editability level in the document tree.
 * Returns a breakdown of { 1: count, 2: count, 3: count, 4: count }.
 */
export function countEditabilityLevels(doc: SvgDocument): Record<1 | 2 | 3 | 4, number> {
  const counts: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  walkNodes(doc.root, (node) => {
    const level = node.preservation?.editabilityLevel
    if (level != null && level >= 1 && level <= 4) {
      counts[level as 1 | 2 | 3 | 4]++
    }
  })
  return counts
}

function walkNodes(node: SvgNode, visitor: (n: SvgNode) => void): void {
  visitor(node)
  if ('children' in node && node.children) {
    for (const child of node.children) {
      walkNodes(child, visitor)
    }
  }
}
