import { Extension } from '@tiptap/core'
import { openDialog } from '@editor/ui'
import type { TextEditorExtension, TiptapEditor, ToolbarItem } from '@editor/plugin-api'

export interface HelpContent {
  heading: string
  lines: Array<[string, string]> // [action, shortcut]
}

export interface HelpOptions {
  /** When set, a host dialog is used instead of the built-in one. */
  onRequest?: () => void
  /** Custom content; defaults to a built-in shortcut reference. */
  sections?: HelpContent[]
  /** Title of the help dialog. */
  title?: string
}

const DEFAULT_SECTIONS: HelpContent[] = [
  {
    heading: 'Formatting',
    lines: [
      ['Bold', 'Ctrl + B'],
      ['Italic', 'Ctrl + I'],
      ['Underline', 'Ctrl + U'],
      ['Strikethrough', 'Ctrl + Shift + S'],
      ['Inline code', 'Ctrl + E'],
      ['Clear formatting', 'Edit → Clear formatting'],
    ],
  },
  {
    heading: 'Editing',
    lines: [
      ['Undo', 'Ctrl + Z'],
      ['Redo', 'Ctrl + Shift + Z'],
      ['Select all', 'Ctrl + A'],
      ['Find and replace', 'Ctrl + F'],
    ],
  },
  {
    heading: 'Links',
    lines: [
      ['Insert link', 'Ctrl + K'],
      ['Open link', 'Ctrl + Click'],
    ],
  },
  {
    heading: 'Lists',
    lines: [
      ['Bullet list', 'Ctrl + Shift + 8'],
      ['Ordered list', 'Ctrl + Shift + 7'],
    ],
  },
]

/**
 * Help / about dialog listing the editor's keyboard shortcuts. `openHelp` is
 * also exported for hosts that want to trigger the dialog directly.
 */
export function Help(options: HelpOptions = {}): TextEditorExtension {
  const sections = options.sections ?? DEFAULT_SECTIONS

  const extension = Extension.create({ name: 'help' })

  const items: ToolbarItem[] = [
    {
      name: 'help',
      label: 'Help',
      group: 'help',
      icon: 'help',
      run: (e) => {
        if (options.onRequest) {
          options.onRequest()
          return
        }
        openHelp(e, { sections, title: options.title })
      },
    },
  ]

  return { name: 'help', tiptap: extension, toolbarItems: items }
}

export function openHelp(
  editor: TiptapEditor,
  options: HelpOptions = {},
): void {
  const content = document.createElement('div')
  content.className = 'editor-help'

  for (const section of options.sections ?? DEFAULT_SECTIONS) {
    const heading = document.createElement('h3')
    heading.className = 'editor-help__heading'
    heading.textContent = section.heading
    content.appendChild(heading)

    const table = document.createElement('table')
    table.className = 'editor-help__table'
    const body = document.createElement('tbody')
    for (const [action, shortcut] of section.lines) {
      const row = document.createElement('tr')
      const actionCell = document.createElement('td')
      actionCell.textContent = action
      const shortcutCell = document.createElement('td')
      shortcutCell.textContent = shortcut
      row.append(actionCell, shortcutCell)
      body.appendChild(row)
    }
    table.appendChild(body)
    content.appendChild(table)
  }

  openDialog(content, { label: options.title ?? 'Help' })
}