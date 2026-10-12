import { Editor } from '@tiptap/core'
import type { Extensions } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import type {
  TextEditorExtension,
  TextEditorOptions,
  ToolbarItem,
} from '@editor/plugin-api'

/**
 * The public editor. Internals (TipTap / ProseMirror) stay hidden; consumers
 * interact only with this class and the extension contract.
 */
export class TextEditor {
  /** Underlying engine instance. Exposed for UI/adapters, not for end users. */
  readonly engine: Editor

  private readonly options: TextEditorOptions
  private readonly _extensions: TextEditorExtension[]

  constructor(options: TextEditorOptions) {
    if (!options?.element) {
      throw new Error('TextEditor: option "element" is required')
    }

    this.options = options
    this._extensions = options.extensions ?? []

    const engineExtensions: Extensions = [
      Document,
      Paragraph,
      Text,
      ...this._extensions.flatMap((ext) =>
        Array.isArray(ext.tiptap) ? ext.tiptap : [ext.tiptap],
      ),
    ]

    this.engine = new Editor({
      element: options.element,
      content: options.content ?? '',
      editable: options.editable ?? true,
      extensions: engineExtensions,
      onUpdate: ({ editor }) => this.options.onChange?.(editor.getHTML()),
      onFocus: () => this.options.onFocus?.(),
      onBlur: () => this.options.onBlur?.(),
    })
  }

  /** Extensions this editor was configured with. */
  get extensions(): readonly TextEditorExtension[] {
    return this._extensions
  }

  get isEditable(): boolean {
    return this.engine.isEditable
  }

  /** All toolbar controls contributed by the enabled extensions. */
  getToolbarItems(): ToolbarItem[] {
    return this._extensions.flatMap((ext) => ext.toolbarItems ?? [])
  }

  /** Working document as sanitized-ready HTML. */
  getHTML(): string {
    return this.engine.getHTML()
  }

  getJSON(): unknown {
    return this.engine.getJSON()
  }

  /** Replace the whole document. */
  setHTML(html: string): void {
    this.engine.commands.setContent(html, true)
  }

  setEditable(editable: boolean): void {
    this.engine.setEditable(editable)
  }

  focus(): void {
    this.engine.commands.focus()
  }

  destroy(): void {
    this.engine.destroy()
  }
}

export type {
  TextEditorExtension,
  TextEditorOptions,
  ToolbarItem,
} from '@editor/plugin-api'
