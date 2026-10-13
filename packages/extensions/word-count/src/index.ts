import { Extension } from '@tiptap/core'
import type { TextEditorExtension, TiptapEditor } from '@editor/plugin-api'

export interface WordCountResult {
  /** Whitespace-delimited words. */
  words: number
  /** Characters including whitespace. */
  characters: number
  /** Characters excluding whitespace. */
  charactersNoSpaces: number
}

export interface WordCountOptions {
  /** Called whenever the counts change. */
  onChange?: (result: WordCountResult) => void
}

/** Anything exposing the engine (the public `TextEditor` satisfies this). */
export interface HasEngine {
  engine: TiptapEditor
}

/** Count words and characters in a plain string. */
export function countText(text: string): WordCountResult {
  const trimmed = text.trim()
  const words = trimmed ? trimmed.split(/\s+/).length : 0
  return {
    words,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
  }
}

/** Count words/characters in the editor's current document. */
export function getWordCount(engine: TiptapEditor): WordCountResult {
  const { doc } = engine.state
  return countText(doc.textBetween(0, doc.content.size, '\n', ' '))
}

/**
 * Reports word/character counts to the host via `onChange`. Read-only — combine
 * with {@link createWordCount} for a ready-made status readout.
 */
export function WordCount(options: WordCountOptions = {}): TextEditorExtension {
  const extension = Extension.create({
    name: 'wordCount',
    onCreate() {
      options.onChange?.(getWordCount(this.editor))
    },
    onUpdate() {
      options.onChange?.(getWordCount(this.editor))
    },
  })

  return { name: 'wordCount', tiptap: extension }
}

export interface WordCountHandle {
  element: HTMLElement
  refresh: () => void
  destroy: () => void
}

/**
 * Render a live word/character readout into `element` (or a new `<span>` when
 * none is given). `aria-live="polite"` announces updates to assistive tech.
 */
export function createWordCount(
  editor: HasEngine,
  element?: HTMLElement,
  options: WordCountOptions & { format?: (result: WordCountResult) => string } = {},
): WordCountHandle {
  const engine = editor.engine
  const target = element ?? document.createElement('span')
  target.classList.add('editor-word-count')
  target.setAttribute('aria-live', 'polite')

  const format =
    options.format ??
    ((result: WordCountResult) => `${result.words} words · ${result.characters} characters`)

  const refresh = (): void => {
    const result = getWordCount(engine)
    target.textContent = format(result)
    options.onChange?.(result)
  }

  engine.on('transaction', refresh)
  engine.on('selectionUpdate', refresh)
  refresh()

  return {
    element: target,
    refresh,
    destroy() {
      engine.off('transaction', refresh)
      engine.off('selectionUpdate', refresh)
    },
  }
}
