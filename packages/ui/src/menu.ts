import type { TextEditor } from '@editor/core'
import { createIcon } from './icons'

/** A single entry in a dropdown menu. */
export interface MenuItem {
  /** Visible label. */
  label: string
  /** Optional built-in icon name. */
  icon?: string
  /** Optional shortcut hint shown on the right (e.g. `Ctrl+B`). */
  shortcut?: string
  /** Run when the item is activated. */
  run?: (editor: TextEditor) => void
  /** Disabled state; a function is re-evaluated on every refresh. */
  disabled?: boolean | ((editor: TextEditor) => boolean)
  /** Checked state (renders a `menuitemcheckbox`); re-evaluated on refresh. */
  checked?: boolean | ((editor: TextEditor) => boolean)
  /** Draw a divider above this item. */
  separatorBefore?: boolean
}

/** A top-level menu (e.g. File / Edit / Insert). */
export interface Menu {
  label: string
  items: MenuItem[]
}

export interface MenuBarOptions {
  /** Called just before a menu opens (e.g. to rebuild dynamic items). */
  onOpen?: (menu: Menu) => void
}

export interface MenuBarHandle {
  /** Re-evaluate every item's disabled / checked state. */
  refresh: () => void
  /** Close any open menu. */
  close: () => void
  /** Remove the menu bar and detach listeners. */
  destroy: () => void
}

interface ItemControl {
  item: MenuItem
  node: HTMLButtonElement
}

interface Entry {
  menu: Menu
  wrap: HTMLElement
  button: HTMLButtonElement
  popup: HTMLElement
  items: ItemControl[]
}

function resolve(
  value: boolean | ((editor: TextEditor) => boolean) | undefined,
  editor: TextEditor,
): boolean {
  return typeof value === 'function' ? value(editor) : value === true
}

/**
 * Render a TinyMCE-style menu bar (File / Edit / Insert …) from plain data.
 * Accessible: `role="menubar"` / `menu` / `menuitem`, arrow-key navigation,
 * Home/End, Esc to close, and click-outside dismissal.
 */
export function createMenuBar(
  editor: TextEditor,
  element: HTMLElement,
  menus: Menu[],
  options: MenuBarOptions = {},
): MenuBarHandle {
  element.classList.add('editor-menubar')
  element.setAttribute('role', 'menubar')

  const entries: Entry[] = []
  let openIndex = -1

  const close = (): void => {
    if (openIndex < 0) return
    const entry = entries[openIndex]
    openIndex = -1
    if (!entry) return
    entry.popup.hidden = true
    entry.button.setAttribute('aria-expanded', 'false')
    entry.button.classList.remove('is-open')
    entry.wrap.classList.remove('is-open')
  }

  const focusItem = (entry: Entry, index: number): void => {
    const count = entry.items.length
    if (!count) return
    entry.items[((index % count) + count) % count]?.node.focus()
  }

  const open = (index: number, focusFirst: boolean): void => {
    if (openIndex === index) {
      if (focusFirst) focusItem(entries[index]!, 0)
      return
    }
    close()
    const entry = entries[index]
    if (!entry) return
    openIndex = index
    options.onOpen?.(entry.menu)
    entry.popup.hidden = false
    entry.button.setAttribute('aria-expanded', 'true')
    entry.button.classList.add('is-open')
    entry.wrap.classList.add('is-open')
    if (focusFirst) focusItem(entry, 0)
  }

  const moveTop = (delta: number): void => {
    const count = entries.length
    if (!count) return
    if (openIndex >= 0) {
      open((openIndex + delta + count) % count, true)
      return
    }
    const from = entries.findIndex((entry) => entry.button === document.activeElement)
    const next = (((from < 0 ? 0 : from) + delta) % count + count) % count
    entries[next]?.button.focus()
  }

  for (const menu of menus) {
    const index = entries.length

    const wrap = document.createElement('div')
    wrap.className = 'editor-menubar__item'

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'editor-menubar__button'
    button.textContent = menu.label
    button.setAttribute('aria-haspopup', 'true')
    button.setAttribute('aria-expanded', 'false')

    const popup = document.createElement('div')
    popup.className = 'editor-menu'
    popup.setAttribute('role', 'menu')
    popup.setAttribute('aria-label', menu.label)
    popup.hidden = true

    const items: ItemControl[] = []

    for (const item of menu.items) {
      if (item.separatorBefore) {
        const separator = document.createElement('div')
        separator.className = 'editor-menu__separator'
        separator.setAttribute('role', 'separator')
        popup.appendChild(separator)
      }

      const node = document.createElement('button')
      node.type = 'button'
      node.className = 'editor-menu__item'
      const hasChecked = item.checked !== undefined
      node.setAttribute('role', hasChecked ? 'menuitemcheckbox' : 'menuitem')

      const icon = item.icon ? createIcon(item.icon) : null
      if (icon) node.appendChild(icon)

      const label = document.createElement('span')
      label.className = 'editor-menu__label'
      label.textContent = item.label
      node.appendChild(label)

      if (item.shortcut) {
        const shortcut = document.createElement('span')
        shortcut.className = 'editor-menu__shortcut'
        shortcut.textContent = item.shortcut
        node.appendChild(shortcut)
      }

      node.addEventListener('click', () => {
        if (resolve(item.disabled, editor)) return
        close()
        item.run?.(editor)
      })

      popup.appendChild(node)
      items.push({ item, node })
    }

    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', (event) => {
      event.preventDefault()
      if (openIndex === index) close()
      else open(index, false)
    })
    wrap.addEventListener('mouseenter', () => {
      if (openIndex >= 0 && openIndex !== index) open(index, false)
    })
    button.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open(index, true)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        open(index, true)
        focusItem(entries[index]!, entries[index]!.items.length - 1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveTop(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveTop(-1)
      } else if (event.key === 'Escape') {
        close()
      }
    })

    popup.addEventListener('keydown', (event) => {
      const entry = entries[index]!
      const active = entry.items.findIndex((control) => control.node === document.activeElement)
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusItem(entry, active + 1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusItem(entry, active - 1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        focusItem(entry, 0)
      } else if (event.key === 'End') {
        event.preventDefault()
        focusItem(entry, entry.items.length - 1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveTop(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveTop(-1)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        close()
        button.focus()
      } else if (event.key === 'Tab') {
        close()
      }
    })

    wrap.append(button, popup)
    element.appendChild(wrap)
    entries.push({ menu, wrap, button, popup, items })
  }

  const onDocumentMouseDown = (event: MouseEvent): void => {
    if (!element.contains(event.target as Node)) close()
  }
  document.addEventListener('mousedown', onDocumentMouseDown, true)

  const refresh = (): void => {
    for (const entry of entries) {
      for (const { item, node } of entry.items) {
        const disabled = resolve(item.disabled, editor)
        node.setAttribute('aria-disabled', String(disabled))
        node.classList.toggle('is-disabled', disabled)
        if (item.checked !== undefined) {
          node.setAttribute('aria-checked', String(resolve(item.checked, editor)))
        }
      }
    }
  }

  editor.engine.on('transaction', refresh)
  refresh()

  return {
    refresh,
    close,
    destroy() {
      editor.engine.off('transaction', refresh)
      document.removeEventListener('mousedown', onDocumentMouseDown, true)
      element.replaceChildren()
    },
  }
}
