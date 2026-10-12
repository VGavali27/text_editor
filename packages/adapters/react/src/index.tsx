'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { TextEditor } from '@editor/core'
import type { TextEditorOptions } from '@editor/plugin-api'

export type EditorOptions = Omit<TextEditorOptions, 'element'>

export interface UseEditorResult {
  /** The editor instance, or `null` during SSR / before mount. */
  editor: TextEditor | null
  /** Attach this ref to the element the editor should mount into. */
  elementRef: RefObject<HTMLDivElement>
}

/**
 * Create a {@link TextEditor} bound to a ref'd element. Safe for SSR: the
 * instance is only created in an effect (client), and destroyed on unmount.
 *
 * Only the first render's options are used to construct the editor; later
 * changes are intentionally ignored so user edits are not clobbered.
 */
export function useEditor(options: EditorOptions = {}): UseEditorResult {
  const elementRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<TextEditor | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const instance = new TextEditor({
      element,
      content: optionsRef.current.content,
      editable: optionsRef.current.editable,
      extensions: optionsRef.current.extensions,
      onChange: (html) => optionsRef.current.onChange?.(html),
      onFocus: () => optionsRef.current.onFocus?.(),
      onBlur: () => optionsRef.current.onBlur?.(),
    })
    setEditor(instance)

    return () => {
      instance.destroy()
      setEditor(null)
    }
  }, [])

  return { editor, elementRef }
}

export interface EditorProps extends EditorOptions {
  className?: string
  style?: CSSProperties
  id?: string
  /** Called once the editor instance is created (client only). */
  onReady?: (editor: TextEditor) => void
  /** Optional content rendered as siblings of the mount element. */
  children?: ReactNode
}

/**
 * Declarative editor component. In Next.js App Router, import it from a client
 * component (this module carries the `"use client"` directive).
 */
export function Editor({ className, style, id, onReady, children, ...options }: EditorProps) {
  const { editor, elementRef } = useEditor(options)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    if (editor) onReadyRef.current?.(editor)
  }, [editor])

  return (
    <>
      <div ref={elementRef} className={className} style={style} id={id} />
      {children}
    </>
  )
}
