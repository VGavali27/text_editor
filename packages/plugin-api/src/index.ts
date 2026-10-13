import type { AnyExtension, Editor as TiptapEditor } from '@tiptap/core'

export type { TiptapEditor }

/** One choice inside a dropdown control. */
export interface ToolbarOption {
  /** Value passed to `run` when chosen. */
  value: string
  /** Visible text. */
  label: string
  /** Optional leading icon name. */
  icon?: string
}

/**
 * A button / control contributed by an extension and rendered by the UI shell.
 *
 * Defaults to a button. Set `options` to render a `<select>` dropdown, or
 * `type: 'color'` to render a color swatch input.
 */
export interface ToolbarItem {
  /** Stable identifier, also used as the default button label key. */
  name: string
  /** Human readable label (also the accessible name when an icon is shown). */
  label: string
  /** Optional grouping key used by the toolbar layout. */
  group?: string
  /** Optional built-in icon name (see `@editor/ui`'s icon registry). */
  icon?: string
  /** Optional keyboard hint shown in tooltips (e.g. `Ctrl+B`). */
  shortcut?: string
  /** When present, render a dropdown of choices instead of a button. */
  options?: ToolbarOption[]
  /** Current dropdown value, re-read on every refresh. */
  value?: (editor: TiptapEditor) => string | null
  /** Control kind. Defaults to `'button'`. */
  type?: 'button' | 'color'
  /** Current color (CSS value) for `type: 'color'`, re-read on every refresh. */
  color?: (editor: TiptapEditor) => string | null
  /** Whether the control reflects the current selection. */
  isActive?: (editor: TiptapEditor) => boolean
  /** Whether the control can currently be used. */
  isEnabled?: (editor: TiptapEditor) => boolean
  /**
   * Execute the command. For dropdown / color controls the chosen value is
   * passed as the second argument (`''` means "clear"). Async work should be
   * kicked off internally (the UI does not await it).
   */
  run: (editor: TiptapEditor, value?: string) => void
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
