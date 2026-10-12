import type { AnyExtension, Editor as TiptapEditor } from '@tiptap/core'

export type { TiptapEditor }

/**
 * A button / control contributed by an extension and rendered by the UI shell.
 */
export interface ToolbarItem {
  /** Stable identifier, also used as the default button label key. */
  name: string
  /** Human readable label. */
  label: string
  /** Optional grouping key used by the toolbar layout. */
  group?: string
  /** Whether the control reflects the current selection. */
  isActive?: (editor: TiptapEditor) => boolean
  /** Whether the control can currently be used. */
  isEnabled?: (editor: TiptapEditor) => boolean
  /**
   * Execute the command. Async work should be kicked off internally (the UI
   * does not await it), e.g. `void (async () => { … })()`.
   */
  run: (editor: TiptapEditor) => void
}

/**
 * The public extension contract. Every optional feature is expressed as one of
 * these. The underlying engine (TipTap) stays hidden behind `tiptap`.
 */
export interface TextEditorExtension {
  /** Unique name of the extension. */
  name: string
  /** One or more engine extensions this feature contributes. */
  tiptap: AnyExtension | AnyExtension[]
  /** Optional toolbar controls. */
  toolbarItems?: ToolbarItem[]
}

export interface TextEditorOptions {
  /** Host element the editor is mounted into. */
  element: HTMLElement
  /** Initial content (HTML string). */
  content?: string
  /** Opt-in extensions, in the order they should be applied. */
  extensions?: TextEditorExtension[]
  /** Whether the document is editable. Defaults to `true`. */
  editable?: boolean
  /** Called whenever the document content changes. */
  onChange?: (html: string) => void
  onFocus?: () => void
  onBlur?: () => void
}
