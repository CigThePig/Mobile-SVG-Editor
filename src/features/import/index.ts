// ── Public API for the SVG import engine ────────────────────────────────────

// Main parse entry points
export { parseSvgString, parseSvgFile } from './svgParseDocument'

// Command integration (history + persistence)
export { importSvgString, importSvgFile, importSvgFromClipboard } from './svgImportCommands'

// Types
export type { SvgImportResult, ParseContext } from './svgImportTypes'
export { DIAG } from './svgImportTypes'

// Lower-level utilities (for testing and advanced use)
export { parseTransform } from './svgParseTransforms'
export { parseInlineStyle, parseStyleBlock, resolveElementStyle } from './svgParseStyles'
export { parseSvgRootMetadata, parseViewBox } from './svgParseMetadata'
