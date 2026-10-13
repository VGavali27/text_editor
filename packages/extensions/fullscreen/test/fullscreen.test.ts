import { afterEach, describe, expect, it } from 'vitest'
import { TextEditor } from '@editor/core'
import { Fullscreen, isFullscreen } from '@editor/extension-fullscreen'

const editors: TextEditor[] = []

function makeEditor(): TextEditor {
  const host = document.createElement('div')
  const editor = new TextEditor({
    element: host,
    content: '<p>Hi</p>',
    extensions: [Fullscreen()],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('Fullscreen', () => {
  it('toggles a fullscreen class on the host', () => {
    const editor = makeEditor()
    const host = editor.engine.view.dom.parentElement!
    expect(host.classList.contains('editor--fullscreen')).toBe(false)

    editor.engine.commands.toggleFullscreen()
    expect(host.classList.contains('editor--fullscreen')).toBe(true)
    expect(isFullscreen(editor.engine)).toBe(true)

    editor.engine.commands.setFullscreen(false)
    expect(host.classList.contains('editor--fullscreen')).toBe(false)
  })

  it('supports an explicit target element', () => {
    const target = document.createElement('section')
    const editor = new TextEditor({
      element: document.createElement('div'),
      content: '<p>Hi</p>',
      extensions: [Fullscreen({ target: () => target })],
    })
    editors.push(editor)
    editor.engine.commands.setFullscreen(true)
    expect(target.classList.contains('editor--fullscreen')).toBe(true)
  })

  it('exposes a fullscreen toolbar button', () => {
    const editor = makeEditor()
    expect(editor.getToolbarItems().map((item) => item.name)).toEqual(['fullscreen'])
  })
})