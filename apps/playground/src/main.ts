import { TextEditor } from '@editor/core'
import { Align } from '@editor/extension-align'
import { Anchor } from '@editor/extension-anchor'
import { Color } from '@editor/extension-color'
import { Comments, createCommentPanel } from '@editor/extension-comments'
import { Direction } from '@editor/extension-direction'
import { createFindBar, Find } from '@editor/extension-find'
import { Fullscreen } from '@editor/extension-fullscreen'
import { Help } from '@editor/extension-help'
import { History } from '@editor/extension-history'
import { ImageExtension } from '@editor/extension-image'
import { Insert } from '@editor/extension-insert'
import { Link } from '@editor/extension-link'
import { ListStyles } from '@editor/extension-list-styles'
import { normalizePastedHtml, PasteClean } from '@editor/extension-paste-clean'
import { SourceView } from '@editor/extension-source-view'
import { SpecialChars } from '@editor/extension-special-chars'
import { Styling } from '@editor/extension-styling'
import { TrackChanges } from '@editor/extension-track-changes'
import { createWordCount, WordCount } from '@editor/extension-word-count'
import { sanitizeHtml, Sanitize } from '@editor/sanitize'
import { createBubbleToolbar, createMenuBar, createToolbar, requestText } from '@editor/ui'
import type { Menu } from '@editor/ui'
import '@editor/ui/styles.css'
import '@editor/extension-source-view/styles.css'
import '@editor/extension-track-changes/styles.css'
import '@editor/extension-comments/styles.css'
import '@editor/extension-find/styles.css'
import '@editor/extension-special-chars/styles.css'
import '@editor/extension-help/styles.css'
import '@editor/extension-insert/styles.css'
import '@editor/extension-fullscreen/styles.css'
import '@editor/extension-word-count/styles.css'
import './style.css'

const editorHost = document.getElementById('editor')
const toolbarHost = document.getElementById('toolbar')
const menubarHost = document.getElementById('menubar')
const output = document.getElementById('output')
const commentsHost = document.getElementById('comments')

if (!editorHost || !toolbarHost || !output) {
  throw new Error('Playground markup is missing required elements')
}

/**
 * Demo-only upload adapter: inlines the chosen file as a base64 `data:` URL so
 * the playground works without a backend. Real adopters pass their own adapter.
 */
async function demoUpload(file: File): Promise<{ src: string; alt?: string }> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  return { src, alt: file.name.replace(/\.[^.]+$/, '') }
}

/** Download a string as a file from the browser. */
function download(filename: string, data: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const editor = new TextEditor({
  element: editorHost,
  content:
    '<h1>Hello editor</h1><p>Start typing or use the toolbar to format <strong>bold</strong>, ' +
    '<em>italic</em>, <u>underline</u> text.</p>',
  extensions: [
    Styling(),
    Align(),
    ListStyles(),
    Color(),
    Direction(),
    Insert(),
    SpecialChars(),
    WordCount(),
    Find(),
    Fullscreen(),
    Help(),
    History(),
    Link({
      onRequestUrl: (current) =>
        requestText({
          title: 'Link',
          label: 'URL',
          value: current ?? 'https://',
          placeholder: 'https://example.com',
          allowEmpty: true,
        }),
    }),
    Anchor({
      onRequestName: (suggested) =>
        requestText({ title: 'Anchor', label: 'Anchor name', value: suggested }),
    }),
    ImageExtension({
      upload: demoUpload,
      onRequestAlt: (current) =>
        requestText({ title: 'Alt text', label: 'Alternative text', value: current ?? '', allowEmpty: true }),
      onRequestCaption: (current) =>
        requestText({ title: 'Caption', label: 'Caption', value: current ?? '', allowEmpty: true }),
    }),
    SourceView(),
    PasteClean(),
    Sanitize({ normalize: normalizePastedHtml }),
    TrackChanges({ author: 'You' }),
    Comments({
      author: 'You',
      onRequestComment: (selected) =>
        requestText({
          title: 'Comment',
          label: selected ? `Comment on “${selected}”` : 'Comment',
          value: '',
          allowEmpty: true,
        }),
    }),
  ],
  onChange: (html) => {
    output.textContent = html
  },
})

createToolbar(editor, toolbarHost)

// Find & replace bar (Ctrl+F toggles it) and a live word/character count.
const findBar = createFindBar(editor)
window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault()
    findBar.toggle()
  }
})

const statusHost = document.getElementById('status')
if (statusHost) createWordCount(editor, statusHost)

/* --------------------------------------------------------------- menu bar */

const toolbarItems = new Map(editor.getToolbarItems().map((item) => [item.name, item]))

/** Run a command exposed by a toolbar item (reuses its configured dialog). */
const invoke = (name: string) => (e: TextEditor): void => toolbarItems.get(name)?.run(e.engine)

/** Start a blank document. */
function newDocument(): void {
  editor.setHTML('')
  editor.engine.commands.focus()
}

/** Load a local HTML file, sanitized before it reaches the editor. */
function openDocument(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.html,.htm,text/html'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return
    void file.text().then((text) => editor.setHTML(sanitizeHtml(text)))
  })
  input.click()
}

