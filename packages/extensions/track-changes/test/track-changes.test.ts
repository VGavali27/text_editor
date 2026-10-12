import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import type { AnyExtension } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import {
  TrackChanges,
  collectTrackedChanges,
  countTrackedChanges,
  hasTrackedChanges,
  trackChangesKey,
} from '@editor/extension-track-changes'
import type { TrackChangesOptions } from '@editor/extension-track-changes'

const editors: Editor[] = []

function extensionsFor(options: TrackChangesOptions): AnyExtension[] {
  const ext = TrackChanges(options)
  return Array.isArray(ext.tiptap) ? ext.tiptap : [ext.tiptap]
}

function makeEditor(content: string, options: TrackChangesOptions = {}): Editor {
  const editor = new Editor({
    element: document.createElement('div'),
    content,
    extensions: [
      Document,
      Paragraph,
      Text,
      ...extensionsFor({ enabled: true, author: 'Alice', now: () => 1000, ...options }),
    ],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('track-changes: insertions', () => {
  it('marks typed text as an insertion with author + date', () => {
    const editor = makeEditor('<p>hello</p>')
    editor.commands.insertContentAt(6, ' world')

    const changes = collectTrackedChanges(editor.state.doc)
    expect(changes).toHaveLength(1)
    expect(changes[0]!.type).toBe('insertion')
    expect(changes[0]!.text).toBe(' world')
    expect(changes[0]!.attrs).toEqual({ author: 'Alice', date: 1000, commentId: null })
    expect(editor.state.doc.textContent).toBe('hello world')
  })

  it('round-trips through HTML', () => {
    const editor = makeEditor('<p>hello</p>')
    editor.commands.insertContentAt(6, '!')

    const html = editor.getHTML()
    expect(html).toContain('data-insertion')

    editor.commands.setContent(html, true)
    const changes = collectTrackedChanges(editor.state.doc)
    expect(changes).toHaveLength(1)
    expect(changes[0]!.type).toBe('insertion')
    expect(changes[0]!.text).toBe('!')
  })

  it('acceptChanges keeps text and strips the mark', () => {
    const editor = makeEditor('<p>hello</p>')
    editor.commands.insertContentAt(6, ' world')
    editor.commands.acceptChanges()

    expect(editor.state.doc.textContent).toBe('hello world')
    expect(hasTrackedChanges(editor.state.doc)).toBe(false)
  })

  it('rejectChanges removes inserted text', () => {
    const editor = makeEditor('<p>hello</p>')
    editor.commands.insertContentAt(6, ' world')
    editor.commands.rejectChanges()

    expect(editor.state.doc.textContent).toBe('hello')
    expect(hasTrackedChanges(editor.state.doc)).toBe(false)
  })
})

describe('track-changes: deletions', () => {
  it('keeps deleted text but marks it as a deletion', () => {
    const editor = makeEditor('<p>hello world</p>')
    editor.chain().setTextSelection({ from: 7, to: 12 }).deleteSelection().run()

    const changes = collectTrackedChanges(editor.state.doc)
    expect(changes).toHaveLength(1)
    expect(changes[0]!.type).toBe('deletion')
    expect(changes[0]!.text).toBe('world')
    // The text is still present in the document.
    expect(editor.state.doc.textContent).toBe('hello world')
  })

  it('acceptChanges removes the deleted text', () => {
    const editor = makeEditor('<p>hello world</p>')
    editor.chain().setTextSelection({ from: 7, to: 12 }).deleteSelection().run()
    editor.commands.acceptChanges()

    expect(editor.state.doc.textContent).toBe('hello ')
    expect(hasTrackedChanges(editor.state.doc)).toBe(false)
  })

  it('rejectChanges restores the deleted text', () => {
    const editor = makeEditor('<p>hello world</p>')
    editor.chain().setTextSelection({ from: 7, to: 12 }).deleteSelection().run()
    editor.commands.rejectChanges()

    expect(editor.state.doc.textContent).toBe('hello world')
    expect(hasTrackedChanges(editor.state.doc)).toBe(false)
  })
})

describe('track-changes: replacements', () => {
  it('records both the removed and the inserted text when replacing a range', () => {
    const editor = makeEditor('<p>hello world</p>')
    editor.chain().setTextSelection({ from: 7, to: 12 }).insertContent('there').run()

    const changes = collectTrackedChanges(editor.state.doc)
    const types = changes.map((c) => c.type).sort()
    expect(types).toEqual(['deletion', 'insertion'])
    expect(editor.state.doc.textContent).toContain('world')
    expect(editor.state.doc.textContent).toContain('there')
  })
})

describe('track-changes: toggle', () => {
  it('does not record changes when tracking is off', () => {
    const editor = makeEditor('<p>hello</p>', { enabled: false })
    expect(trackChangesKey.getState(editor.state)).toBe(false)

    editor.commands.insertContentAt(6, ' world')
    expect(hasTrackedChanges(editor.state.doc)).toBe(false)
    expect(editor.state.doc.textContent).toBe('hello world')
  })

  it('records changes after tracking is switched on', () => {
    const editor = makeEditor('<p>hello</p>', { enabled: false })
    editor.commands.setTrackChanges(true)
    expect(trackChangesKey.getState(editor.state)).toBe(true)

    editor.commands.insertContentAt(6, '!')
    expect(countTrackedChanges(editor.state.doc)).toBe(1)
  })
})

describe('track-changes: selection-scoped review', () => {
  it('only accepts changes inside the selection when one is present', () => {
    const editor = makeEditor('<p>x</p>')
    editor.commands.insertContentAt(1, 'a')
    editor.commands.insertContentAt(3, 'b')
    expect(countTrackedChanges(editor.state.doc)).toBe(2)

    // Select just "a" (position 1..2) and accept.
    editor.chain().setTextSelection({ from: 1, to: 2 }).acceptChanges().run()

    const changes = collectTrackedChanges(editor.state.doc)
    expect(changes).toHaveLength(1)
    expect(changes[0]!.text).toBe('b')
  })
})
