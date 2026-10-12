# Text Editor Library — Full Plan

A modular, WYSIWYG rich-text editor package (TinyMCE-like) where **every
feature is an optional, opt-in extension** — including track-changes and
comments. Built on permissive, free, no-login open-source foundations and
shipped as our own branded library.

---

## 1. Vision & Goals

- **Own the public API.** Users do `new TextEditor({ ... })` — the internals
  (TipTap/ProseMirror/DOMPurify) stay hidden dependencies.
- **Everything is optional.** Minimal core; features enabled by adding an
  extension to a config array. Disabled feature = zero bundle weight and zero
  trace in output HTML.
- **Rich content support.** Styling (bold/italic/headings/lists), images
  (upload/resize/alt), links, and page anchors.
- **Review workflow (opt-in).** Track changes (insert/delete with author +
  comment) and comment threads with highlights.
- **Framework-agnostic.** Core works anywhere; React/Vue wrappers provided.
- **Permissive licensing.** MIT/Apache only — safe to publish commercially.

### Non-goals (v1)
- Real-time collaborative editing (CRDT/OT) — deferred to v2.
- Tables and advanced media (video/embeds) — deferred to v2.
- Equations/math.

---

## 2. Architecture Principles

1. **Minimal core.** Editor engine + document model + toolbar/UI shell only.
2. **Plugin-first.** Every feature — including track-changes/comments — is an
   extension that registers its own commands, toolbar items, shortcuts, and
   persistence schema.
3. **Config-driven.** Feature flags drive both UI visibility and behavior.
4. **Clean serialization.** A disabled extension leaves no residue in HTML.
5. **Isolated complexity.** Heavy features (tracking) are boxed inside their
   own extension and don't tax users who don't enable them.
6. **Tree-shakeable.** Import only the extensions you use.
7. **Security by default.** All pasted/inserted HTML passes through the
   sanitizer gate.

---

## 3. Tech Stack (all free, no login, permissive)

### Runtime / shipped
| Library | License | Purpose |
|---|---|---|
| @tiptap/core | MIT | Editor engine (schemas, commands, extensions) |
| @tiptap/starter-kit | MIT | Base marks/nodes (bold, italic, lists, headings, history) |
| @tiptap/extension-image | MIT | Image node support |
| @tiptap/extension-link | MIT | Hyperlinks |
| ProseMirror (`prosemirror-*`) | MIT | Underlying model/selection/transactions (via TipTap) |
| DOMPurify | Apache-2.0 / MPL-2.0 | Sanitize pasted/inserted HTML (XSS) |
| `prosemirror-changeset` | MIT | Diffing for change ranges (tracking) |
| `@handlewithcare/prosemirror-suggest-changes` | MIT (verified) | Suggestion-mode base to adopt/fork; maintained successor of `prosemirror-suggest-changes` |
| `@manuscripts/track-changes-plugin` | Apache-2.0 | Mature ProseMirror track-changes base (recommended fallback) |
| image-size *(optional)* | MIT | Read image dimensions |

### Framework adapters (optional)
| Library | License |
|---|---|
| @tiptap/react | MIT |
| @tiptap/vue-3 | MIT |

### Fast-track (time-saving) choices
| Library | License | Replaces / Saves |
|---|---|---|
| Radix UI (or floating-ui) | MIT | Hand-built toolbar/dialog/popover primitives → ~2–4 wks of Phase 4 |
| Shiki | MIT | Writing our own source-view syntax highlighter → ~1 wk |
| @tiptap/react `useEditor` hooks | MIT | Rolling our own React adapter glue → ~1–2 wks |

Not used (violates §3/§17 constraints): TipTap Pro / TipTap Cloud track
changes and CKEditor 5 track changes (paid or GPL). The change tracker is
self-built on `prosemirror-changeset`, optionally adopting the MIT
`@handlewithcare/prosemirror-suggest-changes` or the Apache-2.0
`@manuscripts/track-changes-plugin` as a reference/base — never a paid/GPL
package.

### Build / dev (not shipped)
| Library | License | Purpose |
|---|---|---|
| TypeScript | Apache-2.0 | Types |
| tsup | MIT | Bundle ESM/CJS + `.d.ts` |
| Vitest + jsdom | MIT | Unit tests |
| Playwright | Apache-2.0 | Browser e2e tests |
| Storybook | MIT | UI component development |
| ESLint + Prettier | MIT | Lint + formatting |
| Changesets | MIT | Versioning + npm releases |

---

## 4. Repository Structure (pnpm + turborepo monorepo)

```
packages/
  core/            # engine, document model, selection, event bus
  plugin-api/      # extension interfaces + lifecycle types
  ui/              # headless toolbar, dialogs, popovers + default theme
  sanitize/        # DOMPurify wrapper + allowlist config
  extensions/
    styling/       # bold, italic, underline, headings, lists, blockquote
    link/          # hyperlinks
    anchor/        # page anchors (<a id>), slugify + duplicate detection
    image/         # upload adapters, resize, alt/caption
    source-view/   # HTML source mode
    history/       # undo/redo (or reuse starter-kit)
    paste-clean/   # paste normalization rules
    track-changes/ # insert/delete tracking with author + comment
    comments/      # comment threads, highlights, gutter view
  adapters/
    react/         # <Editor /> component
    vue/           # <Editor /> component
apps/
  playground/      # demo site, docs, e2e sandbox
```

