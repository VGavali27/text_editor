# Build Progress

Running log of what has been implemented in this repo. See `PLAN.md` for the
full design and roadmap.

---

## Session 1 — Monorepo scaffold + minimal core editor

**Goal:** Phase 0 (repo scaffold + tooling) and the start of Phase 1/2 — a
working core editor with opt-in extensions and an interactive playground.

### What was built

| Package | Path | Purpose |
|---|---|---|
| `@editor/plugin-api` | `packages/plugin-api` | Public extension contract: `TextEditorExtension`, `ToolbarItem`, `TextEditorOptions` |
| `@editor/sanitize` | `packages/sanitize` | DOMPurify allowlist (`sanitizeHtml`) + `SanitizePaste` (ProseMirror `transformPastedHTML` plugin) + `Sanitize()` extension |
| `@editor/core` | `packages/core` | `TextEditor` class wrapping TipTap; hides internals; base doc/paragraph/text schema |
| `@editor/ui` | `packages/ui` | Headless `createToolbar()` built from registered extension items |
| `@editor/extension-styling` | `packages/extensions/styling` | bold, italic, underline, strike, code, headings, bullet/ordered lists, blockquote, code block, hard break, horizontal rule |
| `@editor/extension-history` | `packages/extensions/history` | undo / redo |
| `@editor/playground` | `apps/playground` | Vite demo app (private) |

### Repo tooling

- **Package manager:** npm workspaces (`packages/*`, `packages/extensions/*`, `packages/adapters/*`, `apps/*`).
- **TypeScript:** strict, `moduleResolution: Bundler`, shared `tsconfig.base.json`.
- **Internal packages** resolve directly to `src/*.ts` (no build step — not published).
- **Vite** runs the playground and transpiles workspace TS sources.

### Public API (current)

```ts
import { TextEditor } from '@editor/core'
import { Styling } from '@editor/extension-styling'
import { History } from '@editor/extension-history'
import { Sanitize } from '@editor/sanitize'
import { createToolbar } from '@editor/ui'

const editor = new TextEditor({
  element: document.getElementById('editor')!,
  content: '<p>Hello</p>',
  extensions: [Styling(), History(), Sanitize()],
  onChange: (html) => console.log(html),
})

createToolbar(editor, document.getElementById('toolbar')!)
```

`TextEditor` methods: `getHTML()`, `getJSON()`, `setHTML()`, `setEditable()`,
`focus()`, `getToolbarItems()`, `destroy()`, `extensions`, `isEditable`.

### Decisions made

- **TipTap v2** (`2.27.3`) — matches the plan's API (starter-kit-style marks,
  `@tiptap/extension-history`, image/link extensions).
- **No `pnpm`/turborepo** — used npm workspaces (pnpm not installed; simpler for a
  private, non-published repo).
- **No build step for internal packages** — entry points point at `src/*.ts`;
  add `tsup` later only if publishing.
- **Sanitizer runs as a ProseMirror plugin** (`transformPastedHTML`), since
  `transformPastedHTML` is not a TipTap extension field.
- **Scope:** `@editor/*` placeholder brand (private, not published).

### Verification

- `npm run typecheck` — passes across all 7 workspaces.
- `npm run build --workspace @editor/playground` — succeeds (bundle ~317 kB /
  ~98 kB gzip).

### Commands

```sh
npm install                 # install all workspaces
npm run dev                 # start playground (http://localhost:5173)
npm run typecheck           # tsc --noEmit in every workspace
npm run build --workspace @editor/playground
```

### Known notes / deviations from plan

- Sanitizer is opt-in via `Sanitize()` rather than baked into core (keeps core
  weight minimal). Consider enabling by default in Phase 8 hardening.
- Playground reads the same DOM for toolbar/editor; fine for a demo.
- npm reported 18 moderate vulnerabilities (dev/tooling tree); review later.

### Next up (from PLAN.md)

1. Phase 2 — `link` and `anchor` extensions; default fixed toolbar polish.
2. Phase 3 — `image` extension (upload adapter, resize, alt/caption).
3. Phase 4 — UI layer (theming, bubble toolbar, dialogs, source-view).
4. Phase 5 — React/Vue adapters.
5. Phases 6–7 — track-changes and comments (self-built on `prosemirror-changeset`).

---

