import { saveDocument } from '@/db/dexie/queries'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { parseSvgString, parseSvgFile } from './svgParseDocument'
import type { SvgImportResult } from './svgImportTypes'

// ── Import command ────────────────────────────────────────────────────────────

/**
 * Import an SVG string as a new document.
 *
 * Flow:
 * 1. Parse SVG string → SvgDocument
 * 2. Push undo snapshot (import is undoable)
 * 3. Replace the active document in the editor store
 * 4. Persist to database
 *
 * Returns the import result so the caller can show a summary UI.
 */
export async function importSvgString(svgString: string, title?: string): Promise<SvgImportResult> {
  const result = parseSvgString(svgString, title)

  const editorStore = useEditorStore.getState()
  const historyStore = useHistoryStore.getState()

  // Push the current document as "before" state for undo
  const beforeDoc = editorStore.activeDocument

  // Replace the active document
  editorStore.replaceDocument(result.doc)

  // Push undo snapshot
  historyStore.pushSnapshot('Import SVG', beforeDoc, result.doc)

  // Persist
  await saveDocument(result.doc)

  return result
}

/**
 * Import an SVG File object as a new document.
 * Convenience wrapper around importSvgString.
 */
export async function importSvgFile(file: File): Promise<SvgImportResult> {
  const text = await file.text()
  return importSvgString(text, file.name.replace(/\.svg$/i, ''))
}

/**
 * Import SVG from the system clipboard.
 * Reads text content from the clipboard and treats it as an SVG string.
 */
export async function importSvgFromClipboard(): Promise<SvgImportResult | null> {
  try {
    const text = await navigator.clipboard.readText()
    if (!text.trim().toLowerCase().includes('<svg')) {
      return null
    }
    return importSvgString(text, 'Clipboard SVG')
  } catch {
    // Clipboard access denied or not available
    return null
  }
}
