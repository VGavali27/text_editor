import { Extension } from '@tiptap/core'
import type { TextEditorExtension, ToolbarItem } from '@editor/plugin-api'

/** CSS `list-style-type` values for unordered lists. */
export type BulletStyle = 'disc' | 'circle' | 'square'

/** CSS `list-style-type` values for ordered lists (123 / abc / ABC / i / I). */
export type OrderedStyle =
  | 'decimal'
  | 'lower-alpha'
  | 'upper-alpha'
  | 'lower-roman'
  | 'upper-roman'

export interface ListStylesOptions {
  /** Unordered styles to offer. Defaults to disc, circle, square. */
  bullets?: BulletStyle[]
  /** Ordered styles to offer. Defaults to decimal, a, A, i, I. */
  ordered?: OrderedStyle[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    listStyles: {
      /** Set the marker style of the bullet list at the selection. */
      setBulletListStyle: (style: BulletStyle | null) => ReturnType
      /** Set the marker style of the ordered list at the selection. */
      setOrderedListStyle: (style: OrderedStyle | null) => ReturnType
    }
  }
}

const BULLET_LABELS: Record<BulletStyle, string> = {
  disc: '• Filled',
  circle: '○ Circle',
  square: '▪ Square',
}

const ORDERED_LABELS: Record<OrderedStyle, string> = {
  decimal: '1. 123',
  'lower-alpha': 'a. abc',
  'upper-alpha': 'A. ABC',
  'lower-roman': 'i. roman',
  'upper-roman': 'I. ROMAN',
}

/**
 * List marker styles. Adds a `listStyleType` attribute to bullet/ordered lists
 * (rendered as an inline `list-style-type` style) plus dropdown controls, so a
 * list can be 123 / abc / ABC / i / I or disc / circle / square.
 */
export function ListStyles(options: ListStylesOptions = {}): TextEditorExtension {
  const bullets = options.bullets ?? (['disc', 'circle', 'square'] as BulletStyle[])
  const ordered = options.ordered ?? ([
    'decimal',
    'lower-alpha',
    'upper-alpha',
    'lower-roman',
    'upper-roman',
  ] as OrderedStyle[])

  const items: ToolbarItem[] = [
    {
      name: 'bulletStyle',
      label: 'Bullet style',
      group: 'lists',
      options: bullets.map((value) => ({ value, label: BULLET_LABELS[value] })),
      value: (e) => e.getAttributes('bulletList').listStyleType ?? 'disc',
      isEnabled: (e) => e.isActive('bulletList'),
      run: (e, value) => {
        if (value) e.chain().focus().setBulletListStyle(value as BulletStyle).run()
      },
    },
    {
      name: 'orderedStyle',
      label: 'Number style',
      group: 'lists',
      options: ordered.map((value) => ({ value, label: ORDERED_LABELS[value] })),
      value: (e) => e.getAttributes('orderedList').listStyleType ?? 'decimal',
      isEnabled: (e) => e.isActive('orderedList'),
      run: (e, value) => {
        if (value) e.chain().focus().setOrderedListStyle(value as OrderedStyle).run()
      },
    },
  ]

  const extension = Extension.create({
    name: 'listStyles',
    addGlobalAttributes() {
      return [
        {
          types: ['bulletList', 'orderedList'],
          attributes: {
            listStyleType: {
              default: null,
              parseHTML: (element) => element.style.listStyleType || null,
              renderHTML: (attributes) =>
                attributes.listStyleType
                  ? { style: `list-style-type: ${String(attributes.listStyleType)}` }
                  : {},
            },
          },
        },
      ]
    },
    addCommands() {
      return {
        setBulletListStyle: (style: BulletStyle | null) => ({ commands }) =>
          commands.updateAttributes('bulletList', { listStyleType: style }),
        setOrderedListStyle: (style: OrderedStyle | null) => ({ commands }) =>
          commands.updateAttributes('orderedList', { listStyleType: style }),
      }
    },
  })

  return { name: 'listStyles', tiptap: extension, toolbarItems: items }
}