## Session 2 — Phase 2: link, anchor, paste-clean extensions

**Goal:** Finish the remaining base extensions from Phase 2 alongside the
existing `styling` / `history`, keeping every feature opt-in.

### What was built

| Package | Path | Purpose |
|---|---|---|
| `@editor/extension-link` | `packages/extensions/link` | Inline hyperlinks via `@tiptap/extension-link`; `link` / `unlink` toolbar items; safe `target`/`rel` defaults; `onRequestUrl` hook |
| `@editor/extension-anchor` | `packages/extensions/anchor` | Custom `anchor` inline node for `<a id>` targets; `slugify()` + `uniqueId()` duplicate detection; `collectAnchorIds()`; `setAnchor` / `unsetAnchor` commands; `anchor` toolbar item |
| `@editor/extension-paste-clean` | `packages/extensions/paste-clean` | `normalizePastedHtml()` (Word/Docs/web pre-parse cleanup) + `PasteClean()` ProseMirror `transformPasted` slice normalization |

### Design decisions

- **Clipboard hook ownership.** ProseMirror applies only the *first* plugin's
  `transformPastedHTML` (see `prosemirror-view` `someProp`), and `sanitize`
  already owns it. So `paste-clean` uses the separate `transformPasted` prop
  (post-parse, `Slice`) — the two compose instead of clobbering each other.
- **Sanitizer gains an optional `normalize` pre-step** (`Sanitize({ normalize })`)
  so `normalizePastedHtml` can run *before* the security gate. The gate still
  runs last, so normalization can never bypass the allowlist.
- **Link/anchor ask the host for input** via `onRequestUrl` / `onRequestName`,
  defaulting to `window.prompt`. Phase 4 can drop in real dialogs without
  changing the extension contract.
- **Anchor node only claims `<a id>` elements without `href`**, so `link` keeps
  ownership of real hyperlinks (`<a href>`).
- **Anchor ids/classes survive sanitization** — `id` and `class` were already on
  the sanitizer allowlist.

### Verification

- `npm run typecheck` — passes across all **10** workspaces.
- `npm run build --workspace @editor/playground` — succeeds (bundles `link`,
  `anchor`, `paste-clean`; bundle ~346 kB / ~112 kB gzip).
- `npm install` added `@tiptap/extension-link@^2.27.3` (5 packages, no new
  vulnerabilities beyond the existing dev/tooling tree).

### Next up (from PLAN.md)

1. Phase 3 — `image` extension (upload adapter, resize, alt/caption).
2. Phase 4 — UI layer (theming, bubble toolbar, dialogs, source-view); replace
   the `window.prompt` link/anchor inputs with real dialogs/pickers.
3. Phase 5 — React/Vue adapters.
4. Phases 6–7 — track-changes and comments (self-built on `prosemirror-changeset`).

---

## Session 3 — Phase 3: image extension

**Goal:** Ship the opt-in `image` extension with an adopter-owned upload
adapter, drag-drop + paste upload, resize handles, and alt/caption editing.

### What was built

| Package | Path | Purpose |
|---|---|---|
| `@editor/extension-image` | `packages/extensions/image` | Extends `@tiptap/extension-image`; `upload` adapter; drag-drop + paste upload; vanilla NodeView with a resize handle; `alt` / `caption` attributes and toolbar editing; `width` / `height` sizing |

### API

- `ImageExtension({ upload, accept, inline, allowBase64, onRequestUrl, onRequestAlt, onRequestCaption })`.
- `upload(file) => Promise<string | { src, alt?, title?, width?, height? }>` — the
  adopter owns storage; the extension never hosts anything.
- Commands: `setImageAlt(alt)`, `setImageCaption(caption)`, `setImageSize({ width, height })`.
- Toolbar items: `image` (file picker when an adapter exists, otherwise URL
  prompt), `imageAlt`, `imageCaption`.

### Design decisions

- **Drag-drop and paste upload** are handled by a ProseMirror plugin
  (`handleDrop` / `handlePaste`) that detects image files, calls `upload`, then
  inserts the node at the drop/selection position.
- **Natural dimensions** are read client-side (`createImageBitmap`, falling back
  to an `<img>` + object URL) and stored as `width`/`height` so documents are
  stable; the adopter's adapter can override them.
