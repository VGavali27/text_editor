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
  // Used by the opt-in track-changes / comments extensions so marked ranges
  // survive the paste/serialize gate. Inert when those extensions are off.
  'data-insertion', 'data-deletion', 'data-author', 'data-date',
  'data-comment', 'data-comment-id',
]

function buildUriRegexp(schemes: string[]): RegExp {
  const list = schemes.join('|')
  return new RegExp(`^(?:(?:${list}):|[^a-z]|[a-z+.\\-]+(?:[^a-z+.\\-:]|$))`, 'i')
}

/** Attributes whose values are URLs and must therefore match the allowlist. */
const URI_ATTRIBUTES = [
  'href', 'src', 'xlink:href', 'action', 'formaction', 'poster',
  'background', 'cite', 'data', 'srcdoc', 'longdesc',
]

/** Whitespace / control characters used to obfuscate schemes (`java\tscript:`). */
const OBFUSCATING_CHARS = /[\u0000-\u0020\u007f-\u009f]/g

/**
 * Remove every URL attribute whose scheme is not allowlisted. DOMPurify keeps
 * `data:` URIs on a handful of tags (img, source, …) by default regardless of
 * `ALLOWED_URI_REGEXP`, so this closes that gap — and any other disallowed
 * scheme — deterministically, on the already-sanitized node.
 */
export function enforceUriAllowlist(element: Element, schemes: readonly string[]): void {
  const allowed = schemes.map((scheme) => scheme.toLowerCase())
  for (const name of URI_ATTRIBUTES) {
    const value = element.getAttribute(name)
    if (value == null) continue
    const match = /^([a-z][a-z0-9+.-]*):/i.exec(value.replace(OBFUSCATING_CHARS, ''))
    if (match && !allowed.includes(match[1]!.toLowerCase())) {
      element.removeAttribute(name)
    }
  }
}

/**
 * Sanitize an HTML string against a strict allowlist. Runs on paste and on
 * serialization. Blocks `javascript:`, `data:` and other unsafe URL schemes.
 */
export function sanitizeHtml(html: string, config: SanitizeConfig = {}): string {
  const allowedSchemes = config.allowedSchemes ?? ['http', 'https', 'mailto', 'tel']
  const input = config.normalize ? config.normalize(html) : html

  const guard = (node: Node): void => {
    if (typeof (node as Element).getAttribute !== 'function') return
    enforceUriAllowlist(node as Element, allowedSchemes)
  }
  const canHook =
    typeof DOMPurify.addHook === 'function' && typeof DOMPurify.removeHook === 'function'

  if (canHook) DOMPurify.addHook('afterSanitizeAttributes', guard)
  try {
    const result = DOMPurify.sanitize(input, {
      ALLOWED_TAGS: config.allowedTags ?? DEFAULT_TAGS,
      ALLOWED_ATTR: config.allowedAttributes ?? DEFAULT_ATTRIBUTES,
      ALLOWED_URI_REGEXP: buildUriRegexp(allowedSchemes),
      ALLOW_DATA_ATTR: false,
    })
    return typeof result === 'string' ? result : String(result)
  } finally {
    if (canHook) DOMPurify.removeHook('afterSanitizeAttributes')
  }
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
