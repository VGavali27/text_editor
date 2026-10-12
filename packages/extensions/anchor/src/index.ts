import { mergeAttributes, Node } from '@tiptap/core'
import type { TextEditorExtension, TiptapEditor, ToolbarItem } from '@editor/plugin-api'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    anchor: {
      /** Insert an empty `<a id>` anchor at the current selection. */
      setAnchor: (attributes?: { id?: string }) => ReturnType
      /** Remove every anchor node inside the current selection. */
      unsetAnchor: () => ReturnType
    }
  }
}

export interface AnchorOptions {
  /** Extra attributes applied to every rendered anchor. */
  htmlAttributes?: Record<string, string>
  /**
   * Ask the host for the anchor name. Return `null` to cancel. May be async.
   * Defaults to a `window.prompt` seeded with a slug of the selected text.
   */
  onRequestName?: (
    suggested: string,
    taken: readonly string[],
  ) => string | null | Promise<string | null>
}

/**
 * Turn arbitrary text into a URL/id-friendly slug.
 */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'section'
}

/**
 * Return `base`, or `base-2`, `base-3`, … until it no longer collides with an
 * already-used id. Duplicate detection for anchor names.
 */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/** Every anchor id currently present in the document. */
export function collectAnchorIds(editor: TiptapEditor): string[] {
  const ids: string[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'anchor' && node.attrs.id) {
      ids.push(String(node.attrs.id))
    }
  })
  return ids
}

function defaultRequestName(suggested: string): string | null {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
    return suggested
  }
  return window.prompt('Anchor name', suggested)
}

const AnchorNode = Node.create({
  name: 'anchor',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('id'),
        renderHTML: (attributes) => (attributes.id ? { id: attributes.id } : {}),
      },
    }
  },

  parseHTML() {
    return [
      {
        // Only claim `<a id>` elements that are not links (no `href`), so the
        // link extension keeps ownership of real hyperlinks.
        tag: 'a[id]',
        getAttrs: (element) => {
          const el = element as HTMLElement
          if (el.getAttribute('href')) return false
          const id = el.getAttribute('id')
          return id ? { id } : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes({ class: 'editor-anchor' }, HTMLAttributes)]
  },

  addCommands() {
    return {
      setAnchor:
        (attributes = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: 'anchor', attrs: attributes }),
      unsetAnchor:
        () =>
        ({ state, tr, dispatch }) => {
          let found = false
          state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
            if (node.type.name === 'anchor') {
              tr.delete(pos, pos + node.nodeSize)
              found = true
            }
          })
          if (found && dispatch) dispatch(tr)
          return found
        },
    }
  },
})

function insertAnchor(editor: TiptapEditor, options: AnchorOptions): void {
  const { from, to, empty } = editor.state.selection
  const selected = empty ? '' : editor.state.doc.textBetween(from, to, ' ')
  const suggested = slugify(selected || 'section')
  const taken = collectAnchorIds(editor)

  const request = options.onRequestName ?? ((name: string) => defaultRequestName(name))
  void (async () => {
    const requested = await request(suggested, taken)
    if (requested == null) return

    const id = uniqueId(slugify(requested), taken)
    editor.chain().focus().setAnchor({ id }).run()
  })()
}

/**
 * Page anchors: insert `<a id="…">` targets with slugify + duplicate
 * detection. A picker/panel UI can be layered on top later (Phase 4).
 */
export function Anchor(options: AnchorOptions = {}): TextEditorExtension {
  const items: ToolbarItem[] = [
    {
      name: 'anchor',
      label: 'Anchor',
      group: 'anchor',
      run: (e) => insertAnchor(e, options),
    },
  ]

  return {
    name: 'anchor',
    tiptap: AnchorNode.configure({ HTMLAttributes: options.htmlAttributes ?? {} }),
    toolbarItems: items,
  }
}
