import { Extension } from '@tiptap/core'
import type { TextEditorExtension, TiptapEditor, ToolbarItem } from '@editor/plugin-api'

export interface SourceViewOptions {
  /** Toolbar button label. Defaults to `HTML`. */
  label?: string
  /**
   * Optional syntax highlighter. Receives the current source and returns HTML
   * for the highlighted layer rendered behind the (transparent) textarea. This
   * is a Shiki-compatible hook: `highlight(code) => shiki.codeToHtml(code, …)`.
   * Return `null` to skip highlighting a render.
   */
  highlight?: (code: string) => string | Promise<string | null>
  /** Optional sanitizer applied to the edited source before it is loaded back. */
  sanitize?: (html: string) => string
  /** Called when source mode is entered (`true`) or exited (`false`). */
  onToggle?: (sourceMode: boolean) => void
}

interface SourceState {
  wrapper: HTMLElement
  textarea: HTMLTextAreaElement
}

/** Tracks the active source view per ProseMirror content element. */
const active = new WeakMap<HTMLElement, SourceState>()

function contentDom(editor: TiptapEditor): HTMLElement {
  return editor.view.dom as HTMLElement
}

function pressToolbarRefresh(editor: TiptapEditor): void {
  // Dispatch a no-op transaction so toolbar active state re-evaluates.
  editor.view.dispatch(editor.state.tr)
}

function enterSourceMode(editor: TiptapEditor, options: SourceViewOptions): void {
  const dom = contentDom(editor)
  const parent = dom.parentElement
  if (!parent) return

  const wrapper = document.createElement('div')
  wrapper.className = 'editor-source'

  const highlightLayer = document.createElement('pre')
  highlightLayer.className = 'editor-source__highlight'
  highlightLayer.setAttribute('aria-hidden', 'true')

  const textarea = document.createElement('textarea')
  textarea.className = 'editor-source__input'
  textarea.spellcheck = false
  textarea.value = editor.getHTML()
  textarea.setAttribute('aria-label', 'HTML source')

  wrapper.append(highlightLayer, textarea)

  const overlay = Boolean(options.highlight)
  wrapper.classList.toggle('editor-source--overlay', overlay)

  const syncScroll = (): void => {
    highlightLayer.scrollTop = textarea.scrollTop
    highlightLayer.scrollLeft = textarea.scrollLeft
  }

  const renderHighlight = async (): Promise<void> => {
    if (!options.highlight) return
    const html = await options.highlight(textarea.value)
    if (html != null) highlightLayer.innerHTML = html
    syncScroll()
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const onInput = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void renderHighlight(), 120)
  }

  textarea.addEventListener('input', onInput)
  textarea.addEventListener('scroll', syncScroll)

  parent.insertBefore(wrapper, dom)
  dom.hidden = true
  active.set(dom, { wrapper, textarea })
  void renderHighlight()

  textarea.focus()
  options.onToggle?.(true)
  pressToolbarRefresh(editor)
}

function exitSourceMode(editor: TiptapEditor, options: SourceViewOptions): void {
  const dom = contentDom(editor)
  const state = active.get(dom)
  if (!state) return

  const { wrapper, textarea } = state
  const raw = textarea.value
  const html = options.sanitize ? options.sanitize(raw) : raw

  wrapper.remove()
  dom.hidden = false
  active.delete(dom)

  editor.commands.setContent(html, true)
  editor.commands.focus()
  options.onToggle?.(false)
  pressToolbarRefresh(editor)
}

function toggleSourceMode(editor: TiptapEditor, options: SourceViewOptions): void {
  if (active.has(contentDom(editor))) {
    exitSourceMode(editor, options)
  } else {
    enterSourceMode(editor, options)
  }
}

/** Enter source mode programmatically. */
export function enterSourceView(editor: TiptapEditor, options: SourceViewOptions = {}): void {
  if (!active.has(contentDom(editor))) enterSourceMode(editor, options)
}

/** Exit source mode programmatically (applying the edited HTML). */
export function exitSourceView(editor: TiptapEditor, options: SourceViewOptions = {}): void {
  if (active.has(contentDom(editor))) exitSourceMode(editor, options)
}

/** Whether the editor is currently showing the HTML source. */
export function isSourceView(editor: TiptapEditor): boolean {
  return active.has(contentDom(editor))
}

/**
 * HTML source mode: swap the WYSIWYG surface for a synced textarea, with an
 * optional highlighter layer (Shiki-compatible `highlight` hook). Disabled by
 * default — add it to the extension array to enable.
 */
export function SourceView(options: SourceViewOptions = {}): TextEditorExtension {
  const items: ToolbarItem[] = [
    {
      name: 'sourceView',
      label: options.label ?? 'HTML',
      group: 'view',
      isActive: (e) => isSourceView(e),
      run: (e) => {
        toggleSourceMode(e, options)
      },
    },
  ]

  return {
    name: 'sourceView',
    tiptap: Extension.create({ name: 'sourceView' }),
    toolbarItems: items,
  }
}
