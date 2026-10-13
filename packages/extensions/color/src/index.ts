import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import type { TextEditorExtension, ToolbarItem } from '@editor/plugin-api'

export interface ColorOptions {
  /** Block node types that accept a background color. Defaults to p + heading. */
  blockTypes?: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textColor: {
      /** Apply a foreground color to the selection. */
      setTextColor: (color: string) => ReturnType
      /** Remove the foreground color. */
      unsetTextColor: () => ReturnType
    }
    textHighlight: {
      /** Apply a highlight (text background) to the selection. */
      setTextHighlight: (color: string) => ReturnType
      /** Remove the highlight. */
      unsetTextHighlight: () => ReturnType
    }
    blockBackground: {
      /** Apply (or, with `null`, clear) a background on the block at the selection. */
      setBlockBackground: (color: string | null) => ReturnType
    }
  }
}

/** Inline foreground color: `<span style="color: …">`. */
const TextColor = Mark.create({
  name: 'textColor',
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: (attributes) =>
          attributes.color ? { style: `color: ${String(attributes.color)}` } : {},
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (element) => (element as HTMLElement).style.color ? {} : false,
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },
  addCommands() {
    return {
      setTextColor: (color: string) => ({ commands }) => commands.setMark('textColor', { color }),
      unsetTextColor: () => ({ commands }) => commands.unsetMark('textColor'),
    }
  },
})

/** Inline highlight: `<span style="background-color: …">`. */
const TextHighlight = Mark.create({
  name: 'textHighlight',
  addAttributes() {
    return {
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        renderHTML: (attributes) =>
          attributes.backgroundColor
            ? { style: `background-color: ${String(attributes.backgroundColor)}` }
            : {},
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (element) => (element as HTMLElement).style.backgroundColor ? {} : false,
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },
  addCommands() {
    return {
      setTextHighlight: (color: string) => ({ commands }) =>
        commands.setMark('textHighlight', { backgroundColor: color }),
      unsetTextHighlight: () => ({ commands }) => commands.unsetMark('textHighlight'),
    }
  },
})

/** Block background: `background-color` on the paragraph/heading itself. */
const BlockBackground = Extension.create({
  name: 'blockBackground',
  addOptions() {
    return { types: ['paragraph', 'heading'] as string[] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (element) => element.style.backgroundColor || null,
            renderHTML: (attributes) =>
              attributes.backgroundColor
                ? { style: `background-color: ${String(attributes.backgroundColor)}` }
                : {},
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setBlockBackground: (color: string | null) => ({ commands }) =>
        (this.options.types as string[]).some((type) =>
          commands.updateAttributes(type, { backgroundColor: color }),
        ),
    }
  },
})

/**
 * Colored text and text/block backgrounds. Renders inline `style` values that
 * the sanitizer preserves (color / background-color only).
 */
export function Color(options: ColorOptions = {}): TextEditorExtension {
  const blockTypes = options.blockTypes ?? ['paragraph', 'heading']

  const items: ToolbarItem[] = [
    {
      name: 'textColor',
      label: 'Text color',
      group: 'color',
      type: 'color',
      icon: 'palette',
      color: (e) => (e.getAttributes('textColor').color as string | undefined) ?? null,
      run: (e, value) => {
        if (value) e.chain().focus().setTextColor(value).run()
        else e.chain().focus().unsetTextColor().run()
      },
    },
    {
      name: 'textHighlight',
      label: 'Highlight',
      group: 'color',
      type: 'color',
      icon: 'highlighter',
      color: (e) => (e.getAttributes('textHighlight').backgroundColor as string | undefined) ?? null,
      run: (e, value) => {
        if (value) e.chain().focus().setTextHighlight(value).run()
        else e.chain().focus().unsetTextHighlight().run()
      },
    },
    {
      name: 'blockBackground',
      label: 'Block background',
      group: 'color',
      type: 'color',
      icon: 'paintBucket',
      color: (e) =>
        (e.getAttributes('paragraph').backgroundColor as string | undefined) ??
        (e.getAttributes('heading').backgroundColor as string | undefined) ??
        null,
      run: (e, value) => e.chain().focus().setBlockBackground(value || null).run(),
    },
  ]

  return {
    name: 'color',
    tiptap: [
      TextColor,
      TextHighlight,
      BlockBackground.configure({ types: blockTypes }),
    ],
    toolbarItems: items,
  }
}
