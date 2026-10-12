# Extensions reference

Every feature is added explicitly to the `extensions` array:

```ts
new TextEditor({ element, extensions: [Styling(), History(), Link()] })
```

---

## `@editor/sanitize`

Security gate. Runs DOMPurify with a strict allowlist on paste and is exported
for serialization.

```ts
import { Sanitize, sanitizeHtml, normalizePastedHtml } from '@editor/sanitize'

Sanitize({ normalize: normalizePastedHtml }) // extension
sanitizeHtml('<p>…</p>')                     // string in, sanitized string out
```

| Option | Default | Meaning |
|---|---|---|
| `allowedTags` | a safe HTML subset | Tags allowed to survive |
| `allowedAttributes` | a safe subset (incl. review `data-*`) | Attributes allowed to survive |
| `allowedSchemes` | `['http', 'https', 'mailto', 'tel']` | URL schemes allowed in `href`/`src` |
| `normalize` | — | Pre-step applied *before* the allowlist (cannot bypass it) |

Also exports `SanitizePaste(config)` (the raw ProseMirror extension) and
`enforceUriAllowlist(element, schemes)`.

---

## `@editor/core` + `@editor/plugin-api`

```ts
import { TextEditor } from '@editor/core'
import type { TextEditorOptions, TextEditorExtension, ToolbarItem } from '@editor/plugin-api'

const editor = new TextEditor({ element, content, extensions, editable, onChange, onFocus, onBlur })
```

Write a custom extension by returning a `TextEditorExtension`. See
[architecture.md](architecture.md).

