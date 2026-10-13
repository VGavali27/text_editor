import { afterEach, describe, expect, it } from 'vitest'
import { TextEditor } from '@editor/core'
import { Help, openHelp } from '@editor/extension-help'

const editors: TextEditor[] = []

function makeEditor(): TextEditor {
  const editor = new TextEditor({
    element: document.createElement('div'),
    content: '<p>Hi</p>',
    extensions: [Help()],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('Help', () => {
  it('opens the built-in help dialog', () => {
    const editor = makeEditor()
    editor.getToolbarItems().find((item) => item.name === 'help')!.run(editor.engine)
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(dialog!.getAttribute('aria-label')).toBe('Help')
    // A shortcut reference is rendered.
    expect(dialog!.textContent).toContain('Ctrl + B')
    // Dismiss so later tests see a clean DOM.
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
  })

  it('renders custom sections via openHelp', () => {
    makeEditor()
    openHelp(editors[0]!.engine, {
      title: 'Shortcuts',
      sections: [{ heading: 'Mine', lines: [['Copy', 'Ctrl+C']] }],
    })
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'))
    const dialog = dialogs[dialogs.length - 1]!
    expect(dialog.getAttribute('aria-label')).toBe('Shortcuts')
    expect(dialog.textContent).toContain('Ctrl+C')
  })

  it('exposes a help toolbar button', () => {
    const editor = makeEditor()
    expect(editor.getToolbarItems().map((item) => item.name)).toEqual(['help'])
  })
})