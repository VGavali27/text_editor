# text_editor

A modular, **opt-in** WYSIWYG rich-text editor. Every feature is an optional
extension: if you don't add it to the `extensions` array, none of its code,
CSS, commands, or DOM survives into your bundle or output.

- **Public API is tiny.** `new TextEditor({ element, content, extensions })`.
  TipTap, ProseMirror and DOMPurify stay behind the extension contract.
- **Permissive only.** MIT-licensed code and dependencies; no paid services, no
  logins, no hosted backends.
- **Security first.** A sanitizer gate runs on every paste and on serialize.
- **Framework-ready.** Vanilla core plus React, Vue and Next.js adapters.

[![CI](https://github.com/VGavali27/text_editor/actions/workflows/ci.yml/badge.svg)](https://github.com/VGavali27/text_editor/actions/workflows/ci.yml)

## Quick start

```ts
import { TextEditor } from '@editor/core'
import { Styling } from '@editor/extension-styling'
import { History } from '@editor/extension-history'
import { Link } from '@editor/extension-link'
import { Sanitize } from '@editor/sanitize'
import { createToolbar } from '@editor/ui'
import '@editor/ui/styles.css'

const editor = new TextEditor({
  element: document.getElementById('editor')!,
  content: '<p>Hello world</p>',
  extensions: [
    Styling(), // bold, italic, headings, lists, …
    History(), // undo / redo
    Link(), // hyperlinks
    Sanitize(), // paste + serialize allowlist
  ],
  onChange: (html) => console.log(html),
})

createToolbar(editor, document.getElementById('toolbar')!)
```

Run the interactive playground:

```sh
npm install
npm run dev          # http://localhost:5173
```

## Principles

1. **Opt-in by default.** Nothing is enabled implicitly. Add the extensions you
   want; each package is a self-contained unit.
2. **No residue when off.** A disabled feature contributes no JavaScript, no CSS
   and no HTML attributes.
3. **Host-owned data.** Uploads, persistence and user identity are provided by
   the host through adapters/hooks — the library never phones home.
4. **Internals hidden.** Only `TextEditor`, the extension factories and the UI
   helpers are public.

## Repository layout

| Package / app | Path | What it is |
|---|---|---|
| `@editor/plugin-api` | `packages/plugin-api` | Extension contract: `TextEditorExtension`, `ToolbarItem`, `TextEditorOptions` |
| `@editor/core` | `packages/core` | The public `TextEditor` class (wraps TipTap) |
| `@editor/sanitize` | `packages/sanitize` | DOMPurify allowlist gate (`sanitizeHtml`, `Sanitize`, `SanitizePaste`, `enforceUriAllowlist`) |
| `@editor/ui` | `packages/ui` | Headless toolbar / bubble menu, dialogs, default theme |
| `@editor/extension-styling` | `packages/extensions/styling` | Base formatting |
| `@editor/extension-history` | `packages/extensions/history` | Undo / redo |
| `@editor/extension-link` | `packages/extensions/link` | Hyperlinks |
| `@editor/extension-anchor` | `packages/extensions/anchor` | `<a id>` page anchors |
| `@editor/extension-image` | `packages/extensions/image` | Images + upload adapter |
| `@editor/extension-paste-clean` | `packages/extensions/paste-clean` | Word / Docs / web paste cleanup |
| `@editor/extension-source-view` | `packages/extensions/source-view` | HTML source mode |
| `@editor/extension-track-changes` | `packages/extensions/track-changes` | Suggestion mode (review) |
| `@editor/extension-comments` | `packages/extensions/comments` | Comment threads (review) |
| `@editor/adapter-react` | `packages/adapters/react` | React / Next.js bindings |
| `@editor/adapter-vue` | `packages/adapters/vue` | Vue bindings |
| `@editor/playground` | `apps/playground` | Vite demo (private) |
| `@editor/next-example` | `apps/next-example` | Next.js App Router demo (private) |

## Extensions at a glance

| Extension | Import | Highlights |
|---|---|---|
| Styling | `Styling({ headingLevels })` | bold, italic, underline, strike, code, headings, lists, blockquote, code block, hr |
| History | `History()` | undo / redo with typing-burst coalescing |
| Link | `Link({ openOnClick, autolink, linkOnPaste, onRequestUrl })` | safe `target`/`rel` defaults, host-provided URL dialog |
| Anchor | `Anchor({ onRequestName })` | `slugify` + duplicate detection, `collectAnchorIds` |
| Image | `ImageExtension({ upload, accept, inline, allowBase64, onRequest* })` | host upload adapter, drag-drop + paste upload, resize, alt/caption |
| Paste clean | `PasteClean()` | strips Word/Office junk, blanks, foreign marks |
| Source view | `SourceView({ label, highlight, sanitize, onToggle })` | synced textarea, Shiki-compatible highlight hook |
| Sanitize | `Sanitize({ allowedTags, allowedAttributes, allowedSchemes, normalize })` | security gate on paste + serialize |
| Track changes | `TrackChanges({ author, enabled, now })` | insertion/deletion marks, accept/reject |
| Comments | `Comments({ author, onChange, onRequestComment })` + `createCommentPanel` | threads anchored to ranges, sidebar panel |

See [`docs/extensions.md`](docs/extensions.md) for every option, command and
helper.

## Frameworks

- **React / Next.js** — `@editor/adapter-react` exposes an SSR-safe `useEditor`
  hook and `<Editor />` component. The module carries `"use client"`, so it
  works directly in the Next.js App Router. See
  [`packages/adapters/react/README.md`](packages/adapters/react/README.md) and
  the working [`apps/next-example`](apps/next-example).
- **Vue 3** — `@editor/adapter-vue` exposes a `useEditor` composable and
  `<Editor />` component (authored with `h()`, no SFC compiler needed).

```tsx
// React / Next.js client component
'use client'
import { Editor } from '@editor/adapter-react'
import { Styling } from '@editor/extension-styling'

export function MyEditor() {
  return <Editor content="<p>Hello</p>" extensions={[Styling()]} />
}
```

## Review features

- **Track changes** records every edit as an `insertion` or `deletion` mark with
  author + timestamp, so changes can be accepted or rejected later — built from
  scratch on `prosemirror-changeset`. See [`docs/review.md`](docs/review.md).
- **Comments** anchor threads to document ranges while storing the thread data
  (author, body, replies, status) *outside* the document, so it can be persisted
  independently.

## Security

- A DOMPurify allowlist gate runs on every paste (`transformPastedHTML`) and is
  available for serialization (`sanitizeHtml`).
- URL schemes are allowlisted (`http`, `https`, `mailto`, `tel` by default);
  `javascript:`, `data:` and other schemes are stripped deterministically —
  including cases DOMPurify allows by default.
- The gate is covered by an OWASP-payload suite and a deterministic fuzz suite.
  See [`docs/security.md`](docs/security.md).

## Development

```sh
npm install        # install all workspaces
npm run dev        # start the Vite playground
npm run typecheck  # tsc --noEmit in every workspace
npm test           # vitest (unit + DOM integration + a11y + fuzz)
npm run build --workspace @editor/playground
npm run build --workspace @editor/next-example
```

Docs: [`docs/architecture.md`](docs/architecture.md),
[`docs/extensions.md`](docs/extensions.md),
[`docs/review.md`](docs/review.md),
[`docs/security.md`](docs/security.md),
[`docs/theming.md`](docs/theming.md). Build history lives in
[`PROGRESS.md`](PROGRESS.md); the roadmap is [`PLAN.md`](PLAN.md).

## License

[MIT](LICENSE).
