import TiptapHistory from '@tiptap/extension-history'
import type { TextEditorExtension } from '@editor/plugin-api'

/**
 * Undo / redo with typing-burst coalescing.
 */
export function History(): TextEditorExtension {
  return {
    name: 'history',
    tiptap: TiptapHistory,
    toolbarItems: [
      {
        name: 'undo',
        label: 'Undo',
        group: 'history',
        isEnabled: (e) => e.can().undo(),
        run: (e) => e.chain().focus().undo().run(),
      },
      {
        name: 'redo',
        label: 'Redo',
        group: 'history',
        isEnabled: (e) => e.can().redo(),
        run: (e) => e.chain().focus().redo().run(),
      },
    ],
  }
}
