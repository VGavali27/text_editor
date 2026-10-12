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

---

## Session 5 — Phase 5: React, Vue, and Next.js adapters

**Goal:** Ship framework adapters (`<Editor />` + `useEditor`) plus a working
Next.js (App Router, SSR-safe) example.

### What was built

| Package / app | Path | Purpose |
|---|---|---|
| `@editor/adapter-react` | `packages/adapters/react` | `useEditor()` hook + `<Editor />` component; SSR-safe; carries `"use client"`; README with Next.js guide |
| `@editor/adapter-vue` | `packages/adapters/vue` | `useEditor()` composable + `<Editor />` component (`defineComponent` + render fn) |
| `@editor/next-example` | `apps/next-example` | Next.js 14 App Router demo: server page + `'use client'` editor island |

### Design decisions

- **SSR-safe by construction.** Both adapters create the `TextEditor` inside an
  effect/lifecycle hook (`useEffect` / `onMounted`), so the server (and the
  first client render) produce an empty host element — no `document` access
  during render, no hydration mismatch.
- **`"use client"` directive** on the React adapter entry, so it can be imported
  directly from a Next.js App Router client component.
- **Options are captured once.** `useEditor` uses the first render's options to
  build the instance (kept in a ref) so re-renders never clobber user edits;
  imperative updates go through the returned `editor`.
- **Next.js integration**: `transpilePackages` for the TS-sourced workspace
  packages; theme CSS imported in the root layout; the example also demonstrates
  `next/dynamic` (`ssr: false`) in the README for consumers who want the editor
  fully out of the SSR bundle.
- **No SFC/JSX build needed for Vue** — the component is authored with `h()`, so
  no `@vue/compiler-sfc` step is required.
- React is a `peerDependency` (`>=18`); Vue is `^3.4.0`.

### Verification

- `npm run typecheck` — passes across **15** workspaces.
- `npm run build --workspace @editor/next-example` — **succeeds**: Next.js
  `14.2.35` compiles, type-checks, and statically prerenders `/` (the editor
  mounts as a client island).
- `npm install` added React 18, Vue 3.5, and Next 14.

### Known notes

- `npm audit` now reports 2 advisories in the **Next.js tooling tree** (a
  `next` critical and a `postcss` high). These come from the example's dev
  toolchain, not the editor runtime; fixing them means a breaking Next major, so
  they are left for now (consistent with the existing dev-tree notes).

### Next up (from PLAN.md)

1. Phases 6–7 — **track-changes** and **comments** (self-built on
   `prosemirror-changeset`); the heavy, opt-in review features.
2. Optional — Shiki highlighter in `SourceView`; link/anchor pickers.
3. Phase 8 — docs, a11y audit, fuzz + e2e tests, v1.0.

---

## Session 6 — Phases 6–7: track-changes & comments (+ test harness)

**Goal:** The heavy review features — Word-style suggestion mode and comment
threads — built from scratch on `prosemirror-changeset`, plus the test
infrastructure to prove the complex diffing logic works.

### Test harness (new)

- **Vitest 2 + jsdom** at the root (`vitest.config.ts`, `npm test`). Tests live
  in `packages/**/test/*.test.ts` and run the real TipTap engine in a DOM.
- **19 tests**, all green.

### Track-changes (`@editor/extension-track-changes`)

| Piece | Behaviour |
|---|---|
| `insertion` mark | Text typed while tracking is on; renders highlighted; carries `author` / `date` / `commentId` |
| `deletion` mark | Deleted text is **kept** (struck through) until accepted; same attrs |
| `appendTransaction` plugin | Builds a `ChangeSet` from the user transactions (`ChangeSet.create(oldDoc).addSteps(...)`), replays deletions as `deletion`-marked slices, and tags inserted ranges with `insertion` |
| Commands | `setTrackChanges`, `acceptChanges` / `rejectChanges`, plus granular `acceptIns/Deletions` + `rejectIns/Deletions` |
| Helpers | `collectTrackedChanges`, `countTrackedChanges`, `hasTrackedChanges` |

