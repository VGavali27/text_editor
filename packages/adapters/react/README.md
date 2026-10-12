# @editor/adapter-react

React bindings for the text editor. SSR-safe and Next.js-ready (the module
carries the `"use client"` directive, so it can be used from Next.js App Router
client components).

## Install

The adapter expects `react` (>=18) as a peer dependency.

## Usage

### Component

```tsx
import { Editor } from '@editor/adapter-react'
import { Styling } from '@editor/extension-styling'
import { History } from '@editor/extension-history'
import { Sanitize } from '@editor/sanitize'
import '@editor/ui/styles.css'

export function MyEditor() {
  return (
    <Editor
      className="editor-surface"
      content="<p>Hello</p>"
      extensions={[Styling(), History(), Sanitize()]}
      onChange={(html) => console.log(html)}
    />
  )
}
```

### Hook

`useEditor` returns the instance and a ref to attach to the mount element,
which is handy when you also want a toolbar (or bubble menu):

```tsx
import { useEffect, useRef, useState } from 'react'
import { useEditor } from '@editor/adapter-react'
import { createToolbar } from '@editor/ui'

function MyEditor() {
  const [html, setHtml] = useState('')
  const toolbarRef = useRef<HTMLDivElement>(null)
  const { editor, elementRef } = useEditor({
    content: '<p>Hello</p>',
    extensions: [/* … */],
    onChange: setHtml,
  })

  useEffect(() => {
    if (!editor || !toolbarRef.current) return
    const toolbar = createToolbar(editor, toolbarRef.current)
    return () => toolbar.destroy()
  }, [editor])

  return (
    <>
      <div ref={toolbarRef} />
      <div ref={elementRef} />
      <pre>{html}</pre>
    </>
  )
}
```

## Next.js

The adapter is SSR-safe: `useEditor` only touches the DOM inside `useEffect`, so
the server renders an empty host element and hydration never mismatches.

### App Router

Because the module is marked `"use client"`, put the editor in a client
component and render that from your server page:

```tsx
// app/editor-client.tsx
'use client'
import { Editor } from '@editor/adapter-react'

export function EditorClient() {
  return <Editor className="editor-surface" content="<p>Hello</p>" extensions={[/* … */]} />
}
```

```tsx
// app/page.tsx  (server component)
import { EditorClient } from './editor-client'

export default function Page() {
  return <EditorClient />
}
```

Import the theme in your root layout (server component):

```tsx
// app/layout.tsx
import '@editor/ui/styles.css'
```

Extension factories (`Styling()`, `History()`, …) are functions, so they cannot
be passed across the server→client boundary. Build the `extensions` array inside
the client component (as above).

### Pages Router / manual `ssr:false`

If you prefer to keep the editor out of the SSR bundle entirely, use a dynamic
import with `ssr: false`:

```tsx
import dynamic from 'next/dynamic'

const Editor = dynamic(
  () => import('@editor/adapter-react').then((m) => m.Editor),
  { ssr: false },
)
```

### `transpilePackages`

These packages ship TypeScript sources, so add them to `next.config`:

```js
const nextConfig = {
  transpilePackages: [
    '@editor/core', '@editor/plugin-api', '@editor/adapter-react',
    '@editor/sanitize', '@editor/ui',
    '@editor/extension-styling', '@editor/extension-history',
    '@editor/extension-link', '@editor/extension-anchor',
    '@editor/extension-image', '@editor/extension-paste-clean',
    '@editor/extension-source-view',
  ],
}
```

See `apps/next-example` for a complete working example.
