import { TextEditor } from '@editor/core'
import { Anchor } from '@editor/extension-anchor'
import { History } from '@editor/extension-history'
import { ImageExtension } from '@editor/extension-image'
import { Link } from '@editor/extension-link'
import { normalizePastedHtml, PasteClean } from '@editor/extension-paste-clean'
import { SourceView } from '@editor/extension-source-view'
import { Styling } from '@editor/extension-styling'
import { Sanitize } from '@editor/sanitize'
import { createBubbleToolbar, createToolbar, requestText } from '@editor/ui'
import '@editor/ui/styles.css'
import '@editor/extension-source-view/styles.css'
import './style.css'

const editorHost = document.getElementById('editor')
const toolbarHost = document.getElementById('toolbar')
const output = document.getElementById('output')

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
  ],
  onChange: (html) => {
    output.textContent = html
  },
})

createToolbar(editor, toolbarHost)

// Contextual bubble menu for the most-used inline actions.
const bubbleNames = new Set(['bold', 'italic', 'underline', 'strike', 'link', 'unlink'])
createBubbleToolbar(editor, {
  items: editor.getToolbarItems().filter((item) => bubbleNames.has(item.name)),
})

output.textContent = editor.getHTML()

window.addEventListener('beforeunload', () => editor.destroy())
