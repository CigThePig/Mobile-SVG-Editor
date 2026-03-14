import type { SvgDocument } from '@/model/document/documentTypes'

export interface HistoryEntry {
  id: string
  label: string
  timestamp: string
  beforeDocument: SvgDocument
  afterDocument: SvgDocument
  transactionId?: string
}
