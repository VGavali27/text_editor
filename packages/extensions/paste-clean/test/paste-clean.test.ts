import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import type { AnyExtension } from '@tiptap/core'
import Bold from '@tiptap/extension-bold'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Fragment, Slice } from '@tiptap/pm/model'
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import {
  cleanPastedSlice,
  normalizePastedHtml,
  PasteClean,
} from '@editor/extension-paste-clean'

const editors: Editor[] = []

function makeEditor(extensions: AnyExtension[] = []): Editor {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [Document, Paragraph, Text, ...extensions],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

/* -------------------------------------------------------- normalizePastedHtml */

describe('normalizePastedHtml', () => {
  it('unwraps proprietary namespaced tags from Word / Office', () => {
    const output = normalizePastedHtml(
      '<w:sdt><w:sdtContent><p>hello</p></w:sdtContent></w:sdt><o:p>world</o:p>',
    )
    expect(output).not.toMatch(/w:sdt/i)
    expect(output).not.toMatch(/o:p/i)
    expect(output).toContain('hello')
    expect(output).toContain('world')
  })

  it('unwraps attribute-less spans but keeps meaningful ones', () => {
    expect(normalizePastedHtml('<p><span>plain</span></p>')).toBe('<p>plain</p>')
    expect(normalizePastedHtml('<p><span class="x">kept</span></p>')).toContain('class="x"')
  })

  it('drops non-content elements entirely', () => {
    const output = normalizePastedHtml(
      '<head><title>t</title></head><style>p{}</style><script>alert(1)</script><p>body</p>',
    )
    expect(output).toBe('<p>body</p>')
  })

  it('converts non-breaking spaces to regular spaces', () => {
    expect(normalizePastedHtml('a&nbsp;b')).toBe('a b')
  })

  it('never throws on malformed input', () => {
    for (const input of ['', '<', '<p', '<a href=', '<span', '<<<>>', '\u0000']) {
      expect(() => normalizePastedHtml(input)).not.toThrow()
      expect(typeof normalizePastedHtml(input)).toBe('string')
    }
  })
})

/* ------------------------------------------------------------ cleanPastedSlice */

function paragraphOf(schema: Schema, text: string): PMNode {
  return schema.node('paragraph', null, text ? schema.text(text) : [])
}

function sliceOf(nodes: PMNode[]): Slice {
  return new Slice(Fragment.fromArray(nodes), 0, 0)
}

describe('cleanPastedSlice', () => {
  it('drops blank edge paragraphs Word adds', () => {
    const editor = makeEditor()
    const schema = editor.schema
    const cleaned = cleanPastedSlice(
      sliceOf([paragraphOf(schema, ''), paragraphOf(schema, 'keep'), paragraphOf(schema, '')]),
      schema,
    )
    expect(cleaned.content.childCount).toBe(1)
    expect(cleaned.content.firstChild?.textContent).toBe('keep')
  })

  it('strips marks the target schema does not know', () => {
    const source = makeEditor([Bold])
    const target = makeEditor()
    const bold = source.schema.marks.bold
    expect(bold).toBeDefined()
    const marked = source.schema.text('bolded', [bold!.create()])
    const slice = sliceOf([source.schema.node('paragraph', null, [marked])])

    const cleaned = cleanPastedSlice(slice, target.schema)
    const text = cleaned.content.firstChild?.firstChild
    expect(text?.textContent).toBe('bolded')
    expect(text?.marks.length).toBe(0)
  })

  it('keeps marks the target schema knows', () => {
    const editor = makeEditor([Bold])
    const bold = editor.schema.marks.bold!
    const marked = editor.schema.text('bolded', [bold.create()])
    const cleaned = cleanPastedSlice(
      sliceOf([editor.schema.node('paragraph', null, [marked])]),
      editor.schema,
    )
    expect(cleaned.content.firstChild?.firstChild?.marks.length).toBe(1)
  })

  it('normalizes non-breaking spaces inside text', () => {
    const editor = makeEditor()
    const cleaned = cleanPastedSlice(
      sliceOf([paragraphOf(editor.schema, 'a\u00a0b')]),
      editor.schema,
    )
    expect(cleaned.content.firstChild?.textContent).toBe('a b')
  })

  it('preserves open slices (does not trim partial content)', () => {
    const editor = makeEditor()
    const schema = editor.schema
    const inner = Fragment.fromArray([paragraphOf(schema, 'keep')])
    const open = new Slice(inner, 1, 1)
    const cleaned = cleanPastedSlice(open, schema)
    expect(cleaned.openStart).toBe(1)
    expect(cleaned.openEnd).toBe(1)
    expect(cleaned.content.childCount).toBe(1)
  })
})

/* ---------------------------------------------------------------- extension */

describe('PasteClean extension', () => {
  it('contributes a transformPasted plugin prop', () => {
    const ext = PasteClean()
    const editor = makeEditor(Array.isArray(ext.tiptap) ? ext.tiptap : [ext.tiptap])
    const transformed = editor.view.someProp('transformPasted', (fn) => {
      const slice = sliceOf([paragraphOf(editor.schema, 'x')])
      return fn(slice, editor.view)
    })
    expect(transformed).toBeTruthy()
  })

  it('does not throw when fed a malformed slice through the real plugin', () => {
    const ext = PasteClean()
    const editor = makeEditor(Array.isArray(ext.tiptap) ? ext.tiptap : [ext.tiptap])
    expect(() => {
      editor.view.someProp('transformPasted', (fn) => {
        const empty = new Slice(Fragment.empty, 0, 0)
        return fn(empty, editor.view)
      })
    }).not.toThrow()
  })
})
