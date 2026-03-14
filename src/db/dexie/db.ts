import Dexie, { type Table } from 'dexie'
import type { SvgDocument } from '@/model/document/documentTypes'

export interface DocumentRecord {
  id: string
  title: string
  updatedAt: string
  data: SvgDocument
}

export interface SnapshotRecord {
  id: string
  documentId: string
  createdAt: string
  label?: string
  data: SvgDocument
}

export interface AssetRecord {
  id: string
  name: string
  kind: 'font' | 'image' | 'template' | 'library'
  createdAt: string
  updatedAt: string
  data: Blob | string
}

export class SvgEditorDexie extends Dexie {
  documents!: Table<DocumentRecord, string>
  snapshots!: Table<SnapshotRecord, string>
  assets!: Table<AssetRecord, string>

  constructor() {
    super('svg-editor-db')

    this.version(1).stores({
      documents: 'id, title, updatedAt',
      snapshots: 'id, documentId, createdAt',
      assets: 'id, kind, updatedAt'
    })
  }
}

export const db = new SvgEditorDexie()
