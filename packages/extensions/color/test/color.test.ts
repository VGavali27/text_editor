import { afterEach, describe, expect, it } from 'vitest'
import { TextEditor } from '@editor/core'
import { Color } from '@editor/extension-color'
import { Styling } from '@editor/extension-styling'

const editors: TextEditor[] = []

function makeEditor(content: string): TextEditor {
  const editor = new TextEditor({
    element: document.createElement('div'),
    content,
    extensions: [Styling(), Color()],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('Color', () => {
  it('applies text color, highlight and block background', () => {
    const editor = makeEditor('<p>Hello</p>')
    editor.engine.chain().focus().setTextSelection({ from: 1, to: 3 }).run()

    editor.engine.chain().focus().setTextColor('#ff0000').run()
    editor.engine.chain().focus().setTextHighlight('#ffff00').run()
    editor.engine.chain().focus().setBlockBackground('#eeeeee').run()

    const html = editor.getHTML()
    // The browser normalizes inline colors to rgb() form.
    expect(html).toContain('color: rgb(255, 0, 0)')
    expect(html).toContain('background-color: rgb(255, 255, 0)')
    expect(html).toContain('background-color: rgb(238, 238, 238)')
  })

  it('clears colors', () => {
    const editor = makeEditor('<p>Hello</p>')
    editor.engine.chain().focus().setTextSelection({ from: 1, to: 3 }).run()
    editor.engine.chain().focus().setTextColor('#ff0000').run()
    editor.engine.chain().focus().setTextHighlight('#ffff00').run()

    editor.engine.chain().focus().unsetTextColor().unsetTextHighlight().run()
    const html = editor.getHTML()
    expect(html).not.toContain('rgb(255, 0, 0)')
    expect(html).not.toContain('rgb(255, 255, 0)')
  })

  it('parses colors back from HTML', () => {
    const editor = makeEditor('<p><span style="color: #00ff00">Hi</span></p>')
    editor.engine.commands.setTextSelection({ from: 1, to: 3 })
    expect(editor.engine.getAttributes('textColor').color).toBe('rgb(0, 255, 0)')
  })

  it('exposes three color controls', () => {
    const editor = makeEditor('<p>Hi</p>')
    const names = editor
      .getToolbarItems()
      .filter((item) => item.type === 'color')
      .map((item) => item.name)
    expect(names).toEqual(['textColor', 'textHighlight', 'blockBackground'])
  })
})
