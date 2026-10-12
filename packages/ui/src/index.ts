import type { TextEditor } from '@editor/core'
import type { ToolbarItem } from '@editor/plugin-api'

export interface ToolbarHandle {
  /** Re-evaluate active/enabled state for every button. */
  refresh: () => void
  /** Remove the toolbar and detach listeners. */
  destroy: () => void
}

/**
 * Render a headless toolbar into `element` from the editor's registered
 * extension items. Styling is left to the host via CSS classes.
 */
export function createToolbar(
  editor: TextEditor,
  element: HTMLElement,
  items: ToolbarItem[] = editor.getToolbarItems(),
): ToolbarHandle {
  element.classList.add('editor-toolbar')
  element.setAttribute('role', 'toolbar')

  const controls = items.map((item) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'editor-toolbar__button'
    button.dataset.name = item.name
    button.textContent = item.label
    button.title = item.label
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => {
      item.run(editor.engine)
      editor.focus()
    })
    element.appendChild(button)
    return { item, button }
  })

  const refresh = (): void => {
    for (const { item, button } of controls) {
      const active = item.isActive?.(editor.engine) ?? false
      const enabled = item.isEnabled ? item.isEnabled(editor.engine) : true
      button.disabled = !enabled
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', String(active))
    }
  }

  editor.engine.on('transaction', refresh)
  editor.engine.on('selectionUpdate', refresh)
  refresh()

  return {
    refresh,
    destroy() {
      editor.engine.off('transaction', refresh)
      editor.engine.off('selectionUpdate', refresh)
      element.replaceChildren()
    },
  }
}
