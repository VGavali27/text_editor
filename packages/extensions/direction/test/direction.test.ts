import { afterEach, describe, expect, it } from 'vitest'
import { TextEditor } from '@editor/core'
import { Direction } from '@editor/extension-direction'

const editors: TextEditor[] = []

function makeEditor(content: string): TextEditor {
  const editor = new TextEditor({
    element: document.createElement('div'),
    content,
    extensions: [Direction()],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('Direction', () => {
  it('sets and clears the direction', () => {
    const editor = makeEditor('<p>Hello</p>')
    editor.engine.commands.setTextSelection({ from: 1, to: 3 })
    editor.engine.commands.setTextDirection('rtl')
    expect(editor.engine.isActive({ dir: 'rtl' })).toBe(true)
    expect(editor.getHTML()).toContain('dir="rtl"')

    editor.engine.commands.unsetTextDirection()
    expect(editor.getHTML()).not.toContain('dir=')
  })

  it('parses an existing dir attribute', () => {
    const editor = makeEditor('<p dir="rtl">Hello</p>')
    editor.engine.commands.setTextSelection(2)
    expect(editor.engine.isActive({ dir: 'rtl' })).toBe(true)
  })

  it('exposes ltr/rtl toolbar buttons', () => {
    const editor = makeEditor('<p>x</p>')
    const names = editor.getToolbarItems().map((item) => item.name)
    expect(names).toEqual(['ltr', 'rtl'])
  })
})