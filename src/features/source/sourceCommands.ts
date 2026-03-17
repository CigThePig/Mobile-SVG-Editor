/**
 * src/features/source/sourceCommands.ts
 *
 * Command handlers for source editor operations.
 * These are direct async functions (not registered in the command registry)
 * because they bypass the visual-edit guard — they ARE the source side.
 */

import { saveDocument } from '@/db/dexie/queries'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useSourceStore } from './sourceState'
import { applySourceToDocument } from './sourceSync'
import { formatSvgSource } from './sourceFormatting'
import { serializeSvgDocument } from '@/features/export/index'

// ── Apply ─────────────────────────────────────────────────────────────────────

/**
 * Parse the source editor text and apply it as the new document.
 *
 * Flow:
 * 1. Parse via Phase 2 import pipeline
 * 2. Preserve document identity (id, title)
 * 3. Push undo snapshot ("Edit Source")
 * 4. Replace document in editor store
 * 5. Persist to DB
 * 6. Update source store state to clean
 *
 * @throws If the SVG text is not parseable
 */
export async function applySourceCommand(svgText: string): Promise<void> {
  const editorStore = useEditorStore.getState()
  const historyStore = useHistoryStore.getState()
  const sourceStore = useSourceStore.getState()

  const beforeDoc = editorStore.activeDocument

  try {
    const { doc } = applySourceToDocument(svgText, beforeDoc)

    // Update editor state
    editorStore.replaceDocument(doc)
    editorStore.clearSelection()

    // Push undo entry
    historyStore.pushSnapshot('Edit Source', beforeDoc, doc)

    // Persist
    await saveDocument(doc)

    // Mark source as clean — the applied text is now canonical
    sourceStore.setLastAppliedText(svgText)
    sourceStore.clearPending()
    sourceStore.setApplyError(null)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    sourceStore.setApplyError(`Apply failed: ${msg}`)
    throw e
  }
}

// ── Revert ────────────────────────────────────────────────────────────────────

/**
 * Revert the source editor to the last applied state.
 *
 * If lastAppliedText is set, reverts to that. Otherwise serializes
 * the current document as the revert target.
 */
export function revertSourceCommand(): void {
  const editorStore = useEditorStore.getState()
  const sourceStore = useSourceStore.getState()

  const revertText =
    sourceStore.lastAppliedText ?? serializeSvgDocument(editorStore.activeDocument)

  useSourceStore.setState((state) => {
    state.lastAppliedText = revertText
    state.pendingSourceText = null
    state.syncState = 'clean'
    state.applyError = null
  })
}

// ── Format ────────────────────────────────────────────────────────────────────

/**
 * Format the given source text and return the formatted string.
 * Does NOT apply the result to the document.
 */
export async function formatSourceCommand(text: string): Promise<string> {
  return formatSvgSource(text)
}

// ── Format + Apply ────────────────────────────────────────────────────────────

/**
 * Format the source text and immediately apply it to the document.
 * Convenience combination of formatSourceCommand + applySourceCommand.
 */
export async function formatAndApplySourceCommand(text: string): Promise<void> {
  const formatted = await formatSvgSource(text)
  await applySourceCommand(formatted)
}
