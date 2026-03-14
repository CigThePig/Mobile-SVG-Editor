import { saveDocument } from '@/db/dexie/queries'
import { cloneDocument } from '@/features/documents/utils/documentMutations'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { getCommand } from './commandRegistry'

export async function runCommand<TPayload>(id: string, payload: TPayload) {
  const command = getCommand(id)
  if (!command) throw new Error(`Unknown command: ${id}`)

  const state = useEditorStore.getState()
  const beforeDocument = cloneDocument(state.activeDocument)
  const result = command.run({ document: beforeDocument }, payload)
  const afterDocument = cloneDocument(result.document)
  const documentChanged = JSON.stringify(beforeDocument) !== JSON.stringify(afterDocument)

  state.replaceDocument(afterDocument)
  if (result.selectionIds) state.setSelection(result.selectionIds)

  if (!documentChanged) return

  useHistoryStore.getState().pushSnapshot(result.label, beforeDocument, afterDocument)
  await saveDocument(afterDocument)
}
