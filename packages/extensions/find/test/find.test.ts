import { afterEach, describe, expect, it } from 'vitest'
import { TextEditor } from '@editor/core'
import { Find, createFindBar, getFindState } from '@editor/extension-find'

const editors: TextEditor[] = []

function makeEditor(content: string): TextEditor {
  const editor = new TextEditor({
    element: document.createElement('div'),
    content,
    extensions: [Find()],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('Find', () => {
  it('finds matches and highlights them in the document', () => {
    const editor = makeEditor('<p>foo bar foo</p>')
    editor.engine.commands.setSearchTerm('foo')

    expect(getFindState(editor.engine.state)?.matches).toHaveLength(2)
    expect(editor.engine.view.dom.querySelectorAll('.editor-find-match')).toHaveLength(2)
    expect(editor.engine.view.dom.querySelector('.editor-find-match--active')).toBeTruthy()
  })

  it('navigates next / previous matches', () => {
    const editor = makeEditor('<p>foo bar foo</p>')
    editor.engine.commands.setSearchTerm('foo')
    editor.engine.commands.findNext()
    expect(getFindState(editor.engine.state)?.active).toBe(1)
    editor.engine.commands.findPrevious()
    expect(getFindState(editor.engine.state)?.active).toBe(0)
  })

  it('replaces the active match and all matches', () => {
    const editor = makeEditor('<p>foo bar foo</p>')
    editor.engine.commands.setSearchTerm('foo')
    editor.engine.commands.replaceCurrent('baz')
    expect(editor.getHTML()).toContain('baz bar foo')

    editor.engine.commands.setSearchTerm('bar')
    editor.engine.commands.replaceAll('y')
    expect(editor.getHTML()).toContain('baz y foo')
    expect(getFindState(editor.engine.state)?.matches).toHaveLength(0)
  })

  it('is case-insensitive and clears highlights', () => {
    const editor = makeEditor('<p>FOO bar</p>')
    editor.engine.commands.setSearchTerm('foo')
    expect(getFindState(editor.engine.state)?.matches).toHaveLength(1)
    editor.engine.commands.clearSearch()
    expect(getFindState(editor.engine.state)?.matches).toHaveLength(0)
    expect(editor.engine.view.dom.querySelector('.editor-find-match')).toBeNull()
  })

  it('exposes a find toolbar button', () => {
    const editor = makeEditor('<p>x</p>')
    expect(editor.getToolbarItems().map((item) => item.name)).toContain('find')
  })
})

describe('createFindBar', () => {
  it('opens, synchronises and closes with the commands', () => {
    const editor = makeEditor('<p>hello world</p>')
    const bar = createFindBar(editor)
    bar.open()
    expect(bar.element.hidden).toBe(false)

    const input = bar.element.querySelector<HTMLInputElement>('input[placeholder="Find"]')!
    input.value = 'world'
    input.dispatchEvent(new Event('input'))
    expect(getFindState(editor.engine.state)?.matches).toHaveLength(1)
    expect(bar.element.querySelector('.editor-find__status')?.textContent).toBe('1/1')

    bar.close()
    expect(bar.element.hidden).toBe(true)
    expect(getFindState(editor.engine.state)?.matches).toHaveLength(0)
    bar.destroy()
  })
})