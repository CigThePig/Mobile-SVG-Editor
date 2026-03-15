import { describe, it, expect, beforeEach } from 'vitest'
import { useHistoryStore } from './historyStore'
import type { SvgDocument } from '@/model/document/documentTypes'

function makeDoc(id: string): SvgDocument {
  return { id } as SvgDocument
}

beforeEach(() => {
  useHistoryStore.getState().clear()
})

describe('historyStore — pushSnapshot', () => {
  it('adds an entry to the undo stack and clears the redo stack', () => {
    useHistoryStore.getState().pushSnapshot('Test', makeDoc('a'), makeDoc('b'))
    const state = useHistoryStore.getState()
    expect(state.undoStack).toHaveLength(1)
    expect(state.undoStack[0].label).toBe('Test')
    expect(state.redoStack).toHaveLength(0)
  })

  it('clears the redo stack when a new snapshot is pushed', () => {
    const store = useHistoryStore.getState()
    store.pushSnapshot('Op1', makeDoc('a'), makeDoc('b'))
    store.undo()
    expect(useHistoryStore.getState().redoStack).toHaveLength(1)
    useHistoryStore.getState().pushSnapshot('Op2', makeDoc('a'), makeDoc('c'))
    expect(useHistoryStore.getState().redoStack).toHaveLength(0)
  })
})

describe('historyStore — undo', () => {
  it('returns the beforeDocument and moves entry to redoStack', () => {
    const store = useHistoryStore.getState()
    const before = makeDoc('before')
    const after = makeDoc('after')
    store.pushSnapshot('Op', before, after)
    const result = useHistoryStore.getState().undo()
    expect(result?.id).toBe('before')
    expect(useHistoryStore.getState().undoStack).toHaveLength(0)
    expect(useHistoryStore.getState().redoStack).toHaveLength(1)
  })

  it('returns undefined when undo stack is empty', () => {
    const store = useHistoryStore.getState()
    expect(store.undo()).toBeUndefined()
  })
})

describe('historyStore — redo', () => {
  it('returns the afterDocument and moves entry back to undoStack', () => {
    const store = useHistoryStore.getState()
    store.pushSnapshot('Op', makeDoc('before'), makeDoc('after'))
    useHistoryStore.getState().undo()
    const result = useHistoryStore.getState().redo()
    expect(result?.id).toBe('after')
    expect(useHistoryStore.getState().undoStack).toHaveLength(1)
    expect(useHistoryStore.getState().redoStack).toHaveLength(0)
  })

  it('returns undefined when redo stack is empty', () => {
    const store = useHistoryStore.getState()
    expect(store.redo()).toBeUndefined()
  })
})

describe('historyStore — canUndo / canRedo', () => {
  it('reflects undo/redo stack states', () => {
    const store = useHistoryStore.getState()
    expect(store.canUndo()).toBe(false)
    expect(store.canRedo()).toBe(false)
    store.pushSnapshot('Op', makeDoc('a'), makeDoc('b'))
    expect(useHistoryStore.getState().canUndo()).toBe(true)
    expect(useHistoryStore.getState().canRedo()).toBe(false)
    useHistoryStore.getState().undo()
    expect(useHistoryStore.getState().canUndo()).toBe(false)
    expect(useHistoryStore.getState().canRedo()).toBe(true)
  })
})

describe('historyStore — clear', () => {
  it('empties both stacks', () => {
    const store = useHistoryStore.getState()
    store.pushSnapshot('Op', makeDoc('a'), makeDoc('b'))
    useHistoryStore.getState().clear()
    expect(useHistoryStore.getState().undoStack).toHaveLength(0)
    expect(useHistoryStore.getState().redoStack).toHaveLength(0)
  })
})

describe('historyStore — stack cap', () => {
  it('caps the undo stack at 50 entries after 55 pushes', () => {
    const store = useHistoryStore.getState()
    for (let i = 0; i < 55; i++) {
      useHistoryStore.getState().pushSnapshot(`Op${i}`, makeDoc(`before-${i}`), makeDoc(`after-${i}`))
    }
    expect(useHistoryStore.getState().undoStack).toHaveLength(50)
  })

  it('keeps the most recent entries when capped', () => {
    const store = useHistoryStore.getState()
    for (let i = 0; i < 55; i++) {
      useHistoryStore.getState().pushSnapshot(`Op${i}`, makeDoc(`before-${i}`), makeDoc(`after-${i}`))
    }
    const stack = useHistoryStore.getState().undoStack
    // The oldest entry retained should be Op5 (index 5 of 0–54)
    expect(stack[0].label).toBe('Op5')
    // The newest should be Op54
    expect(stack[49].label).toBe('Op54')
  })
})
