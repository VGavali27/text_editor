'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor } from '@editor/adapter-react'
import { History } from '@editor/extension-history'
import { Link } from '@editor/extension-link'
import { Styling } from '@editor/extension-styling'
import { Sanitize } from '@editor/sanitize'
import { createToolbar, requestText } from '@editor/ui'

/**
 * Client island. `useEditor` only touches the DOM inside an effect, so the
 * server render produces an empty host div and hydration never mismatches.
 */
export function EditorClient() {
  const [html, setHtml] = useState('')
  const toolbarRef = useRef<HTMLDivElement>(null)

  const { editor, elementRef } = useEditor({
    content: '<p>Hello from a Next.js client component.</p>',
    extensions: [
      Styling(),
      History(),
      Link({
        onRequestUrl: (current) =>
          requestText({ title: 'Link', label: 'URL', value: current ?? 'https://', allowEmpty: true }),
      }),
      Sanitize(),
    ],
    onChange: setHtml,
  })

  useEffect(() => {
    if (!editor || !toolbarRef.current) return
    const toolbar = createToolbar(editor, toolbarRef.current)
    return () => toolbar.destroy()
  }, [editor])

  return (
    <div>
      <div ref={toolbarRef} />
      <div ref={elementRef} className="editor-surface" />
      <section className="output">
        <h2>HTML output</h2>
        <pre>{html}</pre>
      </section>
    </div>
  )
}
