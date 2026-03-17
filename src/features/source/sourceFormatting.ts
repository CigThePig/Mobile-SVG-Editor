/**
 * src/features/source/sourceFormatting.ts
 *
 * SVG/XML source formatting using prettier + prettier-plugin-xml.
 * Falls back to xml-formatter if prettier fails.
 *
 * Uses async prettier.format (v3 API) which is appropriate for the
 * source editor context (not the hot serialization path).
 */

/**
 * Format an SVG/XML string using prettier with the XML plugin.
 *
 * Returns the formatted string. If formatting fails for any reason
 * (parse error, plugin unavailable, etc.) the original text is returned unchanged.
 */
export async function formatSvgSource(text: string): Promise<string> {
  // Try prettier + prettier-plugin-xml first (async format API)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const prettier = require('prettier') as typeof import('prettier')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const xmlPlugin = require('prettier-plugin-xml') as { default: unknown }

    const formatted = await prettier.format(text, {
      parser: 'xml',
      plugins: [xmlPlugin.default ?? xmlPlugin],
      printWidth: 100,
      tabWidth: 2,
      xmlWhitespaceSensitivity: 'ignore' as never,
    })

    return formatted
  } catch {
    // Fall back to xml-formatter (sync)
    return formatWithXmlFormatter(text)
  }
}

function formatWithXmlFormatter(text: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fmt = require('xml-formatter') as { default: (s: string, opts: object) => string } | ((s: string, opts: object) => string)
    const fn = typeof fmt === 'function' ? fmt : (fmt as { default: (s: string, opts: object) => string }).default
    return fn(text, { indentation: '  ', collapseContent: true, lineSeparator: '\n' })
  } catch {
    return text
  }
}
