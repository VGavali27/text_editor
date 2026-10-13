import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorState } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { TextEditorExtension, TiptapEditor, ToolbarItem } from '@editor/plugin-api'

export interface FindMatch {
  from: number
  to: number
}

export interface FindState {
  term: string
  matches: FindMatch[]
  active: number
}

export interface FindOptions {
  /** Called when the Find toolbar control is activated (open your own UI). */
  onRequestFind?: () => void
}

/** Anything exposing the engine (the public `TextEditor` satisfies this). */
export interface HasEngine {
  engine: TiptapEditor
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    find: {
      /** Set the search term and jump to the first match. */
      setSearchTerm: (term: string) => ReturnType
      /** Select the next match. */
      findNext: () => ReturnType
      /** Select the previous match. */
      findPrevious: () => ReturnType
      /** Replace the active match with `text` (empty string deletes it). */
      replaceCurrent: (text: string) => ReturnType
      /** Replace every match. */
      replaceAll: (text: string) => ReturnType
      /** Clear the search term and highlights. */
      clearSearch: () => ReturnType
    }
  }
}

export const findKey = new PluginKey<FindState>('find')

/** All (case-insensitive) occurrences of `term` in the document, in order. */
export function collectMatches(doc: PMNode, term: string): FindMatch[] {
  if (!term) return []
  const needle = term.toLowerCase()
  const matches: FindMatch[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const haystack = node.text.toLowerCase()
    let index = haystack.indexOf(needle)
    while (index !== -1) {
      matches.push({ from: pos + index, to: pos + index + term.length })
      index = haystack.indexOf(needle, index + needle.length)
    }
  })
  return matches
}

function computeState(doc: PMNode, term: string, active: number): FindState {
  const matches = collectMatches(doc, term)
  if (!matches.length) return { term, matches, active: -1 }
  const wrapped = ((active % matches.length) + matches.length) % matches.length
  return { term, matches, active: wrapped }
}

/** Current search state for `state` (or `null` when the extension is absent). */
export function getFindState(state: EditorState): FindState | null {
  return findKey.getState(state) ?? null
}

const findPlugin = new Plugin<FindState>({
  key: findKey,
  state: {
    init: () => ({ term: '', matches: [], active: -1 }),
    apply(tr, value) {
      const meta = tr.getMeta(findKey) as FindState | undefined
      if (meta) return meta
      if (tr.docChanged) return computeState(tr.doc, value.term, value.active)
      return value
    },
  },
  props: {
    decorations(state) {
      const value = findKey.getState(state)
      if (!value?.matches.length) return null
      return DecorationSet.create(
        state.doc,
        value.matches.map((match, index) =>
          Decoration.inline(match.from, match.to, {
            class:
              index === value.active
                ? 'editor-find-match editor-find-match--active'
                : 'editor-find-match',
          }),
        ),
      )
    },
  },
})

/** Find & replace. */
export function Find(options: FindOptions = {}): TextEditorExtension {
  const extension = Extension.create({
    name: 'find',
    addProseMirrorPlugins() {
      return [findPlugin]
    },
    addCommands() {
      return {
        setSearchTerm: (term: string) => ({ state, dispatch }) => {
          if (dispatch) dispatch(state.tr.setMeta(findKey, computeState(state.doc, term, 0)))
          return true
        },
        findNext: () => ({ state, dispatch }) => {
          const value = findKey.getState(state)
          if (!value?.matches.length) return false
          const active = (value.active + 1) % value.matches.length
          return navigate(state, value, active, dispatch)
        },
        findPrevious: () => ({ state, dispatch }) => {
          const value = findKey.getState(state)
          if (!value?.matches.length) return false
          const active = (value.active - 1 + value.matches.length) % value.matches.length
          return navigate(state, value, active, dispatch)
        },
        replaceCurrent: (text: string) => ({ state, dispatch }) => {
          const value = findKey.getState(state)
          if (!value || value.active < 0) return false
          const match = value.matches[value.active]!
          let tr = state.tr
          tr = text
            ? tr.replaceWith(match.from, match.to, state.schema.text(text))
            : tr.delete(match.from, match.to)
          if (dispatch) dispatch(tr.scrollIntoView())
          return true
        },
        replaceAll: (text: string) => ({ state, dispatch }) => {
          const value = findKey.getState(state)
          if (!value?.matches.length) return false
          let tr = state.tr
          // Replace from the end so earlier positions stay valid.
          for (let i = value.matches.length - 1; i >= 0; i -= 1) {
            const match = value.matches[i]!
            tr = text
              ? tr.replaceWith(match.from, match.to, state.schema.text(text))
              : tr.delete(match.from, match.to)
          }
          if (dispatch) dispatch(tr)
          return true
        },
        clearSearch: () => ({ state, dispatch }) => {
          if (dispatch) {
            dispatch(state.tr.setMeta(findKey, { term: '', matches: [], active: -1 }))
          }
          return true
        },
      }
    },
  })

  const items: ToolbarItem[] = [
    {
      name: 'find',
      label: 'Find and replace',
      group: 'tools',
      icon: 'find',
      shortcut: 'Ctrl+F',
      isActive: (e) => Boolean(getFindState(e.state)?.term),
      run: () => options.onRequestFind?.(),
    },
  ]

  return { name: 'find', tiptap: extension, toolbarItems: items }
}

