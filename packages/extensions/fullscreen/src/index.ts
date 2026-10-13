import { Extension } from '@tiptap/core'
import type { TextEditorExtension, TiptapEditor, ToolbarItem } from '@editor/plugin-api'

export interface FullscreenOptions {
  /**
   * Element to expand. Defaults to the closest `[data-editor-fullscreen]`
   * ancestor of the editor, or its parent element.
   */
  target?: () => HTMLElement | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fullscreen: {
      /** Toggle fullscreen on/off. */
      toggleFullscreen: () => ReturnType
      /** Set fullscreen explicitly. */
      setFullscreen: (enabled: boolean) => ReturnType
    }
  }
}

interface FullscreenStorage {
  enabled: boolean
}

/**
 * Fullscreen mode. Adds an `editor--fullscreen` class to the target element and,
 * where the browser supports it, also uses the Fullscreen API.
 */
export function Fullscreen(options: FullscreenOptions = {}): TextEditorExtension {
  const state: FullscreenStorage = { enabled: false }
  let target: HTMLElement | null = null
  let onFullscreenChange: (() => void) | null = null

  const resolveTarget = (editor: TiptapEditor): HTMLElement | null => {
    if (options.target) return options.target()
    const dom = editor.view.dom as HTMLElement
    return dom.closest<HTMLElement>('[data-editor-fullscreen]') ?? dom.parentElement
  }

  const sync = (editor: TiptapEditor, next: boolean): void => {
    state.enabled = next
    const storage = editor.storage.fullscreen as FullscreenStorage | undefined
    if (storage) storage.enabled = next

    const element = target ?? resolveTarget(editor)
    target = element
    element?.classList.toggle('editor--fullscreen', next)

    if (typeof document === 'undefined') return
    if (next) {
      if (element && typeof element.requestFullscreen === 'function' && !document.fullscreenElement) {
        void element.requestFullscreen().catch(() => {})
      }
    } else if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      void document.exitFullscreen().catch(() => {})
    }
  }

  const extension = Extension.create({
    name: 'fullscreen',
    addStorage() {
      return { enabled: false }
    },
    onCreate() {
      onFullscreenChange = () => {
        if (typeof document !== 'undefined' && !document.fullscreenElement && state.enabled) {
          sync(this.editor, false)
        }
      }
      document.addEventListener('fullscreenchange', onFullscreenChange)
    },
    onDestroy() {
      document.removeEventListener('fullscreenchange', onFullscreenChange!)
    },
    addCommands() {
      return {
        toggleFullscreen: () => ({ editor, tr, dispatch }) => {
          sync(editor, !state.enabled)
          if (dispatch) dispatch(tr)
          return true
        },
        setFullscreen: (enabled: boolean) => ({ editor, tr, dispatch }) => {
          sync(editor, enabled)
          if (dispatch) dispatch(tr)
          return true
        },
      }
    },
  })

  const items: ToolbarItem[] = [
    {
      name: 'fullscreen',
      label: 'Fullscreen',
      group: 'view',
      icon: 'fullscreen',
      isActive: () => state.enabled,
      run: (e) => e.chain().focus().toggleFullscreen().run(),
    },
  ]

  return { name: 'fullscreen', tiptap: extension, toolbarItems: items }
}

/** Whether fullscreen is currently active for `editor`. */
export function isFullscreen(editor: TiptapEditor): boolean {
  return Boolean((editor.storage.fullscreen as FullscreenStorage | undefined)?.enabled)
}
