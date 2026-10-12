import { TextEditor } from '@editor/core'
import { Anchor } from '@editor/extension-anchor'
import { Comments, createCommentPanel } from '@editor/extension-comments'
import { History } from '@editor/extension-history'
import { ImageExtension } from '@editor/extension-image'
import { Link } from '@editor/extension-link'
import { normalizePastedHtml, PasteClean } from '@editor/extension-paste-clean'
import { SourceView } from '@editor/extension-source-view'
import { Styling } from '@editor/extension-styling'
import { TrackChanges } from '@editor/extension-track-changes'
import { Sanitize } from '@editor/sanitize'
import { createBubbleToolbar, createToolbar, requestText } from '@editor/ui'
import '@editor/ui/styles.css'
import '@editor/extension-source-view/styles.css'
import '@editor/extension-track-changes/styles.css'
import '@editor/extension-comments/styles.css'
import './style.css'

const editorHost = document.getElementById('editor')
const toolbarHost = document.getElementById('toolbar')
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

const editor = new TextEditor({
  element: editorHost,
  content:
    '<h1>Hello editor</h1><p>Start typing or use the toolbar to format <strong>bold</strong>, ' +
    '<em>italic</em>, <u>underline</u> text.</p>',
  extensions: [
    Styling(),
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
