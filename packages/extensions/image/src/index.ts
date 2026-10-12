import Image from '@tiptap/extension-image'
import type { ImageOptions as TiptapImageOptions } from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import type { TextEditorExtension, TiptapEditor, ToolbarItem } from '@editor/plugin-api'

/** What an upload adapter may return: a URL, or a URL plus metadata. */
export type ImageUploadResult =
  | string
  | {
      src: string
      alt?: string
      title?: string
      width?: number
      height?: number
    }

/** Adopter-owned upload function. Only the host decides where files go. */
export type ImageUpload = (file: File) => Promise<ImageUploadResult>

export interface ImageOptions {
  /** Upload adapter. When omitted, the toolbar prompts for an image URL. */
  upload?: ImageUpload
  /** Accepted MIME types for the file picker. Defaults to `image/*`. */
  accept?: string
  /** Render images inline instead of as block nodes. Defaults to `false`. */
  inline?: boolean
  /** Allow `data:` URLs (base64). Defaults to `false`. */
  allowBase64?: boolean
  /** Ask the host for an image URL (toolbar insert when no upload adapter). */
  onRequestUrl?: (currentUrl?: string) => string | null
  /** Ask the host for alt text. Defaults to `window.prompt`. */
  onRequestAlt?: (currentAlt: string | undefined) => string | null
  /** Ask the host for a caption. Defaults to `window.prompt`. */
  onRequestCaption?: (currentCaption: string | undefined) => string | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    editorImage: {
      setImageAlt: (alt: string) => ReturnType
      setImageCaption: (caption: string) => ReturnType
      setImageSize: (size: { width?: number | null; height?: number | null }) => ReturnType
    }
  }
}

function promptFor(label: string, value: string): string | null {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') return null
  return window.prompt(label, value)
}

/** Read natural pixel dimensions from a file (bitmap fast path, then `<img>`). */
async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const size = { width: bitmap.width, height: bitmap.height }
      bitmap.close?.()
      return size
    } catch {
      // fall through to the <img> path
    }
  }
  if (typeof window === 'undefined' || typeof window.Image === 'undefined') return null
  if (typeof URL === 'undefined') return null
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = new window.Image()
    el.onload = () => {
      resolve({ width: el.naturalWidth, height: el.naturalHeight })
      URL.revokeObjectURL(url)
    }
    el.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(url)
    }
    el.src = url
  })
}

function dataTransferImages(data: DataTransfer | null): File[] {
  if (!data) return []
  const files: File[] = []
  if (data.items) {
    for (const item of Array.from(data.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
  }
  if (!files.length && data.files) {
    for (const file of Array.from(data.files)) {
      if (file.type.startsWith('image/')) files.push(file)
    }
  }
  return files
}

async function toImageAttrs(
  file: File,
  upload: ImageUpload,
): Promise<Record<string, unknown>> {
  const result = await upload(file)
  const base = typeof result === 'string' ? { src: result } : { ...result }
  if (base.width == null || base.height == null) {
    const size = await readImageSize(file)
    if (size) {
      if (base.width == null) base.width = size.width
      if (base.height == null) base.height = size.height
    }
  }
  return { ...base, alt: base.alt ?? file.name.replace(/\.[^.]+$/, '') }
}

function insertImage(editor: TiptapEditor, attrs: Record<string, unknown>, pos?: number): void {
  if (typeof pos === 'number') {
    editor.chain().insertContentAt(pos, { type: 'image', attrs }).run()
  } else {
    editor.chain().focus().insertContent({ type: 'image', attrs }).run()
  }
}

async function uploadAndInsert(
  editor: TiptapEditor,
  files: File[],
  upload: ImageUpload,
  pos?: number,
): Promise<void> {
  let cursor = pos
  for (const file of files) {
    try {
      const attrs = await toImageAttrs(file, upload)
      insertImage(editor, attrs, cursor)
      if (typeof cursor === 'number') cursor += 1
    } catch (error) {
      console.error('[editor] image upload failed:', error)
    }
  }
}

/** Options accepted by the extended image node (base image options + upload). */
type NodeImageOptions = TiptapImageOptions & {
  upload?: ImageUpload
  accept: string
}

export const EditorImage = Image.extend<NodeImageOptions>({
  addOptions(): NodeImageOptions {
    return {
      ...(this.parent?.() ?? ({} as TiptapImageOptions)),
      upload: undefined,
      accept: 'image/*',
    } as NodeImageOptions
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('width') ??
          (element.style.width ? Number.parseInt(element.style.width, 10) : null),
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {}),
      },
      height: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('height') ??
          (element.style.height ? Number.parseInt(element.style.height, 10) : null),
        renderHTML: (attributes) => (attributes.height ? { height: attributes.height } : {}),
      },
      caption: {
        default: null,
        parseHTML: (element) =>
          element.parentElement?.querySelector('figcaption')?.textContent ?? null,
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    const allowBase64 = this.options.allowBase64
    const imgTag = allowBase64 ? 'img[src]' : 'img[src]:not([src^="data:"])'
    return [
      {
        tag: 'figure[data-type="image"]',
        getAttrs: (element) => {
          const figure = element as HTMLElement
          const img = figure.querySelector('img')
          if (!img) return false
          const src = img.getAttribute('src')
          if (!allowBase64 && src?.startsWith('data:')) return false
          return {
            src,
            alt: img.getAttribute('alt'),
            title: img.getAttribute('title'),
            width: img.getAttribute('width'),
            height: img.getAttribute('height'),
            caption: figure.querySelector('figcaption')?.textContent ?? null,
          }
        },
      },
      { tag: imgTag },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, ...imgAttrs } = mergeAttributes(
      this.options.HTMLAttributes,
      HTMLAttributes,
    ) as Record<string, unknown>
    if (caption) {
      return [
        'figure',
        { class: 'editor-image', 'data-type': 'image' },
        ['img', mergeAttributes(imgAttrs)],
        ['figcaption', {}, String(caption)],
      ]
    }
    return ['img', mergeAttributes(imgAttrs)]
  },

  addCommands() {
    return {
      setImageAlt:
        (alt: string) =>
        ({ commands }) =>
          commands.updateAttributes('image', { alt }),
      setImageCaption:
        (caption: string) =>
        ({ commands }) =>
          commands.updateAttributes('image', { caption }),
      setImageSize:
        (size) =>
        ({ commands }) =>
          commands.updateAttributes('image', size),
    }
  },

  addNodeView() {
    const inline = this.options.inline
    return ({ node, getPos, editor }) => {
      const dom = document.createElement(inline ? 'span' : 'figure')
      dom.className = 'editor-image'
      if (!inline) dom.setAttribute('data-type', 'image')

      const img = document.createElement('img')
      dom.appendChild(img)

      const captionEl = document.createElement('figcaption')
      captionEl.className = 'editor-image__caption'
      dom.appendChild(captionEl)

      const handle = document.createElement('span')
      handle.className = 'editor-image__handle'
      handle.setAttribute('aria-hidden', 'true')
      dom.appendChild(handle)

      const render = (current: PMNode): void => {
        const attrs = current.attrs as Record<string, unknown>
        img.src = String(attrs.src ?? '')
        img.alt = String(attrs.alt ?? '')
        if (attrs.title) img.title = String(attrs.title)
        if (attrs.width) img.style.width = `${attrs.width}px`
        if (attrs.height) img.style.height = `${attrs.height}px`
        captionEl.textContent = attrs.caption ? String(attrs.caption) : ''
        captionEl.hidden = !attrs.caption
      }
      render(node)

      const onResizeStart = (event: MouseEvent): void => {
        event.preventDefault()
        event.stopPropagation()
        const startX = event.clientX
        const startY = event.clientY
        const startWidth = img.width || img.naturalWidth
        const startHeight = img.height || img.naturalHeight

        const onMove = (move: MouseEvent): void => {
          const width = Math.max(32, Math.round(startWidth + (move.clientX - startX)))
          const height = Math.max(32, Math.round(startHeight + (move.clientY - startY)))
          img.style.width = `${width}px`
          img.style.height = `${height}px`
        }

        const onUp = (): void => {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
          const pos = getPos()
          if (typeof pos !== 'number') return
          editor
            .chain()
            .command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                width: img.width,
                height: img.height,
              })
              return true
            })
            .run()
        }

        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      }

      handle.addEventListener('mousedown', onResizeStart)

      return {
        dom,
        update: (updated: PMNode) => {
          if (updated.type.name !== node.type.name) return false
          render(updated)
          return true
        },
        selectNode: () => dom.classList.add('ProseMirror-selectednode'),
        deselectNode: () => dom.classList.remove('ProseMirror-selectednode'),
        destroy: () => {
          handle.removeEventListener('mousedown', onResizeStart)
        },
      }
    }
  },

  addProseMirrorPlugins() {
    const upload = this.options.upload
    const extension = this.editor
    if (!upload) return []

    return [
      new Plugin({
        props: {
          handleDrop: (view: EditorView, event: DragEvent): boolean => {
            if (event.defaultPrevented) return false
            const files = dataTransferImages(event.dataTransfer)
            if (!files.length) return false
            event.preventDefault()
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
            const pos = coords?.pos ?? view.state.selection.from
            void uploadAndInsert(extension, files, upload, pos)
            return true
          },
          handlePaste: (_view: EditorView, event: ClipboardEvent): boolean => {
            const files = dataTransferImages(event.clipboardData)
            if (!files.length) return false
            event.preventDefault()
            void uploadAndInsert(extension, files, upload)
            return true
          },
        },
      }),
    ]
  },
})

function pickAndUpload(editor: TiptapEditor, upload: ImageUpload, accept: string): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.multiple = true
  input.addEventListener('change', () => {
    const files = input.files ? Array.from(input.files) : []
    if (files.length) void uploadAndInsert(editor, files, upload)
  })
  input.click()
}

/**
 * Images: upload adapters, drag-drop + paste upload, resize handles, and
 * alt/caption editing. The adopter owns file storage via `upload`.
 */
export function ImageExtension(options: ImageOptions = {}): TextEditorExtension {
  const node = EditorImage.configure({
    inline: options.inline ?? false,
    allowBase64: options.allowBase64 ?? false,
    upload: options.upload,
    accept: options.accept ?? 'image/*',
    HTMLAttributes: { class: 'editor-image__img' },
  })

  const items: ToolbarItem[] = [
    {
      name: 'image',
      label: 'Image',
      group: 'image',
      run: (e) => {
        if (options.upload) {
          pickAndUpload(e, options.upload, options.accept ?? 'image/*')
          return
        }
        const request = options.onRequestUrl ?? ((current?: string) => promptFor('Image URL', current ?? 'https://'))
        const url = request(undefined)
        if (url && url.trim()) insertImage(e, { src: url.trim() })
      },
    },
    {
      name: 'imageAlt',
      label: 'Alt',
      group: 'image',
      isEnabled: (e) => e.isActive('image'),
      run: (e) => {
        const current = (e.getAttributes('image').alt as string | undefined) ?? ''
        const request = options.onRequestAlt ?? ((alt: string | undefined) => promptFor('Alt text', alt ?? ''))
        const alt = request(current)
        if (alt != null) e.chain().focus().setImageAlt(alt).run()
      },
    },
    {
      name: 'imageCaption',
      label: 'Caption',
      group: 'image',
      isEnabled: (e) => e.isActive('image'),
      run: (e) => {
        const current = (e.getAttributes('image').caption as string | undefined) ?? ''
        const request = options.onRequestCaption ?? ((cap: string | undefined) => promptFor('Caption', cap ?? ''))
        const caption = request(current)
        if (caption != null) e.chain().focus().setImageCaption(caption).run()
      },
    },
  ]

  return {
    name: 'image',
    tiptap: node,
    toolbarItems: items,
  }
}
