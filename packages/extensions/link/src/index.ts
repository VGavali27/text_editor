import TiptapLink from '@tiptap/extension-link'
import type { TextEditorExtension, TiptapEditor, ToolbarItem } from '@editor/plugin-api'

export interface LinkOptions {
  /** Open links when they are clicked inside the editor. Defaults to `false`. */
  openOnClick?: boolean
  /** Auto-detect URLs as the user types. Defaults to `true`. */
  autolink?: boolean
  /** Turn pasted URLs into links. Defaults to `true`. */
  linkOnPaste?: boolean
  /** Extra attributes applied to every rendered link. */
  htmlAttributes?: Record<string, string>
  /**
   * Ask the host for a URL for the current selection. Return `null` to cancel,
   * an empty string to remove the link, or a URL to apply it. May be async
   * (e.g. a dialog). Defaults to `window.prompt`.
   */
  onRequestUrl?: (currentHref: string | undefined) => string | null | Promise<string | null>
}

function defaultRequestUrl(currentHref?: string): string | null {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
    return null
  }
  return window.prompt('Enter URL', currentHref ?? 'https://')
}

/** Add a sensible scheme when the user types a bare host. */
function normalizeHref(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (/^(https?:|mailto:|tel:|#|\/|\.)/i.test(value)) return value
  return `https://${value}`
}

function applyLink(
  editor: TiptapEditor,
  request: (currentHref: string | undefined) => string | null | Promise<string | null>,
): void {
  const current = editor.getAttributes('link').href as string | undefined
  void (async () => {
    const requested = await request(current)
    if (requested == null) return

    const href = normalizeHref(requested)
    const chain = editor.chain().focus().extendMarkRange('link')

    if (!href) {
      chain.unsetLink().run()
    } else {
      chain.setLink({ href }).run()
    }
  })()
}

/**
 * Hyperlinks: set/edit/unset inline links with safe `target`/`rel` defaults.
 * The URL is requested from the host (`onRequestUrl`) so a real dialog can be
 * plugged in without changing this extension.
 */
export function Link(options: LinkOptions = {}): TextEditorExtension {
  const request = options.onRequestUrl ?? defaultRequestUrl

  const items: ToolbarItem[] = [
    {
      name: 'link',
      label: 'Link',
      group: 'link',
      isActive: (e) => e.isActive('link'),
      run: (e) => applyLink(e, request),
    },
    {
      name: 'unlink',
      label: 'Unlink',
      group: 'link',
      isActive: () => false,
      isEnabled: (e) => e.isActive('link'),
      run: (e) => e.chain().focus().extendMarkRange('link').unsetLink().run(),
    },
  ]

  return {
    name: 'link',
    tiptap: TiptapLink.configure({
      openOnClick: options.openOnClick ?? false,
      autolink: options.autolink ?? true,
      linkOnPaste: options.linkOnPaste ?? true,
      HTMLAttributes: {
        rel: 'noopener noreferrer nofollow',
        target: '_blank',
        ...options.htmlAttributes,
      },
    }),
    toolbarItems: items,
  }
}
