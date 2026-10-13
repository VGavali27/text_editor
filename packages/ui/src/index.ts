import type { TextEditor } from '@editor/core'
import type { ToolbarItem } from '@editor/plugin-api'
import { createIcon } from './icons'

export interface ToolbarHandle {
  /** Re-evaluate active/enabled state for every control. */
  refresh: () => void
  /** Remove the toolbar and detach listeners. */
  destroy: () => void
}

interface MountedControl {
  item: ToolbarItem
  element: HTMLElement
  refresh: () => void
}

/** Normalise a CSS color to a 7-char hex for `<input type="color">`. */
function toHexColor(value: string | null): string {
  if (value) {
    const trimmed = value.trim()
    const hex = /^#([0-9a-f]{3,8})$/i.exec(trimmed)?.[1]
    if (hex) {
      if (hex.length === 3) {
        return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      }
      if (hex.length >= 6) return `#${hex.slice(0, 6)}`
    }
    // Browsers normalise inline colors to rgb()/rgba(), so parse those too.
    const rgb = /^rgba?\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)/i.exec(trimmed)
    if (rgb) {
      const channel = (part: string): string =>
        Math.min(255, Number(part)).toString(16).padStart(2, '0')
      return `#${channel(rgb[1]!)}${channel(rgb[2]!)}${channel(rgb[3]!)}`
    }
  }
  return '#000000'
}

function createButtonControl(editor: TextEditor, item: ToolbarItem): MountedControl {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'editor-toolbar__button'
  button.dataset.name = item.name

  const icon = item.icon ? createIcon(item.icon) : null
  if (icon) {
    button.classList.add('editor-toolbar__button--icon')
    button.appendChild(icon)
    // The icon is decorative; the label stays the accessible name.
    button.setAttribute('aria-label', item.label)
  } else {
    button.textContent = item.label
  }
  button.title = item.shortcut ? `${item.label} (${item.shortcut})` : item.label

  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', () => {
    // Commands focus the editor themselves; do not force focus here or a
    // dialog opened by the command would immediately lose focus.
    void item.run(editor.engine)
  })

  return {
    item,
    element: button,
    refresh() {
      const active = item.isActive?.(editor.engine) ?? false
      const enabled = item.isEnabled ? item.isEnabled(editor.engine) : true
      button.disabled = !enabled
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', String(active))
    },
  }
}

function createSelectControl(editor: TextEditor, item: ToolbarItem): MountedControl {
  const wrap = document.createElement('span')
  wrap.className = 'editor-toolbar__select-wrap'
  wrap.dataset.name = item.name

  const icon = item.icon ? createIcon(item.icon) : null
  if (icon) wrap.appendChild(icon)

  const select = document.createElement('select')
  select.className = 'editor-toolbar__select'
  select.setAttribute('aria-label', item.label)
  select.title = item.label

  for (const option of item.options ?? []) {
    const node = document.createElement('option')
    node.value = option.value
    node.textContent = option.label
    select.appendChild(node)
  }

  select.addEventListener('change', () => {
    void item.run(editor.engine, select.value)
  })
  wrap.appendChild(select)

  return {
    item,
    element: wrap,
    refresh() {
      const enabled = item.isEnabled ? item.isEnabled(editor.engine) : true
      select.disabled = !enabled
      const current = (item.value?.(editor.engine) ?? '') || ''
      select.value = current
    },
  }
}

function createColorControl(editor: TextEditor, item: ToolbarItem): MountedControl {
  const wrap = document.createElement('span')
  wrap.className = 'editor-toolbar__color'
  wrap.dataset.name = item.name

  const icon = item.icon ? createIcon(item.icon) : null
  if (icon) wrap.appendChild(icon)

  const input = document.createElement('input')
  input.type = 'color'
  input.className = 'editor-toolbar__color-input'
  input.setAttribute('aria-label', item.label)
  input.title = item.label
  input.addEventListener('input', () => {
    void item.run(editor.engine, input.value)
  })
  wrap.appendChild(input)

  const clear = document.createElement('button')
  clear.type = 'button'
  clear.className = 'editor-toolbar__color-clear'
  clear.textContent = '×'
  clear.setAttribute('aria-label', `Clear ${item.label}`)
  clear.title = `Clear ${item.label}`
  clear.addEventListener('mousedown', (event) => event.preventDefault())
  clear.addEventListener('click', () => {
    void item.run(editor.engine, '')
  })
  wrap.appendChild(clear)

  return {
    item,
    element: wrap,
    refresh() {
      const enabled = item.isEnabled ? item.isEnabled(editor.engine) : true
      const current = item.color?.(editor.engine) ?? null
      input.disabled = !enabled
      clear.disabled = !enabled
      clear.hidden = !current
      input.value = toHexColor(current)
    },
  }
}

