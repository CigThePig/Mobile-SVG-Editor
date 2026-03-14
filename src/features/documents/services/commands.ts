import type { SvgDocument } from '@/model/document/documentTypes'

export interface CommandContext {
  document: SvgDocument
}

export interface CommandResult {
  document: SvgDocument
  label: string
  selectionIds?: string[]
}

export interface EditorCommand<TPayload = unknown> {
  id: string
  label: string
  run: (ctx: CommandContext, payload: TPayload) => CommandResult
}