---

## 5. Core Layer Design

1. **Document model & schema** — node/mark types, allowed nesting; prevents
   invalid HTML. Extensions augment the schema when enabled.
2. **Transactions** — all edits are atomic transactions → clean undo and
   reliable event notifications.
3. **Selection manager** — save/restore selection, ranges across blocks,
   keyboard nav.
4. **Serializer / parser** — model ⇄ HTML both directions; tolerant of
   malformed paste input.
5. **Sanitizer gate** — allowlist tags/attributes; href/src scheme checks;
   strip `on*` handlers; runs on paste and serialize.
6. **History** — undo/redo with typing-burst coalescing.
7. **Event bus** — `onChange`, `onFocus`, `onBlur`, `onImageUpload`,
   `onCommentAdd`, `onChangeTracked`, etc.
8. **Config / feature flags** — enables/disables extensions and UI globally.

---

## 6. Extension / Plugin System

**Extension contract:**
```
Extension = {
  name,
  // schema additions (nodes/marks)
  // commands registry
  // toolbarItems[]        → rendered by UI shell
  // keyboardShortcuts[]
  // storageSchema         → only present when enabled
  // hooks: onInit, onDestroy, onTransaction
}
```

An extension may:
- Register **commands** exposed on the editor API.
- Add **toolbar / bubble-menu** items in a configurable slot.
- Add **keyboard shortcuts**.
- Extend the **document schema** (marks/nodes).
- Contribute **persistence schema** (only when enabled).
- Intercept **transactions** (needed for tracking).

**Config example:**
```
new TextEditor({
  extensions: [Styling, Link, Anchor, Image, SourceView, TrackChanges, Comments],
  toolbar: ['bold','italic','|','image','link','|','trackChanges','comment'],
  featureFlags: { trackChanges: false }   // disable at runtime
})
```

---

## 7. Extension Catalog

| Extension | Provides | Default |
|---|---|---|
| styling | bold, italic, underline, strike, headings, lists, blockquote | on |
| link | inline link dialog, unlink, target/rel | optional |
| anchor | `<a id>` anchors, slugify, duplicate detection, picker | optional |
| image | drag-drop, paste-upload, resize handles, alt/caption, upload adapter | optional |
| source-view | raw HTML editing (lazy-loaded syntax highlighter) | optional |
| history | undo/redo | on |
| paste-clean | normalize Word/Docs/web paste to allowed schema | on |
| **track-changes** | insert/delete marks with author + timestamp + comment | **optional** |
| **comments** | comment threads, range highlights, gutter panel | **optional** |

---

## 8. Track-Changes & Comments (opt-in, deep design)

**Purpose:** like Word suggestion mode — see insertions highlighted with a
comment, and deletions retained (struck-through) with a comment, with
accept/reject.

**Insert tracking**
- New text wrapped with `insertion { author, time, commentId? }` mark.
- Rendered highlighted; attributed in margin.

**Delete tracking**
- Text is **not removed**; instead marked `deletion { author, time, commentId? }`
  (strikethrough + highlight). Actual removal happens only on accept.

**Edit interception**
- A ProseMirror `Plugin` with `appendTransaction` detects every change and
  converts it into insertion/deletion marks automatically when tracking is on.

**Comments**
- Comment data stored **separately** (id, author, timestamp, body, replies,
  status). Document carries a `comment { id }` mark on the range.
- A gutter/side panel renders threads and anchors to their ranges.
- Status: open → resolved/accepted/rejected.

**Accept / Reject commands**
- Accept insertion → strip mark, keep text.
- Reject insertion → remove text.
- Accept deletion → remove text.
- Reject deletion → strip mark, restore text.

**Persistence**
- The extension owns its own schema (authors, timestamps, statuses, comment
  threads). Only written when the extension is enabled.
- Base documents (extension off) remain clean HTML with no tracking residue.

**Complexity:** this is the heaviest feature; it is fully isolated in the
track-changes/comments extensions.

---

## 9. UI Layer

- **Headless primitives** in `ui/` (toolbar, popover, dialog, dropdown,
  color palette) + a default theme via CSS variables (light/dark).
- **Toolbar builder** reads registered extension items; order set by config.
- **Two toolbar modes:** fixed and bubble (contextual).
- **Review UI** (when tracking/comments enabled): margin gutter, thread panel,
  accept/reject actions, change list.
- **Accessibility:** ARIA roles, keyboard traversal, focus traps in dialogs.

---

## 10. Persistence & Data Model

- **Default storage:** sanitized HTML string.
- **With tracking/comments:** store rich document JSON including change tags
  and comment threads. **Design this schema in Phase 1**, even before the
  tracking extension ships, so it is forward-compatible.
