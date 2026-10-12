# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
