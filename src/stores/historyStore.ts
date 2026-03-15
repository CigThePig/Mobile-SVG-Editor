import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { SvgDocument } from '@/model/document/documentTypes'
import type { HistoryEntry } from '@/model/history/historyTypes'

const MAX_HISTORY_SIZE = 50

interface HistoryStore {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  pushSnapshot: (label: string, beforeDocument: SvgDocument, afterDocument: SvgDocument, transactionId?: string) => void
  undo: () => SvgDocument | undefined
  redo: () => SvgDocument | undefined
  canUndo: () => boolean
  canRedo: () => boolean
  clear: () => void
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  undoStack: [],
  redoStack: [],
  pushSnapshot: (label, beforeDocument, afterDocument, transactionId) =>
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          id: nanoid(),
          label,
          timestamp: new Date().toISOString(),
          beforeDocument,
          afterDocument,
          transactionId
        }
      ].slice(-MAX_HISTORY_SIZE),
      redoStack: []
    })),
  undo: () => {
    const state = get()
    const entry = state.undoStack[state.undoStack.length - 1]
    if (!entry) return undefined

    set({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry]
    })

    return entry.beforeDocument
  },
  redo: () => {
    const state = get()
    const entry = state.redoStack[state.redoStack.length - 1]
    if (!entry) return undefined

    set({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, entry]
    })

    return entry.afterDocument
  },
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
  clear: () => set({ undoStack: [], redoStack: [] })
}))