const menus: Menu[] = [
  {
    label: 'File',
    items: [
      { label: 'New', icon: 'new', shortcut: 'Ctrl+Alt+N', run: newDocument },
      { label: 'Open HTML…', icon: 'open', shortcut: 'Ctrl+O', run: openDocument },
      {
        label: 'Export HTML',
        icon: 'exportHtml',
        separatorBefore: true,
        run: () => download('editor.html', editor.getHTML(), 'text/html'),
      },
      {
        label: 'Export JSON',
        icon: 'exportJson',
        run: () => download('editor.json', JSON.stringify(editor.getJSON(), null, 2), 'application/json'),
      },
    ],
  },
  {
    label: 'Edit',
    items: [
      {
        label: 'Undo',
        icon: 'undo',
        shortcut: 'Ctrl+Z',
        disabled: (e) => !e.engine.can().undo(),
        run: (e) => e.engine.chain().focus().undo().run(),
      },
      {
        label: 'Redo',
        icon: 'redo',
        shortcut: 'Ctrl+Shift+Z',
        disabled: (e) => !e.engine.can().redo(),
        run: (e) => e.engine.chain().focus().redo().run(),
      },
      {
        label: 'Select all',
        icon: 'selectAll',
        shortcut: 'Ctrl+A',
        separatorBefore: true,
        run: (e) => e.engine.chain().focus().selectAll().run(),
      },
      {
        label: 'Clear formatting',
        icon: 'clearFormatting',
        run: (e) => e.engine.chain().focus().unsetAllMarks().clearNodes().run(),
      },
    ],
  },
  {
    label: 'Format',
    items: [
      {
        label: 'Align left',
        icon: 'alignLeft',
        checked: (e) =>
          !e.engine.isActive({ textAlign: 'center' }) &&
          !e.engine.isActive({ textAlign: 'right' }) &&
          !e.engine.isActive({ textAlign: 'justify' }),
        run: (e) => e.engine.chain().focus().setTextAlign('left').run(),
      },
      {
        label: 'Align center',
        icon: 'alignCenter',
        checked: (e) => e.engine.isActive({ textAlign: 'center' }),
        run: (e) => e.engine.chain().focus().setTextAlign('center').run(),
      },
      {
        label: 'Align right',
        icon: 'alignRight',
        checked: (e) => e.engine.isActive({ textAlign: 'right' }),
        run: (e) => e.engine.chain().focus().setTextAlign('right').run(),
      },
      {
        label: 'Justify',
        icon: 'alignJustify',
        checked: (e) => e.engine.isActive({ textAlign: 'justify' }),
        run: (e) => e.engine.chain().focus().setTextAlign('justify').run(),
      },
      {
        label: 'Clear color & highlight',
        icon: 'clearFormatting',
        separatorBefore: true,
        run: (e) =>
          e.engine.chain().focus().unsetTextColor().unsetTextHighlight().run(),
      },
      {
        label: 'Clear block background',
        icon: 'clearFormatting',
        run: (e) => e.engine.chain().focus().setBlockBackground(null).run(),
      },
    ],
  },
  {
    label: 'Insert',
    items: [
      { label: 'Link', icon: 'link', shortcut: 'Ctrl+K', run: invoke('link') },
      { label: 'Image', icon: 'image', run: invoke('image') },
      { label: 'Anchor', icon: 'anchor', run: invoke('anchor') },
      {
        label: 'Divider',
        icon: 'hr',
        separatorBefore: true,
        run: (e) => e.engine.chain().focus().setHorizontalRule().run(),
      },
      {
        label: 'Date/time',
        icon: 'calendar',
        run: invoke('insertDateTime'),
      },
      {
        label: 'Page break',
        icon: 'pageBreak',
        run: invoke('insertPageBreak'),
      },
      {
        label: 'Non-breaking space',
        icon: 'nbsp',
        run: invoke('insertNonBreakingSpace'),
      },
      {
        label: 'Special characters…',
        icon: 'charmap',
        separatorBefore: true,
        run: invoke('specialChars'),
      },
      { label: 'Emoticons…', icon: 'smile', run: invoke('emoticons') },
      { label: 'Comment', icon: 'comment', run: invoke('addComment') },
    ],
  },
  {
    label: 'View',
    items: [
      {
        label: 'Left to right',
        icon: 'ltr',
        checked: (e) => e.engine.isActive({ dir: 'ltr' }),
        run: (e) => e.engine.chain().focus().setTextDirection('ltr').run(),
      },
      {
        label: 'Right to left',
        icon: 'rtl',
        checked: (e) => e.engine.isActive({ dir: 'rtl' }),
        run: (e) => e.engine.chain().focus().setTextDirection('rtl').run(),
      },
      {
        label: 'Fullscreen',
        icon: 'fullscreen',
        separatorBefore: true,
        run: (e) => e.engine.chain().focus().toggleFullscreen().run(),
      },
    ],
  },
  {
    label: 'Tools',
    items: [
      {
        label: 'Find & replace…',
        icon: 'find',
        shortcut: 'Ctrl+F',
        run: () => findBar.toggle(),
      },
    ],
  },
  {
    label: 'Help',
    items: [{ label: 'Help', icon: 'help', run: invoke('help') }],
  },
]

if (menubarHost) {
  createMenuBar(editor, menubarHost, menus)
}

// Review side panel: comment threads anchored to their document ranges.
if (commentsHost) {
  createCommentPanel(editor, commentsHost, {
    onRequestReply: () =>
      requestText({ title: 'Reply', label: 'Reply', value: '', allowEmpty: true }),
  })
}

// Contextual bubble menu for the most-used inline actions.
const bubbleNames = new Set(['bold', 'italic', 'underline', 'strike', 'link', 'unlink'])
createBubbleToolbar(editor, {
  items: editor.getToolbarItems().filter((item) => bubbleNames.has(item.name)),
})

output.textContent = editor.getHTML()

window.addEventListener('beforeunload', () => editor.destroy())
