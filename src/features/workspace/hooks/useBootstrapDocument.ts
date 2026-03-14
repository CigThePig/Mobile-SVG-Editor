import { useEffect, useState } from 'react'
import { createAndSaveDocument, getMostRecentDocument } from '@/db/dexie/queries'
import { useEditorStore } from '@/stores/editorStore'

export function useBootstrapDocument() {
  const replaceDocument = useEditorStore((s) => s.replaceDocument)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const recent = await getMostRecentDocument()
        const doc = recent?.data ?? (await createAndSaveDocument('Untitled SVG'))
        if (!cancelled) replaceDocument(doc)
      } finally {
        if (!cancelled) setIsBootstrapping(false)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [replaceDocument])

  return { isBootstrapping }
}