**Design decisions**
- Deletions are re-inserted with `tr.replaceRange(pos, pos, slice)` (not
  `tr.insert`, which rejects a `Slice`).
- Appended transactions are skipped via PM's own `appendedTransaction` meta
  (plus a private `APPLIED_META`), so the plugin never re-processes its own work.
- A `REVIEW_META` flag on accept/reject transactions prevents review actions
  from being re-recorded as new changes.
- Changes are applied end-to-start (descending `fromB`) so earlier positions
  stay valid as the replayed deletions grow the document.
- Toggle state lives in plugin state via a `PluginKey`, so it survives and is
  readable from toolbar `isActive`.
- Selection-scoped review: commands act on the selection, or the whole document
  when the selection is empty.

### Comments (`@editor/extension-comments`)

| Piece | Behaviour |
|---|---|
| `comment` mark | `<span data-comment data-comment-id="…">`; the thread lives **outside** the document |
| Storage | `CommentThread[]` (`id`, `author`, `date`, `body`, `replies`, `status`) with `subscribeComments()` / `onChange` |
| Commands | `addComment`, `removeComment`, `resolveComment`, `reopenComment`, `replyToComment` |
| Panel | `createCommentPanel()` — a sidebar that lists threads, selects their ranges, and resolves / reopens / deletes / replies |
| Integration | Adding a comment over tracked changes stamps the thread id onto the `insertion`/`deletion` marks (`commentId`) |

**Design decisions**
- Thread data is stored separately and can be persisted independently of the
  document; the doc only references thread ids.
- The panel and helpers accept **either** the public `TextEditor` or the raw
  engine (`getEngine()`), matching the `@editor/ui` convention.
- Same-type marks with different attrs coexist in ProseMirror, so linking a
  comment to a change does `removeMark` **then** `addMark` to replace it.
- The comment mark uses `data-comment` (not `data-comment-id`) for its parse
  rule, so it never mistakes a tracked-change span for a comment.

### Sanitizer

- `DEFAULT_ATTRIBUTES` now also allows `data-insertion`, `data-deletion`,
  `data-author`, `data-date`, `data-comment`, `data-comment-id` so marked ranges
  survive the paste/serialize gate. These are inert when the review extensions
  are off.

### Playground

- Enables `TrackChanges({ author: 'You' })` and `Comments({ author: 'You' })`,
  wires a **comment sidebar** (`createCommentPanel`) with dialog-backed comment
  / reply prompts, and imports both packages' styles.

### Verification

- `npm test` — **19/19 pass** (track-changes × 11, comments × 8).
- `npm run typecheck` — passes across **17** workspaces.
- `npm run build --workspace @editor/playground` — succeeds
  (~376 kB JS / ~121 kB gzip, ~7.5 kB CSS).
- `npm run build --workspace @editor/next-example` — still succeeds.

### Next up (from PLAN.md)

1. Phase 8 — docs site, a11y audit, fuzz + e2e tests, v1.0 release.
2. Optional — Shiki highlighter in `SourceView`; link/anchor pickers; a
   change-list / gutter view.

---

## Session 7 — Phase 8: docs, a11y, fuzz + integration tests, v1.0

**Goal:** Harden for release: documentation, an accessibility pass, fuzz + DOM
integration tests, and a v1.0.0 release.

### Documentation

| File | Purpose |
|---|---|
| `README.md` | Overview, principles, quick start, repo layout, extension table, frameworks, security, commands |
| `docs/architecture.md` | Layers, the extension contract, `TextEditor`, the two-stage clipboard pipeline, adapters, build/resolution, testing |
| `docs/extensions.md` | Every extension's options, commands and helpers |
| `docs/review.md` | Track-changes + comments deep dive (model, commands, linking, a11y, persistence) |
| `docs/security.md` | The gate, allowlist, deterministic scheme enforcement, defence in depth |
| `docs/theming.md` | CSS tokens, overriding, per-feature stylesheets |

### Accessibility audit & fixes