A `ToolbarItem` may also set `icon` (a built-in icon name — see
[Icons & menu bar](#icons--menu-bar)) and `shortcut` (a keyboard hint shown in
tooltips and menus); both are optional and cosmetic.

---

## `@editor/extension-styling`

```ts
Styling({ headingLevels: [1, 2, 3] })
```

Bold, italic, underline, strike, inline code, headings, bullet/ordered lists,
blockquote, code block, hard break and horizontal rule, each with a toolbar
control.

---

## `@editor/extension-history`

```ts
History()
```

Undo / redo with typing-burst coalescing. Toolbar items `undo`, `redo`.

---

## `@editor/extension-link`

```ts
Link({
  openOnClick: false,
  autolink: true,
  linkOnPaste: true,
  onRequestUrl: async (current) => await myDialog(current),
})
```

| Option | Default | Meaning |
|---|---|---|
| `openOnClick` | `false` | Follow links on click |
| `autolink` | `true` | Turn typed URLs into links |
| `linkOnPaste` | `true` | Linkify pasted URLs |
| `htmlAttributes` | — | Extra attributes on every `<a>` |
| `onRequestUrl` | `window.prompt` | Ask the host for a URL; `null` cancels, `''` removes |

Bare hosts (`example.com`) are upgraded to `https://`. Toolbar items `link`,
`unlink`.

---

## `@editor/extension-anchor`

```ts
Anchor({ onRequestName: async (suggested, taken) => await myDialog(suggested, taken) })
```

| Option | Default | Meaning |
|---|---|---|
| `htmlAttributes` | — | Extra attributes on every anchor |
| `onRequestName` | `window.prompt` | Ask the host for a name; `null` cancels |

Helpers: `slugify(text)`, `uniqueId(base, taken)`, `collectAnchorIds(editor)`.
Commands: `setAnchor({ id })`, `unsetAnchor()`. The node only claims `<a id>`
elements **without** an `href`, so real hyperlinks stay owned by `link`.

---

## `@editor/extension-image`

```ts
ImageExtension({
  upload: async (file) => ({ src: await uploadToMyCdn(file) }),
  accept: 'image/*',
  inline: false,
  allowBase64: false,
  onRequestUrl: async () => await myUrlDialog(),
  onRequestAlt: async (current) => await myAltDialog(current),
  onRequestCaption: async (current) => await myCaptionDialog(current),
})
```

| Option | Default | Meaning |
|---|---|---|
| `upload` | — | Host-owned upload adapter (`File => Promise<string \| { src, alt?, title?, width?, height? }>`) |
| `accept` | `image/*` | File-picker filter |
| `inline` | `false` | Render images inline vs. as blocks |
| `allowBase64` | `false` | Allow `data:` image sources |
| `onRequestUrl` / `onRequestAlt` / `onRequestCaption` | prompts | Host dialogs |

Drag-drop and paste of image files call `upload` and insert the node; natural
dimensions are read client-side when the adapter doesn't supply them.

Commands: `setImage({ src, … })` (base TipTap), `setImageAlt(alt)`,
`setImageCaption(caption)`, `setImageSize({ width, height })`. Toolbar items
`image`, `imageAlt`, `imageCaption`.

---

## `@editor/extension-paste-clean`

```ts
PasteClean()
```

Post-parse structural cleanup on `transformPasted`: strips foreign nodes/marks,
Word/Office namespaced junk, attribute-less spans, and blank edge paragraphs; and
converts non-breaking spaces.

Helpers: `normalizePastedHtml(html, doc?)` (pre-parse, for the sanitizer's
`normalize` option) and `cleanPastedSlice(slice, schema)`.

---

## `@editor/extension-source-view`

```ts
SourceView({
  label: 'HTML',
  highlight: (code) => shiki.codeToHtml(code, { lang: 'html', theme: 'github-dark' }),
  sanitize: sanitizeHtml,
  onToggle: (active) => {},
})
```

Swaps the WYSIWYG surface for a synced `<textarea>` (with an optional highlighted
layer behind it). Without a `highlight` hook it is a plain monospace textarea.

Helpers: `enterSourceView(editor, options)`, `exitSourceView(editor, options)`,
`isSourceView(editor)`. Toolbar item `sourceView`. Import
`@editor/extension-source-view/styles.css`.

---

## `@editor/extension-track-changes`

See [review.md](review.md). Toolbar items `trackChanges`, `acceptChanges`,
`rejectChanges`.

---

## `@editor/extension-comments`

See [review.md](review.md). Toolbar item `addComment`; sidebar via
`createCommentPanel`.

---

## `@editor/ui`

Framework-agnostic UI shell.

```ts
import {
  createToolbar, createBubbleToolbar, openDialog, requestText,
} from '@editor/ui'
import '@editor/ui/styles.css'

const toolbar = createToolbar(editor, toolbarElement) // { refresh, destroy }
const bubble = createBubbleToolbar(editor, { items })
const dialog = openDialog(contentElement, { label: 'Title', onClose })
const value = await requestText({ title: 'Link', label: 'URL', value: 'https://' })
```

`openDialog` traps focus, closes on Esc/backdrop, restores focus, and locks body
scroll. `requestText` resolves with the entered string, `''` (if `allowEmpty`),
or `null` on cancel.

### Icons & menu bar

Toolbar controls render an SVG icon when their `ToolbarItem.icon` matches a
built-in name; otherwise they fall back to the text label. The accessible name is
always the label (`aria-label` for icon-only buttons), and `shortcut` is appended
to the tooltip.

```ts
import { createMenuBar, createIcon, hasIcon, iconNames } from '@editor/ui'

const menubar = createMenuBar(editor, menubarElement, [
  {
    label: 'Insert',
    items: [
      { label: 'Link', icon: 'link', shortcut: 'Ctrl+K', run: (e) => openMyLinkDialog(e) },
      { label: 'Divider', icon: 'hr', separatorBefore: true, run: (e) => e.engine.chain().focus().setHorizontalRule().run() },
    ],
  },
])

menubar.refresh() // re-evaluate disabled / checked after external changes
menubar.destroy()
```

`createMenuBar` renders a `role="menubar"` with `role="menu"` dropdowns and full
keyboard support (Arrow keys between menus and items, Home/End, Enter/Space to
run, Esc to close, click-outside to dismiss). Items support `disabled` and
`checked` as either a boolean or a `(editor) => boolean` that is re-evaluated on
every editor transaction.

Icons are vendored from [Lucide](https://lucide.dev) (ISC) at generation time and
embedded in `packages/ui/src/icons.ts` — **no runtime icon dependency**. Use
`hasIcon(name)` / `iconNames()` to discover names, `createIcon(name)` to build a
fresh `SVGElement`, and `npm run icons` to regenerate. See
[`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md).
