import { createEmptyDocument } from '@/model/document/documentFactory'
import type { SvgDocument } from '@/model/document/documentTypes'
import { db } from './db'

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
