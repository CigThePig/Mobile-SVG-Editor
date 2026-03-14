export interface SelectionState {
  selectedNodeIds: string[]
  activeNodeId?: string
  activePathPointIds?: string[]
  anchorNodeId?: string
  isolationRootId?: string
  selectionMode: 'object' | 'point' | 'text' | 'resource'
}
