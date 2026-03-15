import { createEmptyDocument } from '@/model/document/documentFactory'
import type { SvgDocument } from '@/model/document/documentTypes'
import { db } from './db'
import type { SnapshotRecord } from './db'

export type { SnapshotRecord }

export async function saveDocument(doc: SvgDocument) {
  const nextDoc: SvgDocument = {
    ...doc,
    updatedAt: new Date().toISOString()
  }

  await db.documents.put({
    id: nextDoc.id,
    title: nextDoc.title,
    updatedAt: nextDoc.updatedAt,
    data: nextDoc
  })

  return nextDoc
}

export async function getDocument(id: string) {
  return db.documents.get(id)
}

export async function listRecentDocuments(limit = 20) {
  return db.documents.orderBy('updatedAt').reverse().limit(limit).toArray()
}

export async function getMostRecentDocument() {
  return db.documents.orderBy('updatedAt').reverse().first()
}

export async function createAndSaveDocument(title?: string) {
  const doc = createEmptyDocument(title)
  return saveDocument(doc)
}

export async function deleteDocument(id: string) {
  await db.documents.delete(id)
  await db.snapshots.where('documentId').equals(id).delete()
}

export async function saveSnapshot(documentId: string, data: SvgDocument, label?: string) {
  const { nanoid } = await import('nanoid')
  const record = {
    id: nanoid(),
    documentId,
    createdAt: new Date().toISOString(),
    label,
    data
  }
  await db.snapshots.put(record)
  return record
}

export async function listSnapshots(documentId: string) {
  return db.snapshots.where('documentId').equals(documentId).reverse().sortBy('createdAt')
}

export async function deleteSnapshot(id: string) {
  await db.snapshots.delete(id)
}