function navigate(
  state: EditorState,
  value: FindState,
  active: number,
  dispatch: ((tr: EditorState['tr']) => void) | undefined,
): boolean {
  const match = value.matches[active]!
  if (!dispatch) return true
  dispatch(
    state.tr
      .setMeta(findKey, { ...value, active })
      .setSelection(TextSelection.create(state.doc, match.from, match.to))
      .scrollIntoView(),
  )
  return true
}

/* ------------------------------------------------------------------- UI --- */

export interface FindBarHandle {
  /** The find bar element. */
  element: HTMLElement
  open: () => void
  close: () => void
  toggle: () => void
  destroy: () => void
}

/**
 * A ready-made find & replace bar. It lives outside the editor (like the bubble
 * toolbar) so it can hold its own inputs without stealing the document focus.
 */
export function createFindBar(editor: HasEngine, onClose?: () => void): FindBarHandle {
  const engine = editor.engine
  const element = document.createElement('div')
  element.className = 'editor-find'
  element.setAttribute('role', 'search')
  element.setAttribute('aria-label', 'Find and replace')
  element.hidden = true

  const field = (className: string, label: string): HTMLInputElement => {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = className
    input.setAttribute('aria-label', label)
    input.placeholder = label
    return input
  }

  const search = field('editor-find__input', 'Find')
  const replacement = field('editor-find__input', 'Replace with')

  const status = document.createElement('span')
  status.className = 'editor-find__status'
  status.setAttribute('aria-live', 'polite')

  const action = (label: string, className?: string): HTMLButtonElement => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = className ?? 'editor-find__button'
    button.textContent = label
    return button
  }

  const prev = action('Prev')
  const next = action('Next')
  const replace = action('Replace')
  const replaceAll = action('All')
  const close = action('×', 'editor-find__button editor-find__close')
  close.setAttribute('aria-label', 'Close find bar')

  element.append(search, status, prev, next, replacement, replace, replaceAll, close)
  document.body.appendChild(element)

  const sync = (): void => {
    const value = getFindState(engine.state)
    const total = value?.matches.length ?? 0
    const current = value && value.active >= 0 ? value.active + 1 : 0
    status.textContent = `${current}/${total}`
  }

  search.addEventListener('input', () => {
    engine.commands.setSearchTerm(search.value)
    sync()
  })
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) engine.commands.findPrevious()
      else engine.commands.findNext()
    }
  })
  next.addEventListener('click', () => engine.commands.findNext())
  prev.addEventListener('click', () => engine.commands.findPrevious())
  replace.addEventListener('click', () => engine.commands.replaceCurrent(replacement.value))
  replacement.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      engine.commands.replaceCurrent(replacement.value)
    }
  })
  replaceAll.addEventListener('click', () => engine.commands.replaceAll(replacement.value))

  const doClose = (): void => {
    element.hidden = true
    engine.commands.clearSearch()
    onClose?.()
  }
  close.addEventListener('click', doClose)

  engine.on('transaction', sync)
  engine.on('selectionUpdate', sync)

  return {
    element,
    open() {
      element.hidden = false
      search.focus()
      search.select()
      sync()
    },
    close: doClose,
    toggle() {
      if (element.hidden) this.open()
      else doClose()
    },
    destroy() {
      engine.off('transaction', sync)
      engine.off('selectionUpdate', sync)
      element.remove()
    },
  }
}
