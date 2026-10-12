# Architecture

## Layers

```
apps/                 demos only (playground, next-example) — never imported by packages
packages/
  plugin-api/         the extension contract (no engine dependency)
  core/               TextEditor — the only engine-facing public class
  sanitize/           security gate (DOMPurify)
  ui/                 framework-agnostic toolbar / dialogs / theme
  extensions/*        one opt-in feature per package
  adapters/*          React and Vue bindings over core
```

Everything flows **downwards**: extensions depend on `plugin-api` and (for
review) each other; `core` depends on `plugin-api`; `ui` and `adapters` depend on
`core`. `apps/*` may depend on anything.

## The extension contract

An extension is a plain object, not a class:

```ts
interface TextEditorExtension {
  name: string
  tiptap: AnyExtension | AnyExtension[] // engine extensions this feature adds
  toolbarItems?: ToolbarItem[]          // optional UI controls
}
```

`TextEditor` flattens every `tiptap` value into the engine's extension list and
concatenates every `toolbarItems` array. Because a disabled feature simply isn't
in the array, it contributes nothing.

A `ToolbarItem` is pure data plus callbacks:

```ts
interface ToolbarItem {
  name: string
  label: string
  group?: string
  isActive?: (editor: TiptapEditor) => boolean
  isEnabled?: (editor: TiptapEditor) => boolean
  run: (editor: TiptapEditor) => void
}
```

`run` returns `void`; async work (dialogs, uploads) is kicked off internally with
`void (async () => …)()`. This keeps the UI shell synchronous and framework-free.

## `TextEditor`

`TextEditor` owns a TipTap `Editor` instance (`editor.engine`) and the base
schema (`doc` + `paragraph` + `text`). It exposes a narrow surface:

| Member | Purpose |
|---|---|
| `getHTML()` / `getJSON()` | Read the document |
| `setHTML(html)` | Replace the document |
| `setEditable(bool)` / `isEditable` | Toggle editing |
| `focus()` | Focus the surface |
| `getToolbarItems()` | Controls from the enabled extensions |
| `extensions` | The configured extensions |
| `destroy()` | Tear down the engine |
| `engine` | Escape hatch for `@editor/ui` and adapters (not for end users) |

## Clipboard pipeline

Pasting is the highest-risk path, so it has two ordered stages:

1. **`transformPastedHTML`** — owned by `@editor/sanitize`. The raw clipboard
   HTML is normalized (optional `normalize` pre-step, e.g. `normalizePastedHtml`)
   and then run through the DOMPurify allowlist. ProseMirror applies only the
   *first* plugin's `transformPastedHTML`, so exactly one package may own it.
2. **`transformPasted`** — owned by `@editor/extension-paste-clean`. After the
   HTML is parsed into a ProseMirror `Slice`, unknown nodes/marks are dropped,
   non-breaking spaces normalized, and blank Word edge paragraphs removed.

The two stages compose rather than clobbering each other.

Serialization (`getHTML()` / `setHTML()`) can additionally be routed through
`sanitizeHtml` by the host.

## Adapters

`@editor/adapter-react` and `@editor/adapter-vue` are thin wrappers: they create a
`TextEditor` inside an effect/lifecycle hook (`useEffect` / `onMounted`) so server
rendering and the first client render produce an empty host element — no
`document` access during render, no hydration mismatch. The React entry carries
`"use client"` so Next.js App Router can import it from a client component.

## Build & module resolution

Internal packages are **not published** and are consumed straight from source:
each `package.json` points `main`/`module`/`types`/`exports` at `./src/index.ts`.
There is no build step — Vite and Next.js (`transpilePackages`) compile the TS
sources directly. `dist/`, `node_modules/`, `.next/` and `out/` are gitignored.

## Testing

Vitest (jsdom) runs the **real** engine. Suites cover:

- unit logic (commands, tracking accept/reject, comment storage),
- DOM integration across the whole extension stack,
- accessibility assertions on the toolbar, dialogs and comment panel,
- XSS payloads and deterministic fuzzing through the sanitizer.

Run everything with `npm test`. See [`docs/security.md`](security.md) for the
security suite.