- **Comment panel** is now a labelled `role="region"` (`aria-label="Comments"`)
  with `aria-live="polite"`; the thread list is labelled; each per-thread control
  gets a unique accessible name (e.g. *"Resolve — comment by Alice"*); the
  click-only `<p>` body was replaced with a real **Show** button (keyboard
  operable); `<time>` now carries a `datetime`.
- **Toolbars** declare `aria-orientation="horizontal"` (buttons already exposed
  `aria-pressed`).
- New a11y assertions (`apps/playground/test/a11y.test.ts`, 8 tests) cover the
  toolbar, bubble toolbar, dialog (modal/label/focus-restore/Esc/Tab-trap),
  `requestText`, and the comment panel.

### Tests

- `packages/sanitize/test/sanitize.test.ts` — 45 tests: an OWASP-style XSS
  payload set, allowlist behaviour, `enforceUriAllowlist`, and **deterministic
  fuzzing** (seeded PRNG). Output is parsed back into the DOM and asserted inert
  (no dangerous elements, no `on*` attributes, no unsafe schemes) instead of
  naive string matching.
- `packages/extensions/paste-clean/test/paste-clean.test.ts` — 12 tests:
  `normalizePastedHtml` (Word/Office junk, spans, drops, nbsp) and
  `cleanPastedSlice` (blank edges, foreign marks, open slices), plus malformed
  input that must never throw.
- `apps/playground/test/integration.test.ts` — 8 tests exercising the full
  extension stack in a real engine: styling, the sanitize + paste-clean paste
  gates, image + anchor insertion, comment lifecycle, track + accept/reject, and
  source-view + undo/redo round-trips.
- Vitest `include` now also matches `apps/**/test/**`.

### Bugs found & fixed by the new tests

- **Sanitizer scheme bypass.** DOMPurify keeps `data:` URIs on a few tags
  regardless of `ALLOWED_URI_REGEXP`; a mutated payload slipped through. Added
  `enforceUriAllowlist`, run as a scoped `afterSanitizeAttributes` hook, which
  strips any URL attribute whose scheme is not explicitly allowlisted (handling
  obfuscating whitespace/control characters). `data:` on `img` is now blocked by
  default and only permitted when allowlisted.
- **Image extension dropped `setImage`.** `EditorImage.addCommands()` overrode
  the parent without spreading it, shadowing the base `setImage` command. It now
  spreads `this.parent?.()` before adding `setImageAlt` / `setImageCaption` /
  `setImageSize`.

### Release

- All 18 `package.json` files (and the root) bumped to **1.0.0**.
- Added MIT `LICENSE` and `CHANGELOG.md` (Keep a Changelog format).
- Added `.github/workflows/ci.yml`: `npm ci` → typecheck → test → build
  playground → build Next.js example.

### Design decisions / deviations

- **jsdom instead of Playwright for DOM integration.** The tests run the real
  TipTap/ProseMirror engine in jsdom (typing, paste gates, images, anchors,
  comments, tracking, undo, source view). Playwright would add a browser-binary
  download to CI; the jsdom suite already covers the plan's DOM-integration
  checklist without it.
- **Hand-written docs instead of generated TypeDoc.** A small `docs/` set and a
  curated README document the public API directly, avoiding a heavy doc-build
  dependency; the source is heavily JSDoc-annotated for editors.

### Verification

- `npm test` — **92/92 pass** (sanitize 45, paste-clean 12, track-changes 11,
  comments 8, integration 8, a11y 8).
- `npm run typecheck` — passes across **17** workspaces.
- `npm run build --workspace @editor/playground` — succeeds
  (~377 kB JS / ~122 kB gzip, ~7.5 kB CSS).
- `npm run build --workspace @editor/next-example` — succeeds (prerenders `/`).

### Next up (from PLAN.md)

1. Optional — Shiki highlighter in `SourceView`; link/anchor pickers; a
   change-list / gutter view for tracked changes.
2. Optional — Playwright e2e/visual snapshots on top of the jsdom suite.

