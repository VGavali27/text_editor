import { afterEach, describe, expect, it } from 'vitest'
import { TextEditor } from '@editor/core'
import { Insert, defaultFormatDateTime } from '@editor/extension-insert'

const editors: TextEditor[] = []

function makeEditor(
  content: string,
  now: () => Date = () => new Date(2026, 0, 2, 3, 4, 5),
): TextEditor {
  const editor = new TextEditor({
    element: document.createElement('div'),
    content,
    extensions: [Insert({ now })],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('Insert', () => {
  it('inserts a formatted date/time', () => {
    const editor = makeEditor('<p></p>')
    editor.engine.commands.insertDateTime()
    expect(editor.getHTML()).toContain('2026-01-02 03:04')
  })

  it('accepts a preformatted value and a custom format', () => {
    const editor = makeEditor('<p></p>')
    editor.engine.commands.insertDateTime('Apr 5')
    expect(editor.getHTML()).toContain('Apr 5')
    expect(defaultFormatDateTime(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31 23:59')
  })

  it('inserts a non-breaking space', () => {
    const editor = makeEditor('<p></p>')
    editor.engine.commands.insertNonBreakingSpace()
    // The serializer emits the HTML entity form.
    expect(editor.getHTML()).toContain('&nbsp;')
  })

  it('inserts and round-trips a page break', () => {
    const editor = makeEditor('<p>a</p>')
    editor.engine.commands.insertPageBreak()
    expect(editor.getHTML()).toContain('data-page-break')

    editor.setHTML('<p>b</p><div data-page-break></div>')
    expect(editor.getHTML()).toContain('data-page-break')
    editor.engine.commands.setNodeSelection(3)
    expect(editor.engine.isActive('pageBreak')).toBe(true)
  })

  it('exposes insert toolbar buttons', () => {
    const editor = makeEditor('<p></p>')
    const names = editor.getToolbarItems().map((item) => item.name)
    expect(names).toEqual(['insertDateTime', 'insertPageBreak', 'insertNonBreakingSpace'])
  })
})