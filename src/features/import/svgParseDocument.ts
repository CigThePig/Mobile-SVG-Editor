import { nanoid } from 'nanoid'
import type { SvgDocument } from '@/model/document/documentTypes'
import { createEmptyDocument } from '@/model/document/documentFactory'
import { collectResources } from './svgParseResources'
import { parseSvgRootMetadata, collectAllIds } from './svgParseMetadata'
import { buildRootNode } from './svgParseNodes'
import { scanReferences, repairDuplicateIds } from './svgParseReferences'
import { finalizeDocument } from './svgImportNormalize'
import { createParseContext } from './svgImportDiagnostics'
import { DIAG } from './svgImportTypes'
import { emitError } from './svgImportDiagnostics'
import type { SvgImportResult } from './svgImportTypes'

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Parse a raw SVG string into a complete SvgDocument.
 *
 * The parse is two-pass:
 * 1. Collect all IDs, resources (gradients, filters, patterns, markers, symbols),
 *    and CSS rules from <style> blocks.
 * 2. Walk the element tree and convert each element to an SvgNode, using the
 *    collected context for style resolution and reference building.
 *
 * Returns an SvgImportResult containing the document and import metadata.
 * Throws if the SVG string is not parseable as XML.
 */
export function parseSvgString(svgString: string, title?: string): SvgImportResult {
  const ctx = createParseContext(svgString)

  // ── XML Parsing ─────────────────────────────────────────────────────────────
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(svgString, 'image/svg+xml')

  // Check for parse errors
  const parseError = xmlDoc.querySelector('parsererror')
  if (parseError) {
    const errorText = parseError.textContent ?? 'Unknown XML parse error'
    emitError(ctx, DIAG.PARSE_ERROR, `SVG XML parse error: ${errorText}`)
    // Return a minimal document with the error diagnostic
    const errorDoc = buildErrorDocument(title ?? 'Import Error', ctx.diagnostics)
    return buildImportResult(errorDoc, ctx)
  }

  const svgElement = xmlDoc.documentElement
  if (svgElement.tagName.toLowerCase() !== 'svg') {
    emitError(ctx, DIAG.INVALID_SVG_ROOT, `Root element is <${svgElement.tagName}>, expected <svg>`)
    const errorDoc = buildErrorDocument(title ?? 'Import Error', ctx.diagnostics)
    return buildImportResult(errorDoc, ctx)
  }

  // ── Pass 0: Collect all IDs ─────────────────────────────────────────────────
  // Must happen before pass 1 so resources can reference existing IDs
  collectAllIds(svgElement, ctx)

  // ── Pass 0b: Repair duplicate IDs ───────────────────────────────────────────
  // Repair duplicates before passes 1 and 2 so references are consistent
  repairDuplicateIds(svgElement, ctx)

  // Rebuild id registry after repairs
  ctx.idRegistry.clear()
  ctx.seenIds.clear()
  collectAllIds(svgElement, ctx)

  // ── Pass 1: Collect resources and style rules ────────────────────────────────
  collectResources(svgElement, ctx)

  // ── Parse root SVG metadata ──────────────────────────────────────────────────
  const metadata = parseSvgRootMetadata(svgElement, ctx)

  // ── Pass 2: Build node tree ──────────────────────────────────────────────────
  const rootNode = buildRootNode(svgElement, ctx)

  // ── Pass 3: Scan references and validate ────────────────────────────────────
  scanReferences(svgElement, ctx)

  // ── Build document ───────────────────────────────────────────────────────────
  const baseDoc = createEmptyDocument()
  const importedDoc: SvgDocument = {
    ...baseDoc,
    id: nanoid(),
    title: title ?? extractDocTitle(svgElement) ?? 'Imported SVG',
    width: metadata.width,
    height: metadata.height,
    viewBox: metadata.viewBox,
    root: rootNode,
    resources: ctx.resources,
  }

  // Finalize: set fidelityTier, serializationMode, idRegistry, namespaces, diagnostics
  const finalDoc = finalizeDocument(importedDoc, ctx)

  // Preserve original source for round-trip diff support (Phase 3)
  finalDoc.sourceSvg = svgString

  return buildImportResult(finalDoc, ctx)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildImportResult(
  doc: SvgDocument,
  ctx: ReturnType<typeof createParseContext>
): SvgImportResult {
  const diagnosticCount = ctx.diagnostics.length
  const warningCount = ctx.diagnostics.filter((d) => d.severity === 'warning').length
  const errorCount = ctx.diagnostics.filter((d) => d.severity === 'error').length
  const fidelityTier = doc.fidelityTier ?? 1

  // Count editability levels from preservation metadata
  const editabilityBreakdown: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  countNodeEditabilityLevels(doc.root, editabilityBreakdown)

  return {
    doc,
    diagnosticCount,
    warningCount,
    errorCount,
    fidelityTier,
    editabilityBreakdown,
  }
}

function countNodeEditabilityLevels(
  node: import('@/model/nodes/nodeTypes').SvgNode,
  counts: Record<1 | 2 | 3 | 4, number>
): void {
  const level = node.preservation?.editabilityLevel
  if (level != null && level >= 1 && level <= 4) {
    counts[level as 1 | 2 | 3 | 4]++
  }
  if ('children' in node && node.children) {
    for (const child of node.children) {
      countNodeEditabilityLevels(child, counts)
    }
  }
}

function buildErrorDocument(
  title: string,
  diagnostics: SvgDocument['diagnostics']
): SvgDocument {
  const doc = createEmptyDocument()
  return {
    ...doc,
    id: nanoid(),
    title,
    diagnostics,
    fidelityTier: 3,
    serializationMode: 'roundtrip',
  }
}

function extractDocTitle(svgElement: Element): string | null {
  // Check for <title> element
  const titleEl = svgElement.querySelector(':scope > title')
  if (titleEl?.textContent?.trim()) {
    return titleEl.textContent.trim()
  }
  // Check for inkscape:label or dc:title
  const label = svgElement.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label')
  if (label) return label
  return null
}

// ── File-based import ─────────────────────────────────────────────────────────

/**
 * Parse an SVG File object into a document.
 * Convenience wrapper around parseSvgString.
 */
export async function parseSvgFile(file: File): Promise<SvgImportResult> {
  const text = await file.text()
  return parseSvgString(text, file.name.replace(/\.svg$/i, ''))
}
