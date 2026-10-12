# Theming

The default theme lives in `@editor/ui/styles.css` and is driven by CSS custom
properties, so you can restyle everything without touching the DOM.

```ts
import '@editor/ui/styles.css'
```

## Tokens

| Variable | Purpose |
|---|---|
| `--editor-border` | Borders / separators |
| `--editor-bg` | Surface background |
| `--editor-fg` | Foreground text |
| `--editor-muted` | Secondary text |
| `--editor-accent` | Accent (active controls, focus) |
| `--editor-accent-fg` | Text on the accent |
| `--editor-active-bg` | Active toggle background |
| `--editor-surface` | Dialog surface |
| `--editor-radius` | Corner radius |
| `--editor-shadow` | Popover / dialog shadow |
| `--editor-font-mono` | Monospace font stack (code, source view) |

Light and dark values are provided automatically via `prefers-color-scheme`.

## Overriding

Set the tokens on `:root` (or any ancestor of the editor) after importing the
theme:

```css
:root {
  --editor-accent: #7c3aed;
  --editor-active-bg: #ede9fe;
  --editor-radius: 4px;
}
```

Force a scheme regardless of the OS setting by defining the tokens yourself:

```css
.my-editor {
  --editor-bg: #0d1117;
  --editor-fg: #e6edf3;
  --editor-border: #30363d;
  --editor-muted: #9198a1;
  --editor-surface: #0d1117;
}
```

## Per-feature CSS

CSS ships separately and only needs importing when the matching feature is
enabled:

| Feature | Stylesheet |
|---|---|
| Toolbar / bubble / dialogs | `@editor/ui/styles.css` |
| Source view | `@editor/extension-source-view/styles.css` |
| Track changes (insertion / deletion marks) | `@editor/extension-track-changes/styles.css` |
| Comments (mark + panel) | `@editor/extension-comments/styles.css` |

Disable a feature and simply don't import its stylesheet — there is no residue.

In Next.js, import `@editor/ui/styles.css` from the root layout (a server
component) and the feature stylesheets from the client component that enables
them.
