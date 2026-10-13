import { Extension } from '@tiptap/core'
import type { TextEditorExtension, TiptapEditor, ToolbarItem } from '@editor/plugin-api'

export type Align = 'left' | 'center' | 'right' | 'justify'

export interface AlignOptions {
  /** Node types alignment applies to. Defaults to paragraphs and headings. */
  types?: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    align: {
      /** Align the selected block node(s). */
      setTextAlign: (align: Align) => ReturnType
      /** Remove explicit alignment (back to the stylesheet default). */
      unsetTextAlign: () => ReturnType
    }
  }
}

const DIRECTIONS: Align[] = ['left', 'center', 'right', 'justify']

const LABELS: Record<Align, string> = {
  left: 'Align left',
  center: 'Align center',
  right: 'Align right',
  justify: 'Justify',
}

const ICONS: Record<Align, string> = {
  left: 'alignLeft',
  center: 'alignCenter',
  right: 'alignRight',
  justify: 'alignJustify',
}

/**
 * Text alignment. Applies a `textAlign` attribute to the configured block nodes
 * and renders it as an inline `text-align` style (sanitizer-safe).
 */
export function Align(options: AlignOptions = {}): TextEditorExtension {
  const types = options.types ?? ['paragraph', 'heading']

  const activeAlign = (editor: TiptapEditor): Align | null =>
    DIRECTIONS.find((align) => editor.isActive({ textAlign: align })) ?? null

  const items: ToolbarItem[] = DIRECTIONS.map((align) => ({
    name: `align${align[0]!.toUpperCase()}${align.slice(1)}`,
    label: LABELS[align],
    group: 'align',
    icon: ICONS[align],
    // With no explicit alignment the block is effectively left-aligned.
    isActive: (e) => activeAlign(e) === align || (align === 'left' && activeAlign(e) === null),
    run: (e) => e.chain().focus().setTextAlign(align).run(),
  }))

  const extension = Extension.create({
    name: 'align',
    addGlobalAttributes() {
      return [
        {
          types,
          attributes: {
            textAlign: {
              default: null,
              parseHTML: (element) =>
                element.style.textAlign || element.getAttribute('data-text-align') || null,
              renderHTML: (attributes) =>
                attributes.textAlign ? { style: `text-align: ${String(attributes.textAlign)}` } : {},
            },
          },
        },
      ]
    },
    addCommands() {
      return {
        setTextAlign: (align: Align) => ({ commands }) =>
          types.every((type) => commands.updateAttributes(type, { textAlign: align })),
        unsetTextAlign: () => ({ commands }) =>
          types.every((type) => commands.updateAttributes(type, { textAlign: null })),
      }
    },
  })

  return { name: 'align', tiptap: extension, toolbarItems: items }
}