/** Build the controls for `items` into `element`, separated by group. */
function mountItems(editor: TextEditor, element: HTMLElement, items: ToolbarItem[]): MountedControl[] {
  element.replaceChildren()
  const controls: MountedControl[] = []
  let lastGroup: string | undefined

  for (const item of items) {
    if (item.group && item.group !== lastGroup) {
      const separator = document.createElement('span')
      separator.className = 'editor-toolbar__separator'
      separator.setAttribute('role', 'separator')
      element.appendChild(separator)
    }
    lastGroup = item.group

    const control =
      item.options?.length
        ? createSelectControl(editor, item)
        : item.type === 'color'
          ? createColorControl(editor, item)
          : createButtonControl(editor, item)

    element.appendChild(control.element)
    controls.push(control)
  }

  return controls
}

function refreshItems(controls: MountedControl[]): void {
  for (const control of controls) control.refresh()
}

/**
 * Render a fixed, headless toolbar into `element` from the editor's registered
 * extension items. Styling comes from `@editor/ui/styles.css`.
 */
export function createToolbar(
  editor: TextEditor,
  element: HTMLElement,
  items: ToolbarItem[] = editor.getToolbarItems(),
): ToolbarHandle {
  element.classList.add('editor-toolbar')
  element.setAttribute('role', 'toolbar')
  element.setAttribute('aria-orientation', 'horizontal')

  const controls = mountItems(editor, element, items)
  const refresh = (): void => refreshItems(controls)

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

export interface BubbleToolbarOptions {
  /** Items to show. Defaults to the editor's registered items. */
  items?: ToolbarItem[]
  /** Hide when the selection is collapsed. Defaults to `true`. */
  hideWhenEmpty?: boolean
}

/**
 * A contextual toolbar that floats above a non-empty selection. Shares the same
 * button rendering (and styling) as {@link createToolbar}.
 */
export function createBubbleToolbar(
  editor: TextEditor,
  options: BubbleToolbarOptions = {},
): ToolbarHandle {
  const hideWhenEmpty = options.hideWhenEmpty ?? true

  const element = document.createElement('div')
  element.className = 'editor-bubble'
  element.setAttribute('role', 'toolbar')
  element.setAttribute('aria-orientation', 'horizontal')
  element.hidden = true
  document.body.appendChild(element)

  const controls = mountItems(editor, element, options.items ?? editor.getToolbarItems())
  const refresh = (): void => refreshItems(controls)

  const update = (): void => {
    const selection = window.getSelection()
    const isEmpty = editor.engine.state.selection.empty
    if ((hideWhenEmpty && isEmpty) || !selection || selection.rangeCount === 0) {
      element.hidden = true
      return
    }
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      element.hidden = true
      return
    }
    element.hidden = false
    element.style.left = `${window.scrollX + rect.left + rect.width / 2}px`
    element.style.top = `${window.scrollY + rect.top}px`
  }

  const onSelectionUpdate = (): void => {
    refresh()
    update()
  }

  editor.engine.on('transaction', refresh)
  editor.engine.on('selectionUpdate', onSelectionUpdate)
  window.addEventListener('scroll', update, true)
  window.addEventListener('resize', update)

  refresh()

  return {
    refresh,
    destroy() {
      editor.engine.off('transaction', refresh)
      editor.engine.off('selectionUpdate', onSelectionUpdate)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      element.remove()
    },
  }
}

