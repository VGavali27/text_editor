import { EditorClient } from './editor-client'

// Server component: renders the client-only editor island below.
export default function Page() {
  return (
    <main className="demo">
      <h1>Text Editor — Next.js</h1>
      <p className="muted">
        The editor mounts as a client island; the surrounding page stays a server
        component.
      </p>
      <EditorClient />
    </main>
  )
}
