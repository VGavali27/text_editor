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
      icon: 'bold',
      shortcut: 'Ctrl+B',
      isActive: (e) => e.isActive('bold'),
      run: (e) => e.chain().focus().toggleBold().run(),
    },
    {
      name: 'italic',
      label: 'Italic',
      group: 'styling',
      icon: 'italic',
      shortcut: 'Ctrl+I',
      isActive: (e) => e.isActive('italic'),
      run: (e) => e.chain().focus().toggleItalic().run(),
    },
    {
      name: 'underline',
      label: 'Underline',
      group: 'styling',
      icon: 'underline',
      shortcut: 'Ctrl+U',
      isActive: (e) => e.isActive('underline'),
      run: (e) => e.chain().focus().toggleUnderline().run(),
    },
    {
      name: 'strike',
      label: 'Strike',
      group: 'styling',
      icon: 'strike',
      shortcut: 'Ctrl+Shift+S',
      isActive: (e) => e.isActive('strike'),
      run: (e) => e.chain().focus().toggleStrike().run(),
    },
    ...headingLevels.map<ToolbarItem>((level) => ({
      name: `heading-${level}`,
      label: `H${level}`,
      group: 'styling',
      icon: `heading${level}`,
      isActive: (e) => e.isActive('heading', { level }),
      run: (e) => e.chain().focus().toggleHeading({ level }).run(),
    })),
    {
      name: 'bulletList',
      label: 'Bullet list',
      group: 'styling',
      icon: 'bulletList',
      isActive: (e) => e.isActive('bulletList'),
      run: (e) => e.chain().focus().toggleBulletList().run(),
    },
    {
      name: 'orderedList',
      label: 'Ordered list',
      group: 'styling',
      icon: 'orderedList',
      isActive: (e) => e.isActive('orderedList'),
      run: (e) => e.chain().focus().toggleOrderedList().run(),
    },
    {
      name: 'blockquote',
      label: 'Quote',
      group: 'styling',
      icon: 'blockquote',
      isActive: (e) => e.isActive('blockquote'),
      run: (e) => e.chain().focus().toggleBlockquote().run(),
    },
    {
      name: 'code',
      label: 'Inline code',
      group: 'styling',
      icon: 'code',
      shortcut: 'Ctrl+E',
      isActive: (e) => e.isActive('code'),
      run: (e) => e.chain().focus().toggleCode().run(),
    },
    {
      name: 'codeBlock',
      label: 'Code block',
      group: 'styling',
      icon: 'codeBlock',
      shortcut: 'Ctrl+Alt+C',
      isActive: (e) => e.isActive('codeBlock'),
      run: (e) => e.chain().focus().toggleCodeBlock().run(),
    },
    {
      name: 'horizontalRule',
      label: 'Divider',
      group: 'styling',
      icon: 'hr',
      isActive: () => false,
      run: (e) => e.chain().focus().setHorizontalRule().run(),
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
