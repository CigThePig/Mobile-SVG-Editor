import { saveDocument } from '@/db/dexie/queries'
import { cloneDocument } from '@/features/documents/utils/documentMutations'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { getCommand } from './commandRegistry'
import { useSourceStore } from '@/features/source/sourceState'
import { updateSourceFromDocument } from '@/features/source/sourceSync'

export async function runCommand<TPayload>(id: string, payload: TPayload) {
  // ── Source-pending guard (Phase 7) ─────────────────────────────────────────
  // Block visual edits while the source editor has unapplied changes.
  // Per the sync contract: visual edits are not allowed when source is pending.
  const sourceState = useSourceStore.getState()
  if (sourceState.syncState === 'source-pending') {
    throw new Error('Apply or discard your source changes before editing visually.')
  }

  const command = getCommand(id)
  if (!command) throw new Error(`Unknown command: ${id}`)

  const state = useEditorStore.getState()
  const beforeDocument = cloneDocument(state.activeDocument)
  const result = await command.run({ document: beforeDocument }, payload)
  const afterDocument = cloneDocument(result.document)
  const documentChanged = JSON.stringify(beforeDocument) !== JSON.stringify(afterDocument)

  state.replaceDocument(afterDocument)
  if (result.selectionIds) state.setSelection(result.selectionIds)

  if (!documentChanged) return

  useHistoryStore.getState().pushSnapshot(result.label, beforeDocument, afterDocument)
  await saveDocument(afterDocument)

  // ── Visual → Source sync (Phase 7) ─────────────────────────────────────────
  // If the source editor is open and in a clean state, update its text
  // via a minimal diff to reflect the visual change (preserves cursor position).
  const sourceStateAfter = useSourceStore.getState()
  if (sourceStateAfter.isOpen && sourceStateAfter.syncState !== 'source-pending') {
    const newSourceText = updateSourceFromDocument(afterDocument, sourceStateAfter.lastAppliedText)
    useSourceStore.setState((s) => {
      s.lastAppliedText = newSourceText
      s.syncState = 'clean'
    })
  }
}
