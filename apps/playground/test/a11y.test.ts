import { afterEach, describe, expect, it } from 'vitest'
import { TextEditor } from '@editor/core'
import type { ToolbarItem } from '@editor/core'
import { Comments, createCommentPanel } from '@editor/extension-comments'
import { Styling } from '@editor/extension-styling'
import {
  createBubbleToolbar,
  createIcon,
  createMenuBar,
  createToolbar,
  hasIcon,
  iconNames,
  openDialog,
  requestText,
} from '@editor/ui'

const editors: TextEditor[] = []
const nodes: HTMLElement[] = []

function track<T extends HTMLElement>(element: T): T {
  nodes.push(element)
  return element
}

function makeEditor(): TextEditor {
  const editor = new TextEditor({
    element: track(document.createElement('div')),
    content: '<p>Hello world</p>',
    extensions: [Styling(), Comments({ author: 'Bob' })],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
  while (nodes.length) nodes.pop()?.remove()
  document.querySelectorAll('.editor-dialog-overlay').forEach((node) => node.remove())
  document.body.style.overflow = ''
})

describe('toolbar a11y', () => {
  it('exposes a labelled toolbar with toggle state', () => {
    const editor = makeEditor()
    const element = track(document.createElement('div'))
    const handle = createToolbar(editor, element)

    expect(element.getAttribute('role')).toBe('toolbar')
    expect(element.getAttribute('aria-orientation')).toBe('horizontal')

    const buttons = Array.from(element.querySelectorAll('button'))
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button.getAttribute('aria-pressed')).toMatch(/^(true|false)$/)
      // Icon-only buttons keep their accessible name in aria-label.
      const name = button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''
      expect(name.length).toBeGreaterThan(0)
    }
    expect(element.querySelector('[role="separator"]')).toBeTruthy()
    handle.destroy()
  })

  it('exposes the bubble toolbar and starts hidden', () => {
    const editor = makeEditor()
    const handle = createBubbleToolbar(editor, {
      items: editor.getToolbarItems().filter((item) => item.name === 'bold'),
    })
    const bubble = document.body.querySelector('.editor-bubble')
    expect(bubble?.getAttribute('role')).toBe('toolbar')
    expect((bubble as HTMLElement | null)?.hidden).toBe(true)
    handle.destroy()
  })

  it('renders icon buttons with the label as their accessible name', () => {
    const editor = makeEditor()
    const element = track(document.createElement('div'))
    const handle = createToolbar(editor, element)

    const bold = element.querySelector<HTMLButtonElement>('button[data-name="bold"]')
    expect(bold).toBeTruthy()
    expect(bold?.getAttribute('aria-label')).toBe('Bold')
    expect(bold?.querySelector('svg.editor-icon')).toBeTruthy()
    expect(bold?.title).toContain('Ctrl+B')

    handle.destroy()
  })

  it('renders dropdown and color controls with the item label', () => {
    const editor = makeEditor()
    const element = track(document.createElement('div'))
    const items: ToolbarItem[] = [
      {
        name: 'marker',
        label: 'Marker style',
        options: [
          { value: 'disc', label: 'Disc' },
          { value: 'circle', label: 'Circle' },
        ],
        value: () => 'circle',
        run: () => {},
      },
      {
        name: 'tint',
        label: 'Tint',
        type: 'color',
        icon: 'palette',
        color: () => '#ff8800',
        run: () => {},
      },
    ]
    const handle = createToolbar(editor, element, items)

    const select = element.querySelector('select')
    expect(select?.getAttribute('aria-label')).toBe('Marker style')
    expect(select?.value).toBe('circle')

    const color = element.querySelector<HTMLInputElement>('input[type="color"]')
    expect(color?.getAttribute('aria-label')).toBe('Tint')
    expect(color?.value).toBe('#ff8800')

    // Clear is hidden while a color is set; shown once populated.
    const clear = element.querySelector<HTMLButtonElement>('.editor-toolbar__color-clear')
    expect(clear?.getAttribute('aria-label')).toBe('Clear Tint')

    handle.destroy()
  })
})

describe('icon registry', () => {
  it('provides built-in SVG icons and rejects unknown names', () => {
    expect(iconNames()).toContain('bold')
    expect(hasIcon('bold')).toBe(true)
    expect(hasIcon('does-not-exist')).toBe(false)

    const icon = createIcon('bold')
    expect(icon?.tagName.toLowerCase()).toBe('svg')
    expect(icon?.querySelector('path')).toBeTruthy()
    expect(createIcon('does-not-exist')).toBeNull()
  })
})

