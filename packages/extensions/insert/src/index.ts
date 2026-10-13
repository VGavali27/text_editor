import { Node, Extension } from '@tiptap/core'
import type { TextEditorExtension, ToolbarItem } from '@editor/plugin-api'

export interface InsertOptions {
  /** Source of "now" for the date/time command. Defaults to `new Date()`. */
  now?: () => Date
  /** Format the date/time. Defaults to `YYYY-MM-DD HH:mm`. */
  format?: (date: Date) => string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    insert: {
      /** Insert the current date/time (or a preformatted `value`). */
      insertDateTime: (value?: string) => ReturnType
      /** Insert a page-break marker. */
      insertPageBreak: () => ReturnType
      /** Insert a non-breaking space. */
      insertNonBreakingSpace: () => ReturnType
    }
  }
}

const pad = (value: number): string => String(value).padStart(2, '0')

/** Deterministic default: `YYYY-MM-DD HH:mm`. */
export function defaultFormatDateTime(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** An atomic page-break marker: `<div class="editor-page-break" data-page-break>`. */
const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-page-break]' }, { tag: 'hr.editor-page-break' }]
  },
  renderHTML() {
    return ['div', { class: 'editor-page-break', 'data-page-break': '' }]
  },
})

/** Insert date/time, page breaks and non-breaking spaces. */
export function Insert(options: InsertOptions = {}): TextEditorExtension {
  const now = options.now ?? (() => new Date())
  const format = options.format ?? defaultFormatDateTime

  const extension = Extension.create({
    name: 'insert',
    addExtensions() {
      return [PageBreak]
    },
    addCommands() {
      return {
        insertDateTime: (value?: string) => ({ commands }) =>
          commands.insertContent(value ?? format(now())),
        insertPageBreak: () => ({ commands }) => commands.insertContent({ type: 'pageBreak' }),
        insertNonBreakingSpace: () => ({ commands }) => commands.insertContent('\u00A0'),
      }
    },
  })

  const items: ToolbarItem[] = [
    {
      name: 'insertDateTime',
      label: 'Insert date/time',
      group: 'insert',
      icon: 'calendar',
      run: (e) => e.chain().focus().insertDateTime().run(),
    },
    {
      name: 'insertPageBreak',
      label: 'Page break',
      group: 'insert',
      icon: 'pageBreak',
      run: (e) => e.chain().focus().insertPageBreak().run(),
    },
    {
      name: 'insertNonBreakingSpace',
      label: 'Non-breaking space',
      group: 'insert',
      icon: 'nbsp',
      run: (e) => e.chain().focus().insertNonBreakingSpace().run(),
    },
  ]

  return { name: 'insert', tiptap: extension, toolbarItems: items }
}
