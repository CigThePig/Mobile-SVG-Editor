import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { createEmptyDocument } from '@/model/document/documentFactory'
import { cloneDocument } from '@/features/documents/utils/documentMutations'
import { saveDocument } from '@/db/dexie/queries'
import type { SvgDocument } from '@/model/document/documentTypes'
import type { SelectionState } from '@/model/selection/selectionTypes'
import type { ViewState } from '@/model/view/viewTypes'
import type { NodeBounds } from '@/features/selection/utils/nodeBounds'
import { useHistoryStore } from '@/stores/historyStore'

export type EditorMode =
  | 'navigate'
  | 'select'
  | 'shape'
  | 'pen'
  | 'path'
  | 'text'
  | 'paint'
  | 'structure'
  | 'inspect'

export type ShapeDrawType = 'rect' | 'ellipse' | 'line' | 'polygon' | 'star'

export interface EditorUiState {
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  lockAspectRatio: boolean
  multiSelectEnabled: boolean
  marqueeRect: NodeBounds | null
  inspectorSection: 'quick' | 'geometry' | 'appearance' | 'typography' | 'path' | 'arrange' | 'svg' | 'metadata'
  shapeType: ShapeDrawType
  penPathInProgress: { nodeId: string; startDocument: SvgDocument } | null
  penCursorPoint: { x: number; y: number } | null
}

interface EditorStore {
  activeDocument: SvgDocument
  mode: EditorMode
  selection: SelectionState
  view: ViewState
  ui: EditorUiState
  setMode: (mode: EditorMode) => void
  setZoom: (zoom: number) => void
  setPan: (panX: number, panY: number) => void
  setCamera: (zoom: number, panX: number, panY: number) => void
  panBy: (dx: number, dy: number) => void
  setSelection: (ids: string[]) => void
  addToSelection: (id: string) => void
  removeFromSelection: (id: string) => void
  clearSelection: () => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  setLeftPanelOpen: (open: boolean) => void
  setRightPanelOpen: (open: boolean) => void
  toggleAspectRatioLock: () => void
  setAspectRatioLock: (locked: boolean) => void
  toggleMultiSelectEnabled: () => void
  setMultiSelectEnabled: (enabled: boolean) => void
  setMarqueeRect: (rect: NodeBounds | null) => void
  openInspectorSection: (section: EditorUiState['inspectorSection']) => void
  replaceDocument: (doc: SvgDocument) => void
  toggleSnapEnabled: () => void
  setPathEditMode: (nodeId: string | null) => void
  setShapeType: (type: ShapeDrawType) => void
  setPenPathInProgress: (state: EditorUiState['penPathInProgress']) => void
  setPenCursorPoint: (point: { x: number; y: number } | null) => void
  commitPenPath: () => Promise<void>
  discardPenPath: () => void
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids))
}

export const useEditorStore = create<EditorStore>()(
  immer((set, get) => ({
    activeDocument: createEmptyDocument(),
    mode: 'select',
    selection: {
      selectedNodeIds: [],
      selectionMode: 'object'
    },
    view: {
      zoom: 1,
      panX: 0,
      panY: 0,
      showGrid: false,
      showGuides: true,
      snapEnabled: true,
      snapConfig: {
        snapToGrid: true,
        gridSize: 10,
        snapToPoints: true,
        snapToBbox: true,
        angleSnap: true,
        angleSnapDegrees: 15
      },
      outlineMode: false
    },
    ui: {
      leftPanelOpen: false,
      rightPanelOpen: false,
      lockAspectRatio: false,
      multiSelectEnabled: false,
      marqueeRect: null,
      inspectorSection: 'quick',
      shapeType: 'rect',
      penPathInProgress: null,
      penCursorPoint: null
    },
    setMode: (mode) =>
      set((state) => {
        // Auto-discard an in-progress pen path when leaving pen mode
        if (state.mode === 'pen' && mode !== 'pen' && state.ui.penPathInProgress) {
          const penId = state.ui.penPathInProgress.nodeId
          state.activeDocument.root.children = (state.activeDocument.root.children ?? []).filter(
            (c) => c.id !== penId
          )
          state.ui.penPathInProgress = null
          state.selection.selectedNodeIds = []
          state.selection.activeNodeId = undefined
        }
        state.mode = mode
      }),
    setZoom: (zoom) =>
      set((state) => {
        state.view.zoom = zoom
      }),
    setPan: (panX, panY) =>
      set((state) => {
        state.view.panX = panX
        state.view.panY = panY
      }),
    setCamera: (zoom, panX, panY) =>
      set((state) => {
        state.view.zoom = zoom
        state.view.panX = panX
        state.view.panY = panY
      }),
    panBy: (dx, dy) =>
      set((state) => {
        state.view.panX += dx
        state.view.panY += dy
      }),
    setSelection: (ids) =>
      set((state) => {
        const next = uniqueIds(ids)
        state.selection.selectedNodeIds = next
        state.selection.activeNodeId = next[0]
      }),
    addToSelection: (id) =>
      set((state) => {
        const next = uniqueIds([...state.selection.selectedNodeIds, id])
        state.selection.selectedNodeIds = next
        state.selection.activeNodeId = id
      }),
    removeFromSelection: (id) =>
      set((state) => {
        const next = state.selection.selectedNodeIds.filter((item) => item !== id)
        state.selection.selectedNodeIds = next
        state.selection.activeNodeId = next[0]
      }),
    clearSelection: () =>
      set((state) => {
        state.selection.selectedNodeIds = []
        state.selection.activeNodeId = undefined
      }),
    toggleLeftPanel: () =>
      set((state) => {
        const next = !state.ui.leftPanelOpen
        state.ui.leftPanelOpen = next
        if (next) state.ui.rightPanelOpen = false
      }),
    toggleRightPanel: () =>
      set((state) => {
        const next = !state.ui.rightPanelOpen
        state.ui.rightPanelOpen = next
        if (next) state.ui.leftPanelOpen = false
      }),
    setLeftPanelOpen: (open) =>
      set((state) => {
        state.ui.leftPanelOpen = open
        if (open) state.ui.rightPanelOpen = false
      }),
    setRightPanelOpen: (open) =>
      set((state) => {
        state.ui.rightPanelOpen = open
        if (open) state.ui.leftPanelOpen = false
      }),
    toggleAspectRatioLock: () =>
      set((state) => {
        state.ui.lockAspectRatio = !state.ui.lockAspectRatio
      }),
    setAspectRatioLock: (locked) =>
      set((state) => {
        state.ui.lockAspectRatio = locked
      }),
    toggleMultiSelectEnabled: () =>
      set((state) => {
        state.ui.multiSelectEnabled = !state.ui.multiSelectEnabled
      }),
    setMultiSelectEnabled: (enabled) =>
      set((state) => {
        state.ui.multiSelectEnabled = enabled
      }),
    setMarqueeRect: (rect) =>
      set((state) => {
        state.ui.marqueeRect = rect
      }),
    openInspectorSection: (section) =>
      set((state) => {
        state.ui.rightPanelOpen = true
        state.ui.leftPanelOpen = false
        state.ui.inspectorSection = section
      }),
    replaceDocument: (doc) =>
      set((state) => {
        state.activeDocument = doc
      }),
    toggleSnapEnabled: () =>
      set((state) => {
        state.view.snapEnabled = !state.view.snapEnabled
      }),
    setPathEditMode: (nodeId) =>
      set((state) => {
        if (nodeId) {
          state.mode = 'path'
          state.selection.selectedNodeIds = [nodeId]
          state.selection.activeNodeId = nodeId
          state.selection.selectionMode = 'point'
          state.selection.activePathPointIds = []
        } else {
          state.mode = 'select'
          state.selection.selectionMode = 'object'
          state.selection.activePathPointIds = []
        }
      }),
    setShapeType: (type) =>
      set((state) => {
        state.ui.shapeType = type
      }),
    setPenPathInProgress: (penState) =>
      set((state) => {
        state.ui.penPathInProgress = penState
      }),
    setPenCursorPoint: (point) =>
      set((state) => {
        state.ui.penCursorPoint = point
      }),
    commitPenPath: async () => {
      const { ui, activeDocument } = get()
      const pen = ui.penPathInProgress
      if (!pen) return
      const afterDocument = cloneDocument(activeDocument)
      useHistoryStore.getState().pushSnapshot('Draw Path', pen.startDocument, afterDocument)
      await saveDocument(afterDocument)
      set((state) => {
        state.ui.penPathInProgress = null
        state.mode = 'select'
      })
    },
    discardPenPath: () =>
      set((state) => {
        const pen = state.ui.penPathInProgress
        if (!pen) {
          state.mode = 'select'
          return
        }
        state.activeDocument.root.children = (state.activeDocument.root.children ?? []).filter(
          (c) => c.id !== pen.nodeId
        )
        state.ui.penPathInProgress = null
        state.ui.penCursorPoint = null
        state.mode = 'select'
        state.selection.selectedNodeIds = []
        state.selection.activeNodeId = undefined
      })
  }))
)
