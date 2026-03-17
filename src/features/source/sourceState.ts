/**
 * src/features/source/sourceState.ts
 *
 * Zustand store for the source editor sync state machine.
 *
 * Sync states:
 *   clean          — Visual and source are in sync
 *   visual-pending — A visual edit was applied; source hasn't updated yet (transient)
 *   source-pending — Source editor has unapplied changes; visual edits are blocked
 *   conflict       — Both modes edited simultaneously (source wins, visual discarded)
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type SyncState = 'clean' | 'visual-pending' | 'source-pending' | 'conflict'

interface SourceStore {
  /** Whether the source editor sheet is open */
  isOpen: boolean

  /** Current sync state between source and visual */
  syncState: SyncState

  /**
   * The text currently in the Monaco editor (may differ from document).
   * Null when source is clean (use lastAppliedText in that case).
   */
  pendingSourceText: string | null

  /**
   * The SVG text as of the last apply or visual sync.
   * This is the "ground truth" text that matches the document model.
   */
  lastAppliedText: string | null

  /** Error message from the last failed apply attempt */
  applyError: string | null

  /** Open the source editor sheet */
  openSource: () => void

  /** Close the source editor sheet */
  closeSource: () => void

  /**
   * Called when the user edits the source text in Monaco.
   * Sets syncState to 'source-pending'.
   */
  setSourceText: (text: string) => void

  setSyncState: (s: SyncState) => void
  setLastAppliedText: (text: string) => void
  setApplyError: (err: string | null) => void

  /**
   * Reset pendingSourceText back to lastAppliedText and set state to 'clean'.
   * Used for the Revert action.
   */
  clearPending: () => void
}

export const useSourceStore = create<SourceStore>()(
  immer((set) => ({
    isOpen: false,
    syncState: 'clean',
    pendingSourceText: null,
    lastAppliedText: null,
    applyError: null,

    openSource: () =>
      set((state) => {
        state.isOpen = true
      }),

    closeSource: () =>
      set((state) => {
        state.isOpen = false
        state.pendingSourceText = null
        state.syncState = 'clean'
        state.applyError = null
      }),

    setSourceText: (text) =>
      set((state) => {
        state.pendingSourceText = text
        // Only mark as pending if the text actually differs from the last applied
        if (text !== state.lastAppliedText) {
          state.syncState = 'source-pending'
        } else {
          state.syncState = 'clean'
          state.pendingSourceText = null
        }
      }),

    setSyncState: (s) =>
      set((state) => {
        state.syncState = s
      }),

    setLastAppliedText: (text) =>
      set((state) => {
        state.lastAppliedText = text
      }),

    setApplyError: (err) =>
      set((state) => {
        state.applyError = err
      }),

    clearPending: () =>
      set((state) => {
        state.pendingSourceText = null
        state.syncState = 'clean'
        state.applyError = null
      }),
  }))
)
