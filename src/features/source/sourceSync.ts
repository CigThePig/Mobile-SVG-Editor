/**
 * src/features/source/sourceSync.ts
 *
 * Bidirectional sync logic between the document model and the source editor text.
 *
 * - updateSourceFromDocument: serialize doc → source text with minimal diff
 * - applySourceToDocument: parse source text → new document
 */

import type { SvgDocument } from '@/model/document/documentTypes'
import { serializeSvgDocument } from '@/features/export/index'
import { parseSvgString } from '@/features/import/svgParseDocument'
import type { SvgImportResult } from '@/features/import/svgImportTypes'

// ── Visual → Source ───────────────────────────────────────────────────────────

/**
 * Compute updated source text after a visual edit.
 *
 * Serializes the new document state and attempts a minimal diff-based patch
 * against the current source text to preserve cursor position and formatting.
 *
 * If diff-match-patch is unavailable or the patch fails, falls back to
 * returning the freshly serialized text directly.
 *
 * @param doc The updated document model
 * @param currentText The current text in the source editor (null = no prior text)
 * @returns The new source text to display in the editor
 */
export function updateSourceFromDocument(doc: SvgDocument, currentText: string | null): string {
  const newText = serializeSvgDocument(doc)

  // If there is no current text, just return the fresh serialization
  if (currentText === null) {
    return newText
  }

  // If texts are identical, no update needed
  if (currentText === newText) {
    return currentText
  }

  // Attempt minimal diff via diff-match-patch for cursor preservation
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const DiffMatchPatch = require('diff-match-patch') as
      | { default: new () => DmpInstance }
      | (new () => DmpInstance)

    interface DmpInstance {
      diff_main: (a: string, b: string) => Array<[number, string]>
      patch_make: (a: string, diffs: Array<[number, string]>) => DmpPatch[]
      patch_apply: (patches: DmpPatch[], text: string) => [string, boolean[]]
    }
    interface DmpPatch {
      diffs: Array<[number, string]>
    }

    const DmpClass = 'default' in DiffMatchPatch ? DiffMatchPatch.default : DiffMatchPatch
    const dmp = new DmpClass()

    // Compute diff from currentText → newText and apply as a patch
    const diffs = dmp.diff_main(currentText, newText)
    const patches = dmp.patch_make(currentText, diffs)
    const [patched] = dmp.patch_apply(patches, currentText)

    return patched
  } catch {
    // diff-match-patch unavailable or failed — return fresh serialization
    return newText
  }
}

// ── Source → Visual ───────────────────────────────────────────────────────────

/**
 * Parse the source editor text and produce a new document.
 *
 * Uses the same Phase 2 import pipeline as a fresh import.
 * Preserves the document's title and ID from the current document.
 *
 * @param svgText The raw SVG text from the source editor
 * @param currentDoc The current document (for title/id preservation)
 * @returns The parsed import result (doc + diagnostics)
 * @throws If the SVG text cannot be parsed at all
 */
export function applySourceToDocument(
  svgText: string,
  currentDoc: SvgDocument
): { doc: SvgDocument; importResult: SvgImportResult } {
  const result = parseSvgString(svgText, currentDoc.title)

  // Preserve document identity so it replaces the same record in the DB
  result.doc.id = currentDoc.id
  result.doc.title = currentDoc.title

  return { doc: result.doc, importResult: result }
}
