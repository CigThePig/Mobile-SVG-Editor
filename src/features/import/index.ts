// ── Public API for the SVG import engine ────────────────────────────────────

// Main parse entry points
export { parseSvgString, parseSvgFile } from './svgParseDocument'

// Command integration (history + persistence)
export { importSvgString, importSvgFile, importSvgFromClipboard, commitImportResult } from './svgImportCommands'

// Types
export type { SvgImportResult, ParseContext } from './svgImportTypes'
export type { ImportDiagnostic } from '@/model/document/documentTypes'
export { DIAG } from './svgImportTypes'

// Lower-level utilities (for testing and advanced use)
export { parseTransform } from './svgParseTransforms'
export { parseInlineStyle, parseStyleBlock, resolveElementStyle } from './svgParseStyles'
export { parseSvgRootMetadata, parseViewBox } from './svgParseMetadata'

// Phase 6 UI components
export { ImportPreview } from './components/ImportPreview'
export { ImportDiagnosticsPanel } from './components/ImportDiagnosticsPanel'
export { ImportSummaryCard } from './components/ImportSummaryCard'
export { ImportSvgSheet } from './components/ImportSvgSheet'
