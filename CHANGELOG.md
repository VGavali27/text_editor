# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **UI icons**: toolbar controls render built-in SVG icons when an extension item
  supplies `icon` (with an optional `shortcut` hint); the text label stays the
  accessible name. Icons are vendored from Lucide (ISC, dev-only
  `lucide-static` generator → zero runtime dependency) and regenerate with
  `npm run icons`.
- **Menu bar**: `createMenuBar(editor, element, menus)` renders a TinyMCE-style
  `File` / `Edit` / `Insert` menu bar from plain data (`role="menubar"`/`menu`,
  arrow-key navigation, Home/End, Esc, click-outside), with live `disabled` /
  `checked` states.
- **Styling**: new `code`, `codeBlock`, and `horizontalRule` toolbar items.
- **Dropdown + color controls**: `ToolbarItem` now supports `options` (renders a
  `<select>`) and `type: 'color'` (renders a native color input with a clear
  button); `run(editor, value?)` receives the selected value.
- **Alignment** (`@editor/extension-align`): left / center / right / justify on
  paragraphs and headings (inline `text-align`).
- **List styles** (`@editor/extension-list-styles`): ordered `123 / abc / ABC /
  i / I` and bullet `disc / circle / square` marker styles, as toolbar dropdowns.
- **Color** (`@editor/extension-color`): text color, text highlight and block
  background, as native color controls.
- **Sanitizer**: `style` is now allowed but reduced by a deterministic
  `enforceStyleAllowlist` hook to `color`, `background-color`, `text-align` and
  `list-style-type` with validated values — colours survive paste without opening
  a CSS injection path.
- **Playground**: wires `Align()`, `ListStyles()` and `Color()` and adds a
  `Format` menu (alignment + clear colour / highlight / block background).
- **Find & replace** (`@editor/extension-find`): case-insensitive search with
  live highlights, next/previous, replace-current and replace-all commands, and
  a ready-made `createFindBar` (Ctrl+F).
- **Word count** (`@editor/extension-word-count`): words / characters /
  characters-no-spaces, live via `createWordCount` or the `onChange` callback.
- **Special characters & emoticons** (`@editor/extension-special-chars`):
  `insertCharacter` command and an `openCharacterPicker` dialog grid.
- **Insert** (`@editor/extension-insert`): date/time (formattable), page-break
  node, and non-breaking space; sanitizer now allows the page-break `div`
  (`data-page-break`) and `dir` attributes.
- **Direction** (`@editor/extension-direction`): LTR / RTL on blocks.
- **Fullscreen** (`@editor/extension-fullscreen`): class + Fullscreen API toggle.
- **Help** (`@editor/extension-help`): shortcuts reference dialog.
- **Playground**: wires all of the above, adds `View` / `Tools` / `Help` menus,
  insert-menu entries, a find bar (Ctrl+F) and a live word-count status footer.

## [1.0.0] - 2026-10-12

First stable release. A modular, opt-in WYSIWYG editor: every feature is an
optional extension, and disabling a feature means no bundle weight and no output
residue.

### Added

- **Core** (`@editor/core`, `@editor/plugin-api`): `new TextEditor({ element,
  content, extensions, onChange })` wrapping TipTap; the internals (TipTap /
  ProseMirror / DOMPurify) stay hidden behind the extension contract.
- **Base extensions**: `styling`, `history`, `link`, `anchor`, `paste-clean`.
- **Media**: `image` — adopter-owned `upload` adapter, drag-drop + paste upload,
  resize handles, alt/caption editing.
- **UI** (`@editor/ui`): headless `createToolbar` / `createBubbleToolbar`,
  accessible `openDialog` / `requestText`, and a CSS-variable theme
  (`@editor/ui/styles.css`).
- **Source view**: `SourceView` with a Shiki-compatible `highlight` hook.
- **Adapters**: `@editor/adapter-react` (SSR-safe, `"use client"` for Next.js
  App Router) and `@editor/adapter-vue`; `apps/next-example` demonstrates
  Next.js 14 App Router integration.
- **Review**: `@editor/extension-track-changes` (Word-style suggestion mode built
  on `prosemirror-changeset`) and `@editor/extension-comments` (threads stored
  outside the document) with a sidebar panel.
- **Security**: DOMPurify allowlist gate on paste and serialize, with a URL
  scheme allowlist and a deterministic `enforceUriAllowlist` pass.
- **Testing**: Vitest + jsdom harness with unit, DOM integration, accessibility,
  XSS-payload and fuzz suites.
- Docs (`README.md`, `docs/`), an MIT `LICENSE`, and a GitHub Actions CI
  workflow.

### Fixed

- Sanitizer: `data:` URIs (and any other disallowed scheme) could survive on a
  few tags. They are now stripped by `enforceUriAllowlist` unless the scheme is
  explicitly allowlisted.
- Image: the extended image node dropped the parent `setImage` command; it is
  now preserved alongside `setImageAlt` / `setImageCaption` / `setImageSize`.
- Comments panel: per-thread controls now expose unique accessible names, the
  panel is a labelled live region, and "Show in document" is a real button
  instead of a click-only paragraph.

[1.0.0]: https://github.com/VGavali27/text_editor/releases/tag/v1.0.0
