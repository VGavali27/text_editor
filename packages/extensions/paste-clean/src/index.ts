import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Fragment, Slice } from '@tiptap/pm/model'
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import type { TextEditorExtension } from '@editor/plugin-api'

/** Elements that carry no editable content and must be dropped entirely. */
const DROP_TAGS = new Set([
  'script',
  'style',
  'meta',
  'link',
  'title',
  'head',
  'xml',
  'base',
])

function isNamespacedTag(tag: string): boolean {
  // Word/Office junk: <o:p>, <w:sdt>, <m:oMath>, <v:shape>, <st1:…>.
  return /^[a-z0-9]+:[a-z]/i.test(tag)
}

function unwrap(element: Element): void {
  const parent = element.parentNode
  if (!parent) return
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }
  parent.removeChild(element)
}

function walk(element: Element): void {
  for (const child of Array.from(element.children)) {
    const tag = child.tagName.toLowerCase()

    if (DROP_TAGS.has(tag)) {
      child.remove()
      continue
    }

    if (isNamespacedTag(tag)) {
      // Keep the text, drop the proprietary wrapper.
      walk(child)
      unwrap(child)
      continue
    }

    if (tag === 'span') {
      // Word/Docs sprinkle attribute-less spans everywhere.
      const hasAttrs = child.getAttributeNames().length > 0
      if (!hasAttrs) {
        walk(child)
        unwrap(child)
        continue
      }
    }

    walk(child)
  }
}

function collapseSpaces(root: Element): void {
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */)
  let current = walker.nextNode()
  while (current) {
    const text = current.nodeValue ?? ''
    if (text.includes('\u00a0')) {
      current.nodeValue = text.replace(/\u00a0/g, ' ')
    }
    current = walker.nextNode()
  }
}

/**
 * Normalize pasted HTML from Word / Google Docs / the web before it reaches the
 * schema: unwrap proprietary namespaced tags and stray spans, drop non-content
 * elements, and turn non-breaking spaces into regular spaces.
 *
 * This is a pre-parse transform. Wire it into the sanitizer's `normalize`
 * option (`Sanitize({ normalize: normalizePastedHtml })`) so it runs before the
 * security gate.
 */
export function normalizePastedHtml(html: string, doc: Document = document): string {
  const container = doc.createElement('div')
  container.innerHTML = html
  walk(container)
  collapseSpaces(container)
  return container.innerHTML
}

function cleanFragment(fragment: Fragment, schema: Schema): Fragment {
  const nodes: PMNode[] = []
  fragment.forEach((node) => {
    const cleaned = cleanNode(node, schema)
    if (cleaned) nodes.push(cleaned)
  })
  return Fragment.fromArray(nodes)
}

function cleanNode(node: PMNode, schema: Schema): PMNode | null {
  if (!schema.nodes[node.type.name]) return null

  if (node.isText) {
    const text = (node.text ?? '').replace(/\u00a0/g, ' ')
    if (!text) return null
    const marks = node.marks.filter((mark) => schema.marks[mark.type.name])
    return schema.text(text, marks)
  }

  if (node.isLeaf) return node

  return node.copy(cleanFragment(node.content, schema))
}

function isEmptyTextblock(node: PMNode): boolean {
  return node.isTextblock && node.content.size === 0
}

function dropEmptyEdges(fragment: Fragment): Fragment {
  const nodes: PMNode[] = []
  fragment.forEach((node) => nodes.push(node))
  while (nodes.length && isEmptyTextblock(nodes[0])) nodes.shift()
  while (nodes.length && isEmptyTextblock(nodes[nodes.length - 1])) nodes.pop()
  return Fragment.fromArray(nodes)
}

/**
 * Schema-aware cleanup of an already-parsed paste slice: convert nbsp, strip
 * marks the schema does not know, and drop blank edge paragraphs that Word
 * loves to add. Runs on `transformPasted`, which composes with the sanitizer's
 * `transformPastedHTML` gate.
 */
export function cleanPastedSlice(slice: Slice, schema: Schema): Slice {
  let content = cleanFragment(slice.content, schema)
  if (slice.openStart === 0 && slice.openEnd === 0) {
    content = dropEmptyEdges(content)
  }
  return new Slice(content, slice.openStart, slice.openEnd)
}

/**
 * Normalize pasted content to the allowed schema. Pairs with `Sanitize` (which
 * owns the HTML security gate); this extension owns structural cleanup.
 */
export function PasteClean(): TextEditorExtension {
  return {
    name: 'pasteClean',
    tiptap: Extension.create({
      name: 'pasteClean',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            props: {
              transformPasted: (slice, view) => cleanPastedSlice(slice, view.state.schema),
            },
          }),
        ]
      },
    }),
  }
}
