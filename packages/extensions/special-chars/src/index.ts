import { Extension } from '@tiptap/core'
import { openDialog } from '@editor/ui'
import type { TextEditorExtension, TiptapEditor, ToolbarItem } from '@editor/plugin-api'

export type CharacterGroupKind = 'characters' | 'emoji'

export interface CharacterGroup {
  label: string
  characters: string[]
}

export interface SpecialCharsOptions {
  /** Symbol groups shown by the Character map dialog. */
  characters?: CharacterGroup[]
  /** Emoji groups shown by the Emoticons dialog. */
  emoji?: CharacterGroup[]
  /** When set, a host dialog is used instead of the built-in picker. */
  onRequest?: (kind: CharacterGroupKind) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    specialChars: {
      /** Insert a single character at the cursor. */
      insertCharacter: (character: string) => ReturnType
    }
  }
}

const DEFAULT_SYMBOLS: CharacterGroup[] = [
  { label: 'Typography', characters: '… — – ‘ ’ “ ” « » › ‹ • · † ‡ ¶ §'.split(' ') },
  { label: 'Currency', characters: '€ £ $ ¥ ¢ ₽ ₹ ₩ ₺ ৳'.split(' ') },
  { label: 'Math', characters: '± × ÷ √ ∑ ∞ π ≈ ≠ ≤ ≥ < > °'.split(' ') },
  { label: 'Arrows', characters: '← → ↑ ↓ ↔ ⇒ ⇔ ↦ ✓ ✗'.split(' ') },
  {
    label: 'Greek',
    characters: 'α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω'.split(' '),
  },
  { label: 'Punctuation', characters: '© ® ™ ‰ ′ ″ ©'.split(' ').filter(unique) },
]

const DEFAULT_EMOJI: CharacterGroup[] = [
  { label: 'Smileys', characters: '😀 😁 😂 🤣 😊 😍 😘 😜 🤔 😴 😎 🥳'.split(' ') },
  { label: 'Gestures', characters: '👍 👎 👏 🙌 🤝 ✌️ 🤞 💪 👌 🫶'.split(' ') },
  { label: 'Hearts', characters: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💕 💔'.split(' ') },
  { label: 'Misc', characters: '🎉 ⭐ 🌟 🔥 ✅ ❌ ❗ ❓ ⚡ ☀️ 🌙 ☕'.split(' ') },
]

function unique(value: string, index: number, array: string[]): boolean {
  return array.indexOf(value) === index
}

export const DEFAULTS: Record<CharacterGroupKind, CharacterGroup[]> = {
  characters: DEFAULT_SYMBOLS,
  emoji: DEFAULT_EMOJI,
}

/**
 * Character map & emoticons: insert a special character or emoji from a picker
 * dialog. `openCharacterPicker(engine, kind, options)` is also exported for
 * hosts that want to trigger the picker directly.
 */
export function SpecialChars(options: SpecialCharsOptions = {}): TextEditorExtension {
  const characters = options.characters ?? DEFAULT_SYMBOLS
  const emoji = options.emoji ?? DEFAULT_EMOJI

  const extension = Extension.create({
    name: 'specialChars',
    addCommands() {
      return {
        insertCharacter: (character: string) => ({ commands }) =>
          commands.insertContent(character),
      }
    },
  })

  const open = (kind: CharacterGroupKind, engine: Parameters<NonNullable<ToolbarItem['run']>>[0]): void => {
    if (options.onRequest) {
      options.onRequest(kind)
      return
    }
    openCharacterPicker(engine, kind === 'emoji' ? emoji : characters, {
      title: kind === 'emoji' ? 'Emoticons' : 'Special characters',
    })
  }

  const items: ToolbarItem[] = [
    {
      name: 'specialChars',
      label: 'Special characters',
      group: 'insert',
      icon: 'charmap',
      run: (e) => open('characters', e),
    },
    {
      name: 'emoticons',
      label: 'Emoticons',
      group: 'insert',
      icon: 'smile',
      run: (e) => open('emoji', e),
    },
  ]

  return { name: 'specialChars', tiptap: extension, toolbarItems: items }
}

export interface CharacterPickerOptions {
  title?: string
  /** Close the dialog after inserting a character. Defaults to `true`. */
  closeOnSelect?: boolean
}

/**
 * Show a grid of characters in a modal dialog. Clicking a character inserts it
 * at the cursor (and, by default, closes the dialog).
 */
export function openCharacterPicker(
  editor: TiptapEditor,
  groups: CharacterGroup[],
  options: CharacterPickerOptions = {},
): void {
  const closeOnSelect = options.closeOnSelect ?? true
  const engine = editor
  const content = document.createElement('div')
  content.className = 'editor-charmap'

  for (const group of groups) {
    if (!group.characters.length) continue
    const heading = document.createElement('h3')
    heading.className = 'editor-charmap__group'
    heading.textContent = group.label
    content.appendChild(heading)

    const grid = document.createElement('div')
    grid.className = 'editor-charmap__grid'
    grid.setAttribute('role', 'grid')
    grid.setAttribute('aria-label', group.label)

    for (const character of group.characters) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'editor-charmap__char'
      button.textContent = character
      button.setAttribute('aria-label', `Insert ${character}`)
      button.title = character
      button.setAttribute('role', 'gridcell')
      button.addEventListener('click', () => {
        engine.chain().focus().insertCharacter(character).run()
        if (closeOnSelect) dialog.close()
      })
      grid.appendChild(button)
    }
    content.appendChild(grid)
  }

  const dialog = openDialog(content, { label: options.title ?? 'Special characters' })
}