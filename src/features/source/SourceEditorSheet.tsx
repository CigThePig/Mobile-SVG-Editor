/**
 * src/features/source/SourceEditorSheet.tsx
 *
 * Full-screen source editor overlay.
 *
 * Provides a Monaco-based SVG/XML editor that is a first-class equal to the
 * visual canvas. The editor integrates with the sync state machine to:
 *   - Display the serialized document when first opened
 *   - Track unapplied changes (source-pending state)
 *   - Apply changes back to the document model via the import pipeline
 *   - Update source text when visual edits are made (minimal diff)
 *   - Sync selection between canvas and source cursor position
 *
 * Architecture contract: see docs/architecture/source-visual-sync.md
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type * as MonacoType from 'monaco-editor'
import {
  X,
  Check,
  RotateCcw,
  WrapText,
  Zap,
  Copy,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react'
import { useSourceStore } from './sourceState'
import { useEditorStore } from '@/stores/editorStore'
import { serializeSvgDocument } from '@/features/export/index'
import {
  applySourceCommand,
  revertSourceCommand,
  formatSourceCommand,
  formatAndApplySourceCommand,
} from './sourceCommands'
import { SourceDiagnosticsPanel } from './sourceDiagnostics'
import { buildSelectionMap, findRangeForNodeId } from './sourceSelectionMap'
import type { ImportDiagnostic } from '@/model/document/documentTypes'

// ── SourceEditorSheet ─────────────────────────────────────────────────────────

export function SourceEditorSheet() {
  const isOpen = useSourceStore((s) => s.isOpen)
  const syncState = useSourceStore((s) => s.syncState)
  const pendingSourceText = useSourceStore((s) => s.pendingSourceText)
  const lastAppliedText = useSourceStore((s) => s.lastAppliedText)
  const applyError = useSourceStore((s) => s.applyError)
  const setSourceText = useSourceStore((s) => s.setSourceText)
  const setLastAppliedText = useSourceStore((s) => s.setLastAppliedText)
  const closeSource = useSourceStore((s) => s.closeSource)

  const activeDocument = useEditorStore((s) => s.activeDocument)
  const selectedNodeIds = useEditorStore((s) => s.selection.selectedNodeIds)

  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof MonacoType | null>(null)

  const [applying, setApplying] = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  // Current diagnostics from the active document (from last import/apply)
  const diagnostics: ImportDiagnostic[] = activeDocument.diagnostics ?? []

  // The text currently shown in the editor
  // When pending, use pendingSourceText; otherwise use lastAppliedText
  const editorText = pendingSourceText ?? lastAppliedText ?? ''

  // ── Initialize source text when opening ───────────────────────────────────

  useEffect(() => {
    if (!isOpen) return

    // Serialize the current document as the initial source text
    const serialized = serializeSvgDocument(activeDocument)
    setLastAppliedText(serialized)

    // If the editor is already mounted, update its value
    if (editorRef.current) {
      const currentValue = editorRef.current.getValue()
      if (currentValue !== serialized) {
        editorRef.current.setValue(serialized)
      }
    }
  // Only run when the sheet opens, not on every document change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // ── Sync source text when document changes via visual edit ────────────────

  // Track the document ID to detect when a completely different document is loaded
  const docIdRef = useRef(activeDocument.id)

  useEffect(() => {
    if (!isOpen) return

    // If the document was replaced entirely (new import, undo past an import, etc.)
    // reset the source editor completely
    if (activeDocument.id !== docIdRef.current) {
      docIdRef.current = activeDocument.id
      const serialized = serializeSvgDocument(activeDocument)
      setLastAppliedText(serialized)
      useSourceStore.getState().clearPending()
      if (editorRef.current) {
        editorRef.current.setValue(serialized)
      }
      return
    }

    // For in-place visual edits: the commandRunner updates lastAppliedText via
    // useSourceStore directly (see commandRunner.ts). The editor watches lastAppliedText
    // to update its content when not pending.
    if (syncState !== 'source-pending' && lastAppliedText !== null) {
      if (editorRef.current) {
        const currentValue = editorRef.current.getValue()
        if (currentValue !== lastAppliedText) {
          editorRef.current.setValue(lastAppliedText)
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAppliedText, activeDocument.id, isOpen])

  // ── Canvas → Source selection sync ────────────────────────────────────────

  useEffect(() => {
    if (!isOpen || !editorRef.current || !monacoRef.current || selectedNodeIds.length === 0) return

    const text = editorRef.current.getValue()
    const selMap = buildSelectionMap(text)
    const nodeId = selectedNodeIds[0]
    const range = findRangeForNodeId(selMap, nodeId)

    if (!range) return

    const model = editorRef.current.getModel()
    if (!model) return

    const startPos = model.getPositionAt(range.start)
    const endPos = model.getPositionAt(range.end)

    // Reveal and highlight the selected element
    editorRef.current.revealLineInCenter(startPos.lineNumber)
    editorRef.current.setSelection({
      startLineNumber: startPos.lineNumber,
      startColumn: startPos.column,
      endLineNumber: endPos.lineNumber,
      endColumn: endPos.column,
    })
  }, [selectedNodeIds, isOpen])

  // ── Monaco editor mount ────────────────────────────────────────────────────

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor
      monacoRef.current = monaco

      // Set initial content
      const initialText = useSourceStore.getState().lastAppliedText ?? ''
      if (initialText && editor.getValue() !== initialText) {
        editor.setValue(initialText)
      }

      // Ctrl+Enter / Cmd+Enter → Apply
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        void handleApply()
      })

      // Source → Canvas selection sync: when cursor moves, find the node at that offset
      editor.onDidChangeCursorPosition((e) => {
        const model = editor.getModel()
        if (!model) return
        const offset = model.getOffsetAt(e.position)
        const text = editor.getValue()
        const selMap = buildSelectionMap(text)
        // findNodeIdAtOffset is not used for now since it imports a dep
        // We use a simple inline scan here to avoid circular deps
        let bestId: string | null = null
        let bestSize = Infinity
        for (const [id, r] of selMap) {
          if (offset >= r.start && offset <= r.end) {
            const size = r.end - r.start
            if (size < bestSize) {
              bestSize = size
              bestId = id
            }
          }
        }
        if (bestId) {
          const editorStore = useEditorStore.getState()
          if (!editorStore.selection.selectedNodeIds.includes(bestId)) {
            editorStore.setSelection([bestId])
          }
        }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // ── Editor content change handler ─────────────────────────────────────────

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return
      setSourceText(value)
    },
    [setSourceText]
  )

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleApply = async () => {
    const text = pendingSourceText ?? editorRef.current?.getValue()
    if (!text) return
    setApplying(true)
    try {
      await applySourceCommand(text)
      // After apply, update the editor to show the applied text
      // (applySourceCommand updates lastAppliedText in the store)
    } catch {
      // Error is stored in sourceStore.applyError
    } finally {
      setApplying(false)
    }
  }

  const handleRevert = () => {
    revertSourceCommand()
    // Update the editor text to show the reverted content
    const revertedText = useSourceStore.getState().lastAppliedText ?? ''
    if (editorRef.current) {
      editorRef.current.setValue(revertedText)
    }
  }

  const handleFormat = async () => {
    const text = editorRef.current?.getValue()
    if (!text) return
    setFormatting(true)
    try {
      const formatted = await formatSourceCommand(text)
      if (editorRef.current) {
        editorRef.current.setValue(formatted)
        // setSourceText will be called by handleEditorChange
      }
    } finally {
      setFormatting(false)
    }
  }

  const handleFormatAndApply = async () => {
    const text = editorRef.current?.getValue()
    if (!text) return
    setApplying(true)
    setFormatting(true)
    try {
      await formatAndApplySourceCommand(text)
      const newText = useSourceStore.getState().lastAppliedText ?? ''
      if (editorRef.current) {
        editorRef.current.setValue(newText)
      }
    } catch {
      // Error stored in sourceStore.applyError
    } finally {
      setApplying(false)
      setFormatting(false)
    }
  }

  const handleCopy = async () => {
    const text = editorRef.current?.getValue() ?? ''
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access denied
    }
  }

  const handleCloseRequest = () => {
    if (syncState === 'source-pending') {
      setShowCloseConfirm(true)
    } else {
      closeSource()
    }
  }

  const handleDiscardAndClose = () => {
    setShowCloseConfirm(false)
    closeSource()
  }

  const handleApplyAndClose = async () => {
    setShowCloseConfirm(false)
    await handleApply()
    closeSource()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: '#0d0d0d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: '#111111',
          flexShrink: 0,
          flexWrap: 'wrap',
          minHeight: 48,
        }}
      >
        {/* Close button */}
        <button
          onClick={handleCloseRequest}
          style={toolbarIconBtn}
          aria-label="Close source editor"
        >
          <X size={18} />
        </button>

        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.8)',
            marginRight: 4,
            whiteSpace: 'nowrap',
          }}
        >
          Source
        </span>

        {/* Sync state badge */}
        <SyncStateBadge syncState={syncState} />

        <div style={{ flex: 1 }} />

        {/* Action buttons */}
        <button
          onClick={() => void handleApply()}
          disabled={applying || syncState !== 'source-pending'}
          title="Apply changes (Ctrl+Enter)"
          style={{
            ...toolbarActionBtn,
            background:
              syncState === 'source-pending' && !applying
                ? 'rgba(59,130,246,0.2)'
                : 'rgba(255,255,255,0.06)',
            color:
              syncState === 'source-pending' && !applying
                ? '#93c5fd'
                : 'rgba(255,255,255,0.4)',
            cursor:
              syncState === 'source-pending' && !applying ? 'pointer' : 'not-allowed',
          }}
        >
          <Check size={14} />
          {applying ? 'Applying…' : 'Apply'}
        </button>

        <button
          onClick={handleRevert}
          disabled={syncState !== 'source-pending'}
          title="Revert to last applied"
          style={{
            ...toolbarActionBtn,
            color:
              syncState === 'source-pending'
                ? 'rgba(255,255,255,0.7)'
                : 'rgba(255,255,255,0.3)',
            cursor: syncState === 'source-pending' ? 'pointer' : 'not-allowed',
          }}
        >
          <RotateCcw size={14} />
          Revert
        </button>

        <button
          onClick={() => void handleFormat()}
          disabled={formatting}
          title="Format XML"
          style={toolbarActionBtn}
        >
          <WrapText size={14} />
          {formatting ? 'Formatting…' : 'Format'}
        </button>

        <button
          onClick={() => void handleFormatAndApply()}
          disabled={applying || formatting}
          title="Format and apply"
          style={toolbarActionBtn}
        >
          <Zap size={14} />
          Fmt+Apply
        </button>

        <button
          onClick={() => void handleCopy()}
          title="Copy SVG to clipboard"
          style={toolbarActionBtn}
        >
          <Copy size={14} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* ── Close confirmation bar ────────────────────────────────────────── */}
      {showCloseConfirm && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'rgba(250,204,21,0.08)',
            borderBottom: '1px solid rgba(250,204,21,0.2)',
            fontSize: 13,
            color: '#facc15',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={14} />
          <span style={{ flex: 1 }}>You have unapplied source changes.</span>
          <button
            onClick={handleDiscardAndClose}
            style={{ ...closeConfirmBtn, color: '#f87171' }}
          >
            Discard
          </button>
          <button
            onClick={() => void handleApplyAndClose()}
            style={{ ...closeConfirmBtn, color: '#4ade80' }}
          >
            Apply &amp; Close
          </button>
          <button
            onClick={() => setShowCloseConfirm(false)}
            style={{ ...closeConfirmBtn, color: 'rgba(255,255,255,0.5)' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Apply error banner ────────────────────────────────────────────── */}
      {applyError && (
        <div
          style={{
            padding: '8px 14px',
            background: 'rgba(239,68,68,0.1)',
            borderBottom: '1px solid rgba(239,68,68,0.25)',
            color: '#fca5a5',
            fontSize: 12,
            fontFamily: 'monospace',
            flexShrink: 0,
          }}
        >
          {applyError}
        </div>
      )}

      {/* ── Monaco editor ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Editor
          defaultLanguage="xml"
          theme="vs-dark"
          value={editorText}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          loading={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'rgba(255,255,255,0.4)',
                fontSize: 14,
              }}
            >
              Loading editor…
            </div>
          }
          options={{
            wordWrap: 'off',
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            folding: true,
            foldingHighlight: true,
            tabSize: 2,
            insertSpaces: true,
            renderWhitespace: 'selection',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', Menlo, Monaco, monospace",
            fontLigatures: true,
            bracketPairColorization: { enabled: true },
            // Performance: limit tokenization on very large files
            maxTokenizationLineLength: 10000,
          }}
        />
      </div>

      {/* ── Diagnostics panel ────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '6px 10px',
          background: '#0f0f0f',
          flexShrink: 0,
        }}
      >
        <SourceDiagnosticsPanel
          diagnostics={diagnostics}
          expanded={diagnosticsExpanded}
          onToggle={() => setDiagnosticsExpanded((v) => !v)}
        />
      </div>
    </div>
  )
}

// ── Sync state badge ──────────────────────────────────────────────────────────

function SyncStateBadge({ syncState }: { syncState: string }) {
  let color: string
  let bg: string
  let label: string
  let icon: React.ReactNode

  switch (syncState) {
    case 'source-pending':
      color = '#facc15'
      bg = 'rgba(250,204,21,0.12)'
      label = 'Unapplied changes'
      icon = <Clock size={11} />
      break
    case 'visual-pending':
      color = '#93c5fd'
      bg = 'rgba(147,197,253,0.12)'
      label = 'Syncing…'
      icon = <Clock size={11} />
      break
    case 'conflict':
      color = '#f87171'
      bg = 'rgba(248,113,113,0.12)'
      label = 'Conflict'
      icon = <AlertTriangle size={11} />
      break
    default: // clean
      color = '#4ade80'
      bg = 'rgba(74,222,128,0.12)'
      label = 'In sync'
      icon = <CheckCircle size={11} />
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 7px',
        borderRadius: 5,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const toolbarIconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 7,
  background: 'rgba(255,255,255,0.07)',
  color: 'rgba(255,255,255,0.7)',
  cursor: 'pointer',
  flexShrink: 0,
}

const toolbarActionBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 10px',
  borderRadius: 7,
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const closeConfirmBtn: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 5,
  background: 'rgba(255,255,255,0.06)',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
