import type { SvgNode, SvgNodeType } from '@/model/nodes/nodeTypes'

// ── Core traversal ────────────────────────────────────────────────────────────

/**
 * Depth-first pre-order traversal of the node tree.
 * The visitor function can return `false` to stop traversal early.
 *
 * @param root   The node to start traversal from (included in traversal)
 * @param visitor Called for each node; return false to stop early
 * @returns true if traversal completed, false if it was stopped early
 */
export function traverseNodes(
  root: SvgNode,
  visitor: (node: SvgNode, parent: SvgNode | undefined, depth: number) => boolean | void
): boolean {
  function visit(node: SvgNode, parent: SvgNode | undefined, depth: number): boolean {
    const result = visitor(node, parent, depth)
    if (result === false) return false
    for (const child of node.children ?? []) {
      if (!visit(child, node, depth + 1)) return false
    }
    return true
  }
  return visit(root, undefined, 0)
}

// ── Find utilities ────────────────────────────────────────────────────────────

/**
 * Find a node by its `id` within the tree rooted at `root`.
 * Returns undefined if not found.
 */
export function findNodeById(root: SvgNode, id: string): SvgNode | undefined {
  let found: SvgNode | undefined
  traverseNodes(root, (node) => {
    if (node.id === id) {
      found = node
      return false
    }
  })
  return found
}

/**
 * Find the parent node of the node with the given `childId`.
 * Returns undefined if the child is not found or is the root itself.
 */
export function findParentNode(root: SvgNode, childId: string): SvgNode | undefined {
  let parent: SvgNode | undefined
  traverseNodes(root, (node, nodeParent) => {
    if (node.id === childId) {
      parent = nodeParent
      return false
    }
  })
  return parent
}

/**
 * Find the first node satisfying the predicate in depth-first order.
 */
export function findNode(root: SvgNode, predicate: (node: SvgNode) => boolean): SvgNode | undefined {
  let found: SvgNode | undefined
  traverseNodes(root, (node) => {
    if (predicate(node)) {
      found = node
      return false
    }
  })
  return found
}

// ── Collection utilities ──────────────────────────────────────────────────────

/**
 * Collect IDs of all nodes in the tree (including root).
 */
export function collectAllNodeIds(root: SvgNode): Set<string> {
  const ids = new Set<string>()
  traverseNodes(root, (node) => { ids.add(node.id) })
  return ids
}

/**
 * Collect all nodes of a given type in the tree (depth-first order).
 */
export function collectNodesByType<T extends SvgNode>(
  root: SvgNode,
  type: SvgNodeType
): T[] {
  const results: T[] = []
  traverseNodes(root, (node) => {
    if (node.type === type) results.push(node as T)
  })
  return results
}

/**
 * Collect all nodes satisfying the predicate (depth-first order).
 */
export function collectNodes(root: SvgNode, predicate: (node: SvgNode) => boolean): SvgNode[] {
  const results: SvgNode[] = []
  traverseNodes(root, (node) => {
    if (predicate(node)) results.push(node)
  })
  return results
}

// ── Immutable tree mapping ────────────────────────────────────────────────────

/**
 * Returns a new tree where every node has been passed through `mapper`.
 * Children are mapped recursively before the parent is mapped.
 * The mapper receives the node with already-mapped children.
 *
 * @param root   Root of the tree to map
 * @param mapper Transform function; must return a new node or the original
 */
export function mapNodeTree(root: SvgNode, mapper: (node: SvgNode) => SvgNode): SvgNode {
  // Map children first (bottom-up), then map the parent
  const mappedChildren = (root.children ?? []).map((child) => mapNodeTree(child, mapper))
  const nodeWithChildren: SvgNode =
    mappedChildren.length > 0 || root.children !== undefined
      ? { ...root, children: mappedChildren }
      : root
  return mapper(nodeWithChildren)
}

/**
 * Returns a new tree where only nodes matching `targetIds` are replaced
 * by the result of `mapper`. Non-matching nodes pass through unchanged.
 */
export function mapMatchingNodes(
  root: SvgNode,
  targetIds: Set<string>,
  mapper: (node: SvgNode) => SvgNode
): SvgNode {
  return mapNodeTree(root, (node) => (targetIds.has(node.id) ? mapper(node) : node))
}

// ── Ancestry utilities ────────────────────────────────────────────────────────

/**
 * Returns the array of ancestor nodes from root down to (but not including)
 * the node with the given id. Returns undefined if node not found.
 */
export function getAncestors(root: SvgNode, nodeId: string): SvgNode[] | undefined {
  function search(node: SvgNode, path: SvgNode[]): SvgNode[] | undefined {
    if (node.id === nodeId) return path
    for (const child of node.children ?? []) {
      const result = search(child, [...path, node])
      if (result) return result
    }
    return undefined
  }
  return search(root, [])
}

/**
 * Returns true if `ancestorId` is an ancestor of `nodeId` in the tree.
 */
export function isAncestor(root: SvgNode, ancestorId: string, nodeId: string): boolean {
  const ancestors = getAncestors(root, nodeId)
  return ancestors?.some((a) => a.id === ancestorId) ?? false
}
