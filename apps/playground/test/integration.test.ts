import { afterEach, describe, expect, it } from 'vitest'
import { TextEditor } from '@editor/core'
import { Anchor } from '@editor/extension-anchor'
import {
  Comments,
  createCommentPanel,
  getCommentIds,
  getCommentThreads,
} from '@editor/extension-comments'
import { History } from '@editor/extension-history'
import { ImageExtension } from '@editor/extension-image'
import { Link } from '@editor/extension-link'
import { normalizePastedHtml, PasteClean } from '@editor/extension-paste-clean'
import { enterSourceView, exitSourceView, isSourceView, SourceView } from '@editor/extension-source-view'
import { Styling } from '@editor/extension-styling'
import { collectTrackedChanges, TrackChanges } from '@editor/extension-track-changes'
import { Sanitize } from '@editor/sanitize'
import { createBubbleToolbar, createToolbar } from '@editor/ui'

const editors: TextEditor[] = []
const hosts: HTMLElement[] = []

function host(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  hosts.push(el)
  return el
}

interface Harness {
  editor: TextEditor
  commentsHost: HTMLElement
  panel: { refresh: () => void; destroy: () => void }
  toolbar: { refresh: () => void; destroy: () => void }
  bubble: { refresh: () => void; destroy: () => void }
}

function makeHarness(): Harness {
  const editor = new TextEditor({
    element: host(),
    content: '<p>Hello world</p>',
    extensions: [
      Styling(),
      History(),
      Link({ onRequestUrl: () => 'https://example.com' }),
      Anchor({ onRequestName: (suggested) => suggested }),
      ImageExtension({ onRequestUrl: () => 'https://example.com/a.png', allowBase64: false }),
      PasteClean(),
      SourceView(),
      Sanitize({ normalize: normalizePastedHtml }),
      TrackChanges({ author: 'Alice', now: () => 1000 }),
      Comments({ author: 'Bob', now: () => 2000 }),
    ],
  })
  editors.push(editor)

  const commentsHost = host()
  const panel = createCommentPanel(editor, commentsHost, { onRequestReply: () => 'reply' })
  const toolbar = createToolbar(editor, host())
  const bubble = createBubbleToolbar(editor, {
    items: editor.getToolbarItems().filter((item) => item.name === 'bold'),
  })

  return { editor, commentsHost, panel, toolbar, bubble }
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
  while (hosts.length) hosts.pop()?.remove()
})

describe('full-stack integration', () => {
  it('applies inline styling through the toolbar items', () => {
    const { editor } = makeHarness()
    editor.engine.commands.setTextSelection({ from: 1, to: 6 })
    const bold = editor.getToolbarItems().find((item) => item.name === 'bold')
    expect(bold).toBeDefined()
    bold!.run(editor.engine)
    expect(editor.getHTML()).toMatch(/<strong>Hello<\/strong>/)
  })

  it('sanitizes pasted HTML through the wired security gate', () => {
    const { editor } = makeHarness()
    const payload =
      '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a>'
    const sanitized = editor.engine.view.someProp('transformPastedHTML', (fn) => fn(payload))
    expect(sanitized).toBeTruthy()
    expect(sanitized).not.toMatch(/<script/i)
    expect(sanitized).not.toMatch(/onerror/i)
    expect(sanitized).not.toMatch(/javascript:/i)
  })

  it('cleans pasted slices through the wired structure gate', () => {
    const { editor } = makeHarness()
    const hasTransform = editor.engine.view.someProp('transformPasted', () => true)
    expect(hasTransform).toBe(true)
  })

  it('inserts an image and an anchor', () => {
    const { editor } = makeHarness()
    editor.engine.commands.setImage({ src: 'https://example.com/a.png', alt: 'a' })
    expect(editor.getHTML()).toContain('src="https://example.com/a.png"')

    editor.engine.commands.setTextSelection(1)
    editor.engine.commands.setAnchor({ id: 'intro' })
    expect(editor.getHTML()).toContain('id="intro"')
  })

  it('creates, replies to, resolves and removes a comment thread', () => {
    const { editor, commentsHost } = makeHarness()
    editor.engine.commands.setTextSelection({ from: 1, to: 6 })
    expect(editor.engine.commands.addComment('first note')).toBe(true)

    const [thread] = getCommentThreads(editor)
    expect(thread?.body).toBe('first note')
    expect(getCommentIds(editor.engine.state.doc)).toContain(thread!.id)

    // The panel exposes an accessible region with per-thread controls.
    expect(commentsHost.querySelector('[role="region"]')).toBeTruthy()
    const showButton = commentsHost.querySelector<HTMLButtonElement>(
      'button[aria-label^="Show"]',
    )
    expect(showButton).toBeTruthy()

    editor.engine.commands.replyToComment(thread!.id, 'a reply')
    expect(getCommentThreads(editor)[0]?.replies.length).toBe(1)

    editor.engine.commands.resolveComment(thread!.id)
    expect(getCommentThreads(editor)[0]?.status).toBe('resolved')

    editor.engine.commands.removeComment(thread!.id)
    expect(getCommentThreads(editor).length).toBe(0)
  })

  it('tracks, accepts and rejects changes', () => {
    const { editor } = makeHarness()

    editor.engine.commands.setTrackChanges(true)
    editor.engine.commands.insertContent('XYZ')
    const inserted = collectTrackedChanges(editor.engine.state.doc)
    expect(inserted.some((change) => change.type === 'insertion' && change.text.includes('XYZ'))).toBe(true)

    editor.engine.commands.acceptChanges()
    expect(collectTrackedChanges(editor.engine.state.doc).length).toBe(0)
    expect(editor.getHTML()).toContain('XYZ')

    editor.engine.commands.setTrackChanges(true)
    editor.engine.commands.insertContent('QQQ')
    editor.engine.commands.rejectChanges()
    expect(editor.getHTML()).not.toContain('QQQ')
  })

  it('round-trips source view', () => {
    const { editor } = makeHarness()
    expect(isSourceView(editor.engine)).toBe(false)
    enterSourceView(editor.engine)
    expect(isSourceView(editor.engine)).toBe(true)
    const textarea = editor.engine.view.dom.parentElement?.querySelector('textarea')
    expect(textarea?.getAttribute('aria-label')).toBe('HTML source')
    exitSourceView(editor.engine)
    expect(isSourceView(editor.engine)).toBe(false)
  })

  it('undoes and redoes edits through history', () => {
    const { editor } = makeHarness()
    editor.engine.commands.setTrackChanges(false)
    editor.engine.commands.focus()
    editor.engine.commands.insertContent(' UNDO_ME')
    expect(editor.getHTML()).toContain('UNDO_ME')

    editor.engine.commands.undo()
    expect(editor.getHTML()).not.toContain('UNDO_ME')

    editor.engine.commands.redo()
    expect(editor.getHTML()).toContain('UNDO_ME')
  })
})
