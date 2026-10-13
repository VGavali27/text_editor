import { Extension } from '@tiptap/core'
import type { TextEditorExtension, TiptapEditor, ToolbarItem } from '@editor/plugin-api'

export type TextDirection = 'ltr' | 'rtl'

export interface DirectionOptions {
  /** Node types direction applies to. Defaults to paragraphs and headings. */
  types?: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    direction: {
      /** Set the writing direction of the block at the selection. */
      setTextDirection: (dir: TextDirection) => ReturnType
      /** Clear the explicit direction. */
      unsetTextDirection: () => ReturnType
    }
  }
}

/**
 * Left-to-right / right-to-left direction, stored as a `dir` attribute on the
 * configured block nodes. Renders `dir="…"` (preserved by the sanitizer).
 */
export function Direction(options: DirectionOptions = {}): TextEditorExtension {
  const types = options.types ?? ['paragraph', 'heading']

  const items: ToolbarItem[] = (
    [
      ['ltr', 'Left to right', 'ltr'],
      ['rtl', 'Right to left', 'rtl'],
    ] as const
  ).map(([dir, label, icon]) => ({
    name: dir,
    label,
    group: 'direction',
    icon,
    isActive: (e: TiptapEditor) => e.isActive({ dir }),
    run: (e: TiptapEditor) => e.chain().focus().setTextDirection(dir).run(),
  }))

  const extension = Extension.create({
    name: 'direction',
    addGlobalAttributes() {
      return [
        {
          types,
          attributes: {
            dir: {
              default: null,
              // Read the attribute (not `element.dir`, which is inherited).
              parseHTML: (element) =>
                element.getAttribute('dir') || element.getAttribute('data-dir') || null,
              renderHTML: (attributes) => (attributes.dir ? { dir: String(attributes.dir) } : {}),
            },
          },
        },
      ]
    },
    addCommands() {
      return {
        setTextDirection: (dir: TextDirection) => ({ commands }) =>
          types.every((type) => commands.updateAttributes(type, { dir })),
        unsetTextDirection: () => ({ commands }) =>
          types.every((type) => commands.updateAttributes(type, { dir: null })),
      }
    },
  })

  return { name: 'direction', tiptap: extension, toolbarItems: items }
}
