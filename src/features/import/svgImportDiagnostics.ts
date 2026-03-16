import { nanoid } from 'nanoid'
import type { ImportDiagnostic } from '@/model/document/documentTypes'
import type { ParseContext } from './svgImportTypes'
import type { DiagCode } from './svgImportTypes'

// ── Diagnostic emission helpers ───────────────────────────────────────────────

/**
 * Emit a diagnostic into the parse context and return its ID.
 * The returned ID should be stored in `node.preservation.importDiagnosticIds`.
 */
export function emitDiag(
  ctx: ParseContext,
  severity: ImportDiagnostic['severity'],
  code: DiagCode,
  message: string,
  opts: {
    elementId?: string
    sourceOffset?: number
    attributeName?: string
  } = {}
): string {
  const id = nanoid(8)
  ctx.diagnostics.push({
    id,
    severity,
    code,
    message,
    elementId: opts.elementId,
    sourceOffset: opts.sourceOffset,
    attributeName: opts.attributeName,
  })
  return id
}

/** Emit an info-level diagnostic. */
export function emitInfo(
  ctx: ParseContext,
  code: DiagCode,
  message: string,
  opts?: { elementId?: string; attributeName?: string }
): string {
  return emitDiag(ctx, 'info', code, message, opts)
}

/** Emit a warning-level diagnostic. */
export function emitWarn(
  ctx: ParseContext,
  code: DiagCode,
  message: string,
  opts?: { elementId?: string; attributeName?: string }
): string {
  return emitDiag(ctx, 'warning', code, message, opts)
}

/** Emit an error-level diagnostic. */
export function emitError(
  ctx: ParseContext,
  code: DiagCode,
  message: string,
  opts?: { elementId?: string; attributeName?: string }
): string {
  return emitDiag(ctx, 'error', code, message, opts)
}

// ── Context creation ──────────────────────────────────────────────────────────

import { createEmptyResources } from '@/model/document/documentFactory'

/** Create a fresh ParseContext for a new import operation. */
export function createParseContext(sourceSvg: string): ParseContext {
  return {
    idRegistry: new Map(),
    resources: createEmptyResources(),
    diagnostics: [],
    namespaces: {},
    cssRulesBySelector: new Map(),
    sourceSvg,
    seenIds: new Set(),
    duplicateIdRepairs: new Map(),
    hasPreservedContent: false,
    hasUnknownElements: false,
    hasStyleBlocks: false,
    hasDisplayOnlyContent: false,
  }
}