- **Resize** uses a small vanilla DOM NodeView with a corner handle that writes
  `width`/`height` back through `setNodeMarkup` on mouse-up — no framework dep.
- **Captions** render as `<figure><img><figcaption>`; the caption is kept out of
  the `<img>` attributes in `renderHTML`.
- **Sanitizer allowlist** gained `figure` / `figcaption` (already-allowed `img`
  with `src`/`alt`/`width`/`height`). `data:` URLs remain blocked by the URL
  scheme allowlist on paste.
- **Playground** uses a demo base64 upload adapter so uploading works with no
  backend; the same extension accepts a real adapter unchanged.

### Verification

- `npm run typecheck` — passes across **11** workspaces.
- `npm run build --workspace @editor/playground` — succeeds (~353 kB / ~114 kB
  gzip).
- `renderHTML` output checked at runtime: plain images serialize to `<img>` and
  captioned images to `<figure>…<figcaption>`.
- `npm install` added `@tiptap/extension-image@^2.27.3`.

### Next up (from PLAN.md)

1. Phase 4 — UI layer (theming, bubble toolbar, dialogs, source-view); replace
   the `window.prompt` link/anchor/image inputs with real dialogs/pickers.
2. Phase 5 — React/Vue adapters.
3. Phases 6–7 — track-changes and comments (self-built on `prosemirror-changeset`).

---

## Session 4 — Phase 4: UI layer (theming, dialogs, bubble toolbar, source view)

**Goal:** Give the opt-in extensions a real UI shell — a default theme,
accessible dialogs, a contextual bubble menu, and an HTML source mode.

### What was built

| Area | Path | Purpose |
|---|---|---|
| Theming | `packages/ui/src/styles.css` | CSS-variable theme (light/dark via `prefers-color-scheme`); toolbar, bubble, and dialog styling. Exported as `@editor/ui/styles.css` |
| Dialogs | `packages/ui/src/index.ts` | `openDialog()` modal primitive (focus trap, Esc, backdrop, scroll lock, ARIA) and `requestText()` promise-based text prompt |
| Bubble menu | `packages/ui/src/index.ts` | `createBubbleToolbar()` — floats above a non-empty selection, shares button rendering with `createToolbar()` |
| Toolbar | `packages/ui/src/index.ts` | Group separators between `ToolbarItem.group`s; shared button/refresh renderer |
| Source view | `packages/extensions/source-view` | `SourceView()` — swaps the WYSIWYG surface for a synced textarea; `highlight` hook (Shiki-compatible), optional `sanitize` on exit; `enterSourceView` / `exitSourceView` / `isSourceView` helpers + `styles.css` |

### Wiring the async inputs

- `link`, `anchor`, and `image` request hooks now accept
  `… | Promise<… | null>` and are awaited internally, so a real dialog can back
  them. The playground passes `requestText(...)` for link URL, anchor name, image
  alt, and image caption — no more `window.prompt`.
- Toolbar `run` stays typed `void`; async work is kicked off inside each
  extension (`void (async () => …)()`).
- Removed the toolbar's post-click `editor.focus()` — commands already focus the
  editor, and forcing it blurred dialogs opened by a command.

### Design decisions / deviations

- **No Radix UI.** Radix is React-only; this `ui` package is framework-agnostic
  and vanilla (consistent with `createToolbar`). Built the dialog/focus-trap
  directly instead, so no React dependency leaks into core.
- **No Shiki dependency (yet).** Shiki is heavy and async/wasm-based; rather than
  risk the build, `SourceView` exposes a Shiki-compatible `highlight(code) =>
  html` hook. The overlay (transparent textarea over a highlighted layer) is
  implemented; without a hook the source view is a plain monospace textarea.

### Verification

- `npm run typecheck` — passes across **12** workspaces.
- `npm run build --workspace @editor/playground` — succeeds; workspace CSS
  imports resolve and are bundled (~358 kB JS / ~115 kB gzip, ~5.5 kB CSS).

### Next up (from PLAN.md)

1. Phase 5 — React/Vue adapters (`packages/adapters/react`, `packages/adapters/vue`).
2. Optional — wire a Shiki highlighter into `SourceView` and pickers for
   links/anchors.
3. Phases 6–7 — track-changes and comments (self-built on `prosemirror-changeset`).