describe('menu bar a11y', () => {
  it('is an accessible menubar and runs the activated item', () => {
    const editor = makeEditor()
    const host = track(document.createElement('div'))
    let clicked = 0
    const handle = createMenuBar(editor, host, [
      { label: 'Insert', items: [{ label: 'Divider', icon: 'hr', run: () => (clicked += 1) }] },
    ])

    expect(host.getAttribute('role')).toBe('menubar')
    const top = host.querySelector<HTMLButtonElement>('.editor-menubar__button')
    expect(top?.getAttribute('aria-haspopup')).toBe('true')
    expect(top?.getAttribute('aria-expanded')).toBe('false')

    top?.click()
    expect(top?.getAttribute('aria-expanded')).toBe('true')

    const popup = host.querySelector<HTMLElement>('.editor-menu')
    expect(popup?.hidden).toBe(false)

    const item = popup?.querySelector<HTMLButtonElement>('.editor-menu__item')
    expect(item?.querySelector('svg.editor-icon')).toBeTruthy()
    expect(item?.getAttribute('role')).toBe('menuitem')

    item?.click()
    expect(clicked).toBe(1)
    expect(popup?.hidden).toBe(true)

    handle.destroy()
    expect(host.querySelector('.editor-menubar__button')).toBeNull()
  })

  it('supports keyboard navigation and disabled/checked state', () => {
    const editor = makeEditor()
    const host = track(document.createElement('div'))
    document.body.appendChild(host)
    const handle = createMenuBar(editor, host, [
      {
        label: 'Edit',
        items: [
          { label: 'Disabled', disabled: () => true, run: () => {} },
          { label: 'Toggle', checked: () => true, run: () => {} },
        ],
      },
    ])

    const top = host.querySelector<HTMLButtonElement>('.editor-menubar__button')!
    const items = Array.from(host.querySelectorAll<HTMLButtonElement>('.editor-menu__item'))
    expect(items[0]?.getAttribute('aria-disabled')).toBe('true')
    expect(items[1]?.getAttribute('role')).toBe('menuitemcheckbox')
    expect(items[1]?.getAttribute('aria-checked')).toBe('true')

    top.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(host.querySelector('.editor-menu')?.hasAttribute('hidden')).toBe(false)
    expect(document.activeElement).toBe(items[0])

    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    )
    expect(document.activeElement).toBe(items[1])

    handle.destroy()
  })
})

describe('dialog a11y', () => {
  it('marks the dialog modal and labelled, and restores focus on close', () => {
    const trigger = track(document.createElement('button'))
    document.body.appendChild(trigger)
    trigger.focus()

    const content = document.createElement('div')
    const confirm = document.createElement('button')
    confirm.textContent = 'Confirm'
    content.appendChild(confirm)

    const dialog = openDialog(content, { label: 'Confirm action' })
    expect(dialog.element.getAttribute('role')).toBe('dialog')
    expect(dialog.element.getAttribute('aria-modal')).toBe('true')
    expect(dialog.element.getAttribute('aria-label')).toBe('Confirm action')
    expect(document.activeElement).toBe(confirm)
    expect(document.body.style.overflow).toBe('hidden')

    dialog.close()
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).toBe('')
  })

  it('closes on Escape', () => {
    const content = document.createElement('div')
    const button = document.createElement('button')
    button.textContent = 'x'
    content.appendChild(button)
    openDialog(content, { label: 'Test' })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('traps Tab focus inside the dialog', () => {
    const content = document.createElement('div')
    const first = document.createElement('button')
    first.textContent = 'first'
    const last = document.createElement('button')
    last.textContent = 'last'
    content.append(first, last)
    const dialog = openDialog(content, { label: 'Trap' })

    last.focus()
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(first)

    first.focus()
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(last)

    dialog.close()
  })
})

describe('requestText a11y', () => {
  it('focuses a labelled input and resolves the submitted value', async () => {
    const pending = requestText({ title: 'Link', label: 'URL', value: 'https://a' })
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.getAttribute('aria-label')).toBe('Link')

    const input = dialog?.querySelector('input')
    expect(input?.value).toBe('https://a')
    expect(document.activeElement).toBe(input)

    if (input) input.value = 'https://example.com'
    const form = dialog?.querySelector('form')
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await expect(pending).resolves.toBe('https://example.com')
  })

  it('resolves null when cancelled', async () => {
    const pending = requestText({ title: 'Prompt' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await expect(pending).resolves.toBeNull()
  })
})

describe('comment panel a11y', () => {
  it('is a labelled live region with uniquely-named controls', () => {
    const editor = makeEditor()
    const host = track(document.createElement('div'))
    editor.engine.commands.setTextSelection({ from: 1, to: 6 })
    editor.engine.commands.addComment('note')

    const panel = createCommentPanel(editor, host, { onRequestReply: () => 'reply' })
    const region = host.querySelector('[role="region"]')
    expect(region?.getAttribute('aria-label')).toBe('Comments')
    expect(region?.getAttribute('aria-live')).toBe('polite')

    const show = host.querySelector<HTMLButtonElement>('button[aria-label^="Show"]')
    const reply = host.querySelector<HTMLButtonElement>('button[aria-label^="Reply"]')
    const resolve = host.querySelector<HTMLButtonElement>('button[aria-label^="Resolve"]')
    const remove = host.querySelector<HTMLButtonElement>('button[aria-label^="Delete"]')
    for (const button of [show, reply, resolve, remove]) {
      expect(button).toBeTruthy()
      expect(button!.getAttribute('aria-label')).toContain('Bob')
    }

    panel.destroy()
    expect(host.querySelector('[role="region"]')).toBeNull()
  })
})
