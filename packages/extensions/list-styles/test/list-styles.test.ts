import { afterEach, describe, expect, it } from 'vitest'
import { TextEditor } from '@editor/core'
import { ListStyles } from '@editor/extension-list-styles'
import { Styling } from '@editor/extension-styling'

const editors: TextEditor[] = []

function makeEditor(content = '<p></p>'): TextEditor {
  const editor = new TextEditor({
    element: document.createElement('div'),
    content,
    extensions: [Styling(), ListStyles()],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('ListStyles', () => {
  it('sets the marker style of a bullet list', () => {
    const editor = makeEditor()
    editor.engine.chain().focus().toggleBulletList().run()
    editor.engine.chain().focus().insertContent('item').run()

    editor.engine.chain().focus().setBulletListStyle('circle').run()
    expect(editor.getHTML()).toContain('list-style-type: circle')
    expect(editor.engine.getAttributes('bulletList').listStyleType).toBe('circle')
  })

  it('sets the marker style of an ordered list', () => {
    const editor = makeEditor()
    editor.engine.chain().focus().toggleOrderedList().run()
    editor.engine.chain().focus().insertContent('item').run()

    editor.engine.chain().focus().setOrderedListStyle('upper-roman').run()
    expect(editor.getHTML()).toContain('list-style-type: upper-roman')
  })

  it('parses marker styles back from HTML', () => {
    const editor = makeEditor('<ol style="list-style-type: lower-alpha"><li><p>a</p></li></ol>')
    editor.engine.commands.setTextSelection(2)
    expect(editor.engine.getAttributes('orderedList').listStyleType).toBe('lower-alpha')
  })

  it('offers bullet and ordered style dropdowns', () => {
    const editor = makeEditor()
    const bullet = editor.getToolbarItems().find((item) => item.name === 'bulletStyle')
    const ordered = editor.getToolbarItems().find((item) => item.name === 'orderedStyle')
    expect(bullet?.options?.map((option) => option.value)).toEqual(['disc', 'circle', 'square'])
    expect(ordered?.options?.map((option) => option.value)).toEqual([
      'decimal',
      'lower-alpha',
      'upper-alpha',
      'lower-roman',
      'upper-roman',
    ])
  })
})
