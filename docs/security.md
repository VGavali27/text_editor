# Security

The editor treats pasted HTML as untrusted input.

## The gate

`sanitizeHtml(html, config)` runs DOMPurify with a strict allowlist and is wired
into the editor's paste path via the `Sanitize()` extension (a
`transformPastedHTML` plugin). The same function is exported so hosts can route
serialized HTML through it too.

```ts
import { sanitizeHtml, Sanitize } from '@editor/sanitize'

sanitizeHtml(untrusted)
// or: Sanitize({ normalize: normalizePastedHtml })
```

### Allowlist

- **Tags** — a safe subset: paragraphs, headings, lists, blockquote, inline
  formatting, `a`, `img`, `figure`/`figcaption`, `hr`, `br`, …
- **Attributes** — `href`, `target`, `rel`, `title`, `src`, `alt`, `width`,
  `height`, `id`, `class`, `style`, plus the review `data-*` attributes
  (`data-insertion`, `data-deletion`, `data-author`, `data-date`,
  `data-comment`, `data-comment-id`). The review attributes are inert when the
  review extensions are off.
- **URL schemes** — `http`, `https`, `mailto`, `tel` by default. Everything else
  (`javascript:`, `vbscript:`, `data:`, `file:`, …) is blocked.
- **Inline styles** — only the four properties the editor itself emits
  (`color`, `background-color`, `text-align`, `list-style-type`), each with a
  validated value. Everything else is dropped.

### Deterministic scheme enforcement

DOMPurify keeps `data:` URIs on a handful of tags (e.g. `img`) by default,
regardless of `ALLOWED_URI_REGEXP`. To close that gap the sanitizer adds a
scoped `afterSanitizeAttributes` hook that runs `enforceUriAllowlist` on every
element: any `href`/`src`/… whose scheme is not explicitly allowlisted is
removed. Obfuscation (tabs, newlines, control characters) is stripped before the
scheme is read, so `java\tscript:` is caught.

To intentionally allow a scheme (e.g. base64 images), list it explicitly:

```ts
Sanitize({ allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'] })
```

### Deterministic style enforcement

The same hook runs `enforceStyleAllowlist` on every element. A `style`
attribute is re-parsed declaration by declaration and reduced to the allowlisted
properties above; each value must match a strict pattern (hex/rgb/hsl color, a
named color, an alignment keyword, or a known `list-style-type`). This strips
`position: fixed`, `background-image: url(…)`, `width: expression(…)`,
`!important`, and any other declaration that could be used for injection or
clickjacking. `enforceStyleAllowlist(element)` is exported for hosts that want
the same guarantee outside the paste path.

## Defence in depth

1. **`transformPastedHTML`** (sanitize) — allowlist gate on the raw clipboard
   HTML. The optional `normalize` pre-step runs *before* the gate and cannot
   bypass it (the result is still allowlisted).
2. **`transformPasted`** (paste-clean) — after parsing, unknown nodes/marks are
   dropped against the schema.
3. **Serialization** — hosts can pass `getHTML()` output through `sanitizeHtml`.

## No hosted services

There are no logins, API keys, telemetry or hosted backends anywhere. Image
uploads go through a **host-owned** adapter (`upload: (file) => Promise<…>`); the
library never chooses a destination. Links and images are validated against the
URL allowlist.

## Test coverage

- **OWASP payload suite** — script tags, event handlers, `javascript:`/`data:`
  URLs, `iframe`/`object`/`embed`, `style`/`@import`, `expression(…)`, mutation
  vectors, … Each payload is parsed back into the DOM and asserted inert (no
  dangerous elements, no `on*` attributes, no unsafe schemes) rather than merely
  string-matched.
- **Deterministic fuzz** — a seeded PRNG generates hostile strings and mutated
  payloads; the sanitizer must never throw, must always return a string, and must
  never emit an active vector.

Run them with `npm test` (see `packages/sanitize/test/sanitize.test.ts`).
