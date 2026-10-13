import { afterEach, describe, expect, it } from 'vitest'
import { TextEditor } from '@editor/core'
import {
  WordCount,
  countText,
  createWordCount,
  getWordCount,
} from '@editor/extension-word-count'

const editors: TextEditor[] = []

function makeEditor(content: string): TextEditor {
  const editor = new TextEditor({
    element: document.createElement('div'),
    content,
    extensions: [WordCount()],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('word counts', () => {
  it('counts words and characters in a string', () => {
    expect(countText('one two  three')).toEqual({
      words: 3,
      characters: 14,
      charactersNoSpaces: 11,
    })
    expect(countText('   ').words).toBe(0)
    expect(countText('').characters).toBe(0)
  })

  it('counts the live document', () => {
    const editor = makeEditor('<p>alpha beta</p>')
    expect(getWordCount(editor.engine)).toMatchObject({ words: 2, characters: 10 })
    editor.engine.commands.insertContent('!')
    expect(getWordCount(editor.engine).characters).toBe(11)
  })

  it('renders a live readout', () => {
    const editor = makeEditor('<p>one two</p>')
    const element = document.createElement('span')
    const readout = createWordCount(editor, element, {
      format: (result) => `${result.words}w`,
    })
    expect(element.textContent).toBe('2w')
    // Move the cursor to the end of the document before inserting.
    editor.engine.commands.setTextSelection(editor.engine.state.doc.content.size)
    editor.engine.commands.insertContent(' three')
    expect(element.textContent).toBe('3w')
    readout.destroy()
  })
})