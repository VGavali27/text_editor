import { afterEach, describe, expect, it } from 'vitest'
import { TextEditor } from '@editor/core'
import { SpecialChars, openCharacterPicker } from '@editor/extension-special-chars'

const editors: TextEditor[] = []

function makeEditor(content = '<p></p>'): TextEditor {
  const editor = new TextEditor({
    element: document.createElement('div'),
    content,
    extensions: [SpecialChars()],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('SpecialChars', () => {
  it('inserts a character via command', () => {
    const editor = makeEditor()
    editor.engine.commands.insertCharacter('©')
    expect(editor.getHTML()).toContain('©')
  })

  it('opens a picker dialog and inserts on click', () => {
    const editor = makeEditor()
    openCharacterPicker(editor.engine, [{ label: 'Symbols', characters: ['∆', 'β'] }], {
      title: 'Special',
    })

    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.editor-charmap__char'))
    expect(buttons).toHaveLength(2)
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Special')

    buttons[0]!.click()
    expect(editor.getHTML()).toContain('∆')
    // Dialog closes after selection by default.
    expect(document.querySelector('.editor-charmap')).toBeNull()
  })

  it('exposes charmap and emoticons toolbar buttons', () => {
    const editor = makeEditor()
    expect(editor.getToolbarItems().map((item) => item.name)).toEqual([
      'specialChars',
      'emoticons',
    ])
  })
})