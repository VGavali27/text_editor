import DOMPurify from 'dompurify'
import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import type { TextEditorExtension } from '@editor/plugin-api'

export interface SanitizeConfig {
  /** Tags allowed to survive sanitization. */
  allowedTags?: string[]
  /** Attributes allowed to survive sanitization. */
  allowedAttributes?: string[]
  /** URL schemes allowed in href/src attributes. */
  allowedSchemes?: string[]
  /**
   * Optional pre-step applied to the HTML *before* sanitization (e.g. Word /
   * Docs normalization). It cannot bypass the gate — the result is still run
   * through the allowlist.
   */
  normalize?: (html: string) => string
}

const DEFAULT_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark',
  'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'hr', 'a', 'img', 'span', 'sub', 'sup',
  'figure', 'figcaption',
]

const DEFAULT_ATTRIBUTES = [
  'href', 'target', 'rel', 'title',
  'src', 'alt', 'width', 'height',
  'id', 'class',
]

function buildUriRegexp(schemes: string[]): RegExp {
  const list = schemes.join('|')
  return new RegExp(`^(?:(?:${list}):|[^a-z]|[a-z+.\\-]+(?:[^a-z+.\\-:]|$))`, 'i')
}

/**
 * Sanitize an HTML string against a strict allowlist. Runs on paste and on
 * serialization. Blocks `javascript:` and other unsafe URL schemes.
 */
export function sanitizeHtml(html: string, config: SanitizeConfig = {}): string {
  const allowedSchemes = config.allowedSchemes ?? ['http', 'https', 'mailto', 'tel']
  const input = config.normalize ? config.normalize(html) : html
  const result = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: config.allowedTags ?? DEFAULT_TAGS,
    ALLOWED_ATTR: config.allowedAttributes ?? DEFAULT_ATTRIBUTES,
    ALLOWED_URI_REGEXP: buildUriRegexp(allowedSchemes),
    ALLOW_DATA_ATTR: false,
  })
  return typeof result === 'string' ? result : String(result)
}

/**
 * TipTap extension that pipes every pasted HTML fragment through the
 * sanitizer before it enters the document.
 */
export function SanitizePaste(config: SanitizeConfig = {}) {
  return Extension.create({
    name: 'sanitizePaste',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            transformPastedHTML: (html: string) => sanitizeHtml(html, config),
          },
        }),
      ]
    },
  })
}

/**
 * Convenience wrapper exposing the sanitizer as an optional editor extension.
 */
export function Sanitize(config: SanitizeConfig = {}): TextEditorExtension {
  return {
    name: 'sanitize',
    tiptap: SanitizePaste(config),
  }
}
