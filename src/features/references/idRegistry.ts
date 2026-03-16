import { nanoid } from 'nanoid'
import type { SvgDocument } from '@/model/document/documentTypes'
import type { SvgNodeType } from '@/model/nodes/nodeTypes'
import { traverseNodes } from '@/model/utils/nodeTraversal'

// ── ID registry entry ─────────────────────────────────────────────────────────

/**
 * A richer descriptor for a single id in the document.
 * Unlike the legacy `doc.idRegistry: Record<string, string>` which maps id → nodeType string,
 * this entry distinguishes node ids from resource ids and carries structured type info.
 */
export interface IdRegistryEntry {
  id: string
  /** Whether this id belongs to the node tree or the resource store */
  kind: 'node' | 'resource'
  /** Set when kind='node' */
  nodeType?: SvgNodeType
  /** Set when kind='resource' — matches the ResourceStore array key (e.g. 'gradient', 'filter') */
  resourceType?: string
}

/** Full id registry: id → entry */
export type IdRegistry = Map<string, IdRegistryEntry>

// ── Build registry ────────────────────────────────────────────────────────────

/**
 * Build a complete IdRegistry from a document by scanning:
 *   1. Every node in doc.root (depth-first)
 *   2. Every resource in doc.resources
 *
 * If a node has no id (shouldn't happen in valid docs), it is skipped.
 * Duplicate ids are last-write-wins (the import engine should have repaired them).
 */
export function buildIdRegistry(doc: SvgDocument): IdRegistry {
  const registry: IdRegistry = new Map()

  // 1. Walk the node tree
  traverseNodes(doc.root, (node) => {
    if (node.id) {
      registry.set(node.id, { id: node.id, kind: 'node', nodeType: node.type })
    }
  })

  // 2. Walk the resource store
  const resources = doc.resources

  for (const g of resources.gradients) {
    registry.set(g.id, { id: g.id, kind: 'resource', resourceType: g.type })
  }
  for (const p of resources.patterns) {
    registry.set(p.id, { id: p.id, kind: 'resource', resourceType: 'pattern' })
  }
  for (const f of resources.filters) {
    registry.set(f.id, { id: f.id, kind: 'resource', resourceType: 'filter' })
  }
  for (const m of resources.markers) {
    registry.set(m.id, { id: m.id, kind: 'resource', resourceType: 'marker' })
  }
  for (const s of resources.symbols) {
    registry.set(s.id, { id: s.id, kind: 'resource', resourceType: 'symbol' })
  }
  for (const sb of resources.styleBlocks) {
    registry.set(sb.id, { id: sb.id, kind: 'resource', resourceType: 'styleBlock' })
  }
  for (const sw of resources.swatches) {
    registry.set(sw.id, { id: sw.id, kind: 'resource', resourceType: 'swatch' })
  }
  for (const c of resources.components) {
    registry.set(c.id, { id: c.id, kind: 'resource', resourceType: 'component' })
  }
  for (const ts of resources.textStyles) {
    registry.set(ts.id, { id: ts.id, kind: 'resource', resourceType: 'textStyle' })
  }
  for (const es of resources.exportSlices) {
    registry.set(es.id, { id: es.id, kind: 'resource', resourceType: 'exportSlice' })
  }

  return registry
}

// ── Legacy registry rebuild ───────────────────────────────────────────────────

/**
 * Rebuild the legacy `doc.idRegistry: Record<string, string>` format
 * (id → node/resource type string) from a document.
 *
 * This is used to keep `doc.idRegistry` in sync after id-mutating operations
 * such as rename. The value format matches what the import engine produces:
 * node types use the SvgNodeType string; resource types use the resource's `type` field.
 */
export function rebuildDocIdRegistry(doc: SvgDocument): Record<string, string> {
  const registry = buildIdRegistry(doc)
  const result: Record<string, string> = {}
  for (const [id, entry] of registry) {
    result[id] = entry.nodeType ?? entry.resourceType ?? 'unknown'
  }
  return result
}

// ── ID generation ─────────────────────────────────────────────────────────────

/**
 * Generate a unique id that does not already exist in the given registry.
 * Tries `prefix-<nanoid>` first; if somehow there's a collision, appends a counter.
 *
 * @param registry The current id registry to check against
 * @param prefix   Optional prefix for readability (default: 'el')
 */
export function generateUniqueId(registry: IdRegistry | Map<string, unknown>, prefix = 'el'): string {
  let id = `${prefix}-${nanoid(8)}`
  let attempts = 0
  while (registry.has(id)) {
    id = `${prefix}-${nanoid(8)}-${++attempts}`
  }
  return id
}