- Provide **save/load adapters** (`getHTML()`, `getJSON()`, `setHTML()`,
  `setJSON()`).

---

## 11. Security

- Sanitizer gate on **every** paste and on serialize (DOMPurify + allowlist).
- URL scheme allowlist (`http`, `https`, `mailto`, `#anchor`); block
  `javascript:`.
- Image `src` validation; upload via user-owned adapter only.
- Fuzz tests with OWASP XSS payload set.
- No third-party hosted services; no API keys or logins anywhere.

---

## 12. Testing Strategy

- **Unit (Vitest):** serializer/parser round-trip, sanitizer XSS cases,
  command/transaction logic, tracking accept/reject.
- **DOM integration (Playwright):** type, paste HTML, insert image, create
  anchor link, add comment, track + accept/reject change, undo.
- **Fuzz:** malformed/random paste must never throw and must pass sanitizer.
- **Visual (Storybook):** toolbar/dialog/theme state snapshots.

---

## 13. Build & Release

- **tsup/rollup** → ESM + CJS + `.d.ts`; tree-shakeable per-extension entries
  (e.g. `@editor/extension-image`).
- CSS shipped separately (`@editor/ui/styles.css`).
- **Changesets** for semver + changelog; CI publishes to npm.
- **Docs site** (playground) with live demos + TypeDoc API reference.

---

## 14. Milestones / Phases

| Phase | Deliverable |
|---|---|
| 0 | Spike: confirm TipTap + custom PM extensions; lock repo scaffold + tooling |
| 1 | Core: schema, transactions, selection, serializer, sanitizer, event bus, config/flags; **design persistence schema** |
| 2 | Base extensions: styling, history, paste-clean, link, anchor; fixed toolbar |
| 3 | Image extension (upload adapters, resize, drag-drop, alt/caption) |
| 4 | UI layer: theming, bubble toolbar, dialogs, source-view (build on Radix UI + Shiki) |
| 5 | Plugin API freeze + React/Vue adapters |
| 6 | **Track-changes extension** (insert/delete marks, appendTransaction, accept/reject) |
| 7 | **Comments extension** (threads, highlights, gutter/panel, statuses) |
| 8 | Docs, a11y audit, fuzz + e2e tests, v1.0 release |

*(Phases 6–7 are the heavy, opt-in review features; schedule them late so
the base editor ships and validates first.)*

---

## 15. Team & Timeline Estimate

Assumes 1–2 senior developers.

| Approach | MVP | Production v1 |
|---|---|---|
| On TipTap (this plan, without tracking) | ~1–2 weeks | ~1.5–3 months |
| + Track-changes & comments | +6–10 weeks | **+2–4 months** |
| Fast-track (Radix + Shiki + tiptap/react hooks) | saves ~3–6 weeks total | base v1 nearer the low end |
| Fully from scratch (rejected) | 3–5 months | 9–15 months |

**Change tracker decision:** the optional change tracker is self-built on
TipTap + `prosemirror-changeset` (Phases 6–7), optionally adopting the MIT
`@handlewithcare/prosemirror-suggest-changes` or the Apache-2.0
`@manuscripts/track-changes-plugin` as a reference/base. No paid/GPL package
is used; when the extension is disabled the editor carries zero tracking code
or output residue.

---

## 16. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Track-changes complexity explodes | Isolate in its own extension; adopt/fork `@handlewithcare/prosemirror-suggest-changes` (MIT) or base on `@manuscripts/track-changes-plugin` (Apache-2.0); schedule late |
| contenteditable browser inconsistencies | Never expose raw DOM; model + serializer normalization |
| XSS via paste/serialize | Sanitizer gate; allowlist; fuzz tests |
| Scope creep toward full TinyMCE | Extension-first design keeps core lean; defer tables/media to v2 |
| TipTap abstraction blocks deep tracking | Drop to ProseMirror primitives inside extensions (TipTap is a thin wrapper) |
| Paid-only features (e.g. TipTap Pro comments) | Build tracking/comments ourselves as custom extensions |

---

## 17. Summary of Decisions

- **Foundation:** TipTap (MIT) — fastest, permissive, extensible.
- **Deep features:** custom ProseMirror-level extensions for tracking/comments.
- **Everything optional:** extension array + feature flags; disabled = no
  weight, no output residue.
- **Security:** DOMPurify sanitizer gate on paste/serialize.
- **Licensing:** all MIT/Apache, no login, no paid services → safe to publish.
- **Backend:** image/file upload uses the adopter's own adapter.
- **Fast-track:** reuse MIT UI/highlighting primitives (Radix UI, Shiki,
  tiptap/react hooks) instead of building them — no change to the public API.
- **Change tracker:** self-built (opt-in) on `prosemirror-changeset`, optionally
  adopting `@handlewithcare/prosemirror-suggest-changes` (MIT) or
  `@manuscripts/track-changes-plugin` (Apache-2.0) — never a paid/GPL package.
