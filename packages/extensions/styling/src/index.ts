import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Underline from '@tiptap/extension-underline'
import Strike from '@tiptap/extension-strike'
import Code from '@tiptap/extension-code'
import Heading, { type Level } from '@tiptap/extension-heading'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import Blockquote from '@tiptap/extension-blockquote'
import CodeBlock from '@tiptap/extension-code-block'
import HardBreak from '@tiptap/extension-hard-break'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import type { TextEditorExtension, ToolbarItem } from '@editor/plugin-api'

export interface StylingOptions {
  headingLevels?: Level[]
}

/**
 * Base formatting: bold, italic, underline, strike, code, headings, lists,
 * blockquote, code block and horizontal rule.
 */
export function Styling(options: StylingOptions = {}): TextEditorExtension {
  const headingLevels: Level[] = options.headingLevels ?? [1, 2, 3]

  const items: ToolbarItem[] = [
    {
      name: 'bold',
      label: 'Bold',
      group: 'styling',
      isActive: (e) => e.isActive('bold'),
      run: (e) => e.chain().focus().toggleBold().run(),
    },
    {
      name: 'italic',
      label: 'Italic',
      group: 'styling',
      isActive: (e) => e.isActive('italic'),
      run: (e) => e.chain().focus().toggleItalic().run(),
    },
    {
      name: 'underline',
      label: 'Underline',
      group: 'styling',
      isActive: (e) => e.isActive('underline'),
      run: (e) => e.chain().focus().toggleUnderline().run(),
    },
    {
      name: 'strike',
      label: 'Strike',
      group: 'styling',
      isActive: (e) => e.isActive('strike'),
      run: (e) => e.chain().focus().toggleStrike().run(),
    },
    ...headingLevels.map<ToolbarItem>((level) => ({
      name: `heading-${level}`,
      label: `H${level}`,
      group: 'styling',
      isActive: (e) => e.isActive('heading', { level }),
      run: (e) => e.chain().focus().toggleHeading({ level }).run(),
    })),
    {
      name: 'bulletList',
      label: 'Bullet list',
      group: 'styling',
      isActive: (e) => e.isActive('bulletList'),
      run: (e) => e.chain().focus().toggleBulletList().run(),
    },
    {
      name: 'orderedList',
      label: 'Ordered list',
      group: 'styling',
      isActive: (e) => e.isActive('orderedList'),
      run: (e) => e.chain().focus().toggleOrderedList().run(),
    },
    {
      name: 'blockquote',
      label: 'Quote',
      group: 'styling',
      isActive: (e) => e.isActive('blockquote'),
      run: (e) => e.chain().focus().toggleBlockquote().run(),
    },
  ]

  return {
    name: 'styling',
    tiptap: [
      Bold,
      Italic,
      Underline,
      Strike,
      Code,
      Heading.configure({ levels: headingLevels }),
      BulletList,
      OrderedList,
      ListItem,
      Blockquote,
      CodeBlock,
      HardBreak,
      HorizontalRule,
    ],
    toolbarItems: items,
  }
}
