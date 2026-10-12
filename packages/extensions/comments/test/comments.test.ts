import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import type { AnyExtension } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import {
  Comments,
  createCommentPanel,
  getCommentIds,
  getCommentRanges,
  getCommentThreads,
} from '@editor/extension-comments'
import type { CommentsOptions } from '@editor/extension-comments'
import { TrackChanges, collectTrackedChanges } from '@editor/extension-track-changes'

const editors: Editor[] = []

function flatten(ext: { tiptap: AnyExtension | AnyExtension[] }): AnyExtension[] {
  return Array.isArray(ext.tiptap) ? ext.tiptap : [ext.tiptap]
}

function makeEditor(
  content: string,
  commentOptions: CommentsOptions = {},
  withTracking = false,
): Editor {
  let counter = 0
  const comments = Comments({
    author: 'Bob',
    now: () => 5000,
    createId: () => `id-${++counter}`,
    ...commentOptions,
  })
  const editor = new Editor({
    element: document.createElement('div'),
    content,
    extensions: [
      Document,
      Paragraph,
      Text,
      ...flatten(comments),
      ...(withTracking ? flatten(TrackChanges({ enabled: true, author: 'Alice', now: () => 1000 })) : []),
    ],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('comments: threads', () => {
  it('creates a thread and marks the selection', () => {
    const editor = makeEditor('<p>hello world</p>')
    editor.commands.setTextSelection({ from: 1, to: 6 })
    expect(editor.commands.addComment('first note')).toBe(true)

    const threads = getCommentThreads(editor)
    expect(threads).toHaveLength(1)
    expect(threads[0]).toMatchObject({
      id: 'id-1',
      author: 'Bob',
      body: 'first note',
      status: 'open',
      date: 5000,
    })

    expect(getCommentIds(editor.state.doc)).toEqual(['id-1'])
    expect(getCommentRanges(editor.state.doc, 'id-1')).toEqual([{ from: 1, to: 6 }])
  })

  it('refuses to comment on an empty selection', () => {
    const editor = makeEditor('<p>hello</p>')
    editor.commands.setTextSelection(3)
    expect(editor.commands.addComment('nope')).toBe(false)
    expect(getCommentThreads(editor)).toHaveLength(0)
  })

  it('round-trips comment marks through HTML', () => {
    const editor = makeEditor('<p>hello world</p>')
    editor.commands.setTextSelection({ from: 1, to: 6 })
    editor.commands.addComment('note')

    const html = editor.getHTML()
    expect(html).toContain('data-comment')
    expect(html).toContain('data-comment-id="id-1"')

    editor.commands.setContent(html, true)
    expect(getCommentIds(editor.state.doc)).toEqual(['id-1'])
  })

  it('resolves, reopens and replies', () => {
    const editor = makeEditor('<p>hello world</p>')
    editor.commands.setTextSelection({ from: 1, to: 6 })
    editor.commands.addComment('note')

    editor.commands.resolveComment('id-1')
    expect(getCommentThreads(editor)[0]!.status).toBe('resolved')

    editor.commands.reopenComment('id-1')
    expect(getCommentThreads(editor)[0]!.status).toBe('open')

    editor.commands.replyToComment('id-1', 'a reply')
    expect(getCommentThreads(editor)[0]!.replies).toEqual([
      { id: 'id-2', author: 'Bob', date: 5000, body: 'a reply' },
    ])
  })

  it('removes a thread and its mark', () => {
    const editor = makeEditor('<p>hello world</p>')
    editor.commands.setTextSelection({ from: 1, to: 6 })
    editor.commands.addComment('note')

    editor.commands.removeComment('id-1')
    expect(getCommentThreads(editor)).toHaveLength(0)
    expect(getCommentIds(editor.state.doc)).toEqual([])
  })

  it('notifies onChange subscribers', () => {
    const changes: number[] = []
    const editor = makeEditor('<p>hello world</p>', {
      onChange: (threads) => changes.push(threads.length),
    })
    editor.commands.setTextSelection({ from: 1, to: 6 })
    editor.commands.addComment('note')
    editor.commands.replyToComment('id-1', 'reply')
    expect(changes).toEqual([1, 1])
  })
})

describe('comments: track-changes integration', () => {
  it('links tracked changes inside the range to the comment thread', () => {
    const editor = makeEditor('<p></p>', {}, true)
    editor.commands.insertContentAt(1, 'abc')
    expect(collectTrackedChanges(editor.state.doc)[0]!.attrs.commentId).toBeNull()

    editor.commands.setTextSelection({ from: 1, to: 4 })
    editor.commands.addComment('why this change?')

    const change = collectTrackedChanges(editor.state.doc)[0]!
    expect(change.type).toBe('insertion')
    expect(change.attrs.commentId).toBe('id-1')
  })
})

describe('comments: panel', () => {
  it('renders threads and reacts to changes', () => {
    const editor = makeEditor('<p>hello world</p>')
    const host = document.createElement('div')
    const panel = createCommentPanel(editor, host)

    expect(host.textContent).toContain('Comments')
    expect(host.textContent).toContain('No comments yet.')

    editor.commands.setTextSelection({ from: 1, to: 6 })
    editor.commands.addComment('panel note')

    expect(host.textContent).toContain('panel note')
    expect(host.textContent).toContain('Bob')

    editor.commands.resolveComment('id-1')
    expect(host.querySelector('.editor-comments__thread')?.getAttribute('data-status')).toBe(
      'resolved',
    )

    panel.destroy()
    expect(host.querySelector('.editor-comments')).toBeNull()
  })
})