/* ------------------------------------------------------------------ dialogs */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface DialogOptions {
  /** Accessible label for the dialog. */
  label?: string
  /** Element to focus when the dialog opens. Defaults to the first focusable. */
  initialFocus?: HTMLElement
  /** Called when the dialog is dismissed (Esc, backdrop, or `close()`). */
  onClose?: () => void
  /** Close when the backdrop is clicked. Defaults to `true`. */
  closeOnBackdrop?: boolean
}

export interface DialogHandle {
  /** The dialog panel element (not the overlay). */
  element: HTMLElement
  /** Close the dialog. */
  close: () => void
}

let openDialogCount = 0

/**
 * Open an accessible modal dialog containing `content`. Traps focus, restores
 * it on close, closes on Esc, and locks body scroll while open.
 */
export function openDialog(content: HTMLElement, options: DialogOptions = {}): DialogHandle {
  const previouslyFocused = document.activeElement as HTMLElement | null
  const overlay = document.createElement('div')
  overlay.className = 'editor-dialog-overlay'

  const panel = document.createElement('div')
  panel.className = 'editor-dialog'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  if (options.label) panel.setAttribute('aria-label', options.label)
  panel.appendChild(content)
  overlay.appendChild(panel)

  let closed = false
  const close = (): void => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKeyDown, true)
    overlay.remove()
    openDialogCount = Math.max(0, openDialogCount - 1)
    if (openDialogCount === 0) document.body.style.overflow = ''
    previouslyFocused?.focus?.()
    options.onClose?.()
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (options.closeOnBackdrop ?? true) {
    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) close()
    })
  }

  document.body.style.overflow = 'hidden'
  openDialogCount += 1
  document.body.appendChild(overlay)
  document.addEventListener('keydown', onKeyDown, true)

  const initial =
    options.initialFocus ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel
  initial.focus()

  return { element: panel, close }
}

export interface TextPromptOptions {
  title?: string
  label?: string
  value?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Allow submitting an empty value (resolves with `''`). Defaults to `false`. */
  allowEmpty?: boolean
}

/**
 * Ask the user for a single line of text. Resolves with the entered string, an
 * empty string if `allowEmpty`, or `null` when cancelled.
 */
export function requestText(options: TextPromptOptions = {}): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false

    const form = document.createElement('form')
    form.className = 'editor-dialog__form'
    form.noValidate = true

    const field = document.createElement('label')
    field.className = 'editor-dialog__field'
    const label = document.createElement('span')
    label.className = 'editor-dialog__label'
    label.textContent = options.label ?? options.title ?? 'Value'
    const input = document.createElement('input')
    input.className = 'editor-dialog__input'
    input.type = 'text'
    input.value = options.value ?? ''
    if (options.placeholder) input.placeholder = options.placeholder
    field.append(label, input)
    form.appendChild(field)

    const actions = document.createElement('div')
    actions.className = 'editor-dialog__actions'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'editor-dialog__button'
    cancel.textContent = options.cancelLabel ?? 'Cancel'
    const confirm = document.createElement('button')
    confirm.type = 'submit'
    confirm.className = 'editor-dialog__button editor-dialog__button--primary'
    confirm.textContent = options.confirmLabel ?? 'Apply'
    actions.append(cancel, confirm)
    form.appendChild(actions)

    const dialog = openDialog(form, {
      label: options.title ?? options.label ?? 'Enter value',
      initialFocus: input,
      onClose: () => {
        if (!settled) {
          settled = true
          resolve(null)
        }
      },
    })

    const submit = (): void => {
      const value = input.value.trim()
      if (!value && !options.allowEmpty) {
        input.focus()
        return
      }
      settled = true
      dialog.close()
      resolve(value)
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      submit()
    })
    cancel.addEventListener('click', () => dialog.close())
    input.select()
  })
}

/* --------------------------------------------------------------- re-exports */

export { createIcon, hasIcon, iconMarkup, iconNames, iconSvgs } from './icons'
export type { IconName } from './icons'
export { createMenuBar } from './menu'
export type { Menu, MenuBarHandle, MenuBarOptions, MenuItem } from './menu'
