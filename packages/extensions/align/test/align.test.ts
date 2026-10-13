import { afterEach, describe, expect, it } from 'vitest'
import { TextEditor } from '@editor/core'
import { Align } from '@editor/extension-align'
import { Styling } from '@editor/extension-styling'

const editors: TextEditor[] = []

function makeEditor(content: string): TextEditor {
  const editor = new TextEditor({
    element: document.createElement('div'),
    content,
    extensions: [Styling(), Align()],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('Align', () => {
  it('applies and clears text alignment on a paragraph', () => {
    const editor = makeEditor('<p>Hello</p>')
    editor.engine.commands.setTextSelection({ from: 1, to: 3 })

    editor.engine.commands.setTextAlign('center')
    expect(editor.engine.isActive({ textAlign: 'center' })).toBe(true)
    expect(editor.getHTML()).toContain('text-align: center')

    editor.engine.commands.setTextAlign('justify')
    expect(editor.engine.isActive({ textAlign: 'justify' })).toBe(true)

    editor.engine.commands.unsetTextAlign()
    expect(editor.getHTML()).not.toContain('text-align')
  })

  it('parses existing alignment back from HTML', () => {
    const editor = makeEditor('<p style="text-align: right">Hello</p>')
    editor.engine.commands.setTextSelection({ from: 1, to: 3 })
    expect(editor.engine.isActive({ textAlign: 'right' })).toBe(true)
  })

  it('exposes four alignment toolbar buttons', () => {
    const editor = makeEditor('<p>Hello</p>')
    const names = editor
      .getToolbarItems()
      .filter((item) => item.group === 'align')
      .map((item) => item.name)
    expect(names).toEqual(['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'])
  })
})
