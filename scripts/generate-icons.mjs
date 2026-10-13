// Generates packages/ui/src/icons.ts by vendoring a curated subset of Lucide
// icons (ISC). Run with: npm run icons
//
// Only the icons listed in MAP are vendored — Lucide itself is never shipped to
// the browser; it is a dev-only dependency used at generation time.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = join(root, 'node_modules', 'lucide-static', 'icons')

/** our icon name -> lucide-static file name */
const MAP = {
  // inline styling
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strikethrough',
  code: 'code',
  codeBlock: 'square-code',
  heading1: 'heading-1',
  heading2: 'heading-2',
  heading3: 'heading-3',
  bulletList: 'list',
  orderedList: 'list-ordered',
  blockquote: 'text-quote',
  hr: 'minus',
  clearFormatting: 'remove-formatting',
  // alignment
  alignLeft: 'align-left',
  alignCenter: 'align-center',
  alignRight: 'align-right',
  alignJustify: 'align-justify',
  // color
  palette: 'palette',
  highlighter: 'highlighter',
  paintBucket: 'paint-bucket',
  // history / editing
  undo: 'undo-2',
  redo: 'redo-2',
  selectAll: 'box-select',
  // link / anchor
  link: 'link',
  unlink: 'unlink',
  anchor: 'anchor',
  // media
  image: 'image',
  imageAlt: 'type',
  imageCaption: 'captions',
  // view / review
  source: 'file-code',
  track: 'pencil-line',
  accept: 'check',
  reject: 'x',
  comment: 'message-square-text',
  // file menu
  new: 'file-plus',
  open: 'folder-open',
  exportHtml: 'download',
  exportJson: 'file-json',
  save: 'save',
  // find & replace
  find: 'search',
  replace: 'replace',
  chevronUp: 'chevron-up',
  chevronDown: 'chevron-down',
  close: 'x',
  // insert
  calendar: 'calendar',
  clock: 'clock',
  pageBreak: 'separator-horizontal',
  nbsp: 'space',
  // direction
  ltr: 'arrow-right-to-line',
  rtl: 'arrow-left-to-line',
  // view
  fullscreen: 'maximize',
  exitFullscreen: 'minimize',
  // help & characters
  help: 'circle-help',
  charmap: 'sigma',
  smile: 'smile',
  keyboard: 'keyboard',
}

const ATTRS =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" class="editor-icon" aria-hidden="true" focusable="false"'

/** Extract the inner markup of a Lucide SVG (drop the license comment + wrapper). */
function inner(file) {
  const svg = readFileSync(join(iconsDir, `${file}.svg`), 'utf8')
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
}

const entries = Object.entries(MAP).map(([name, file]) => [
  name,
  `<svg ${ATTRS}>${inner(file)}</svg>`,
])

const banner = `/*!
 * Icons vendored from Lucide (https://lucide.dev). Lucide is ISC-licensed.
 * See THIRD-PARTY-NOTICES.md. Regenerate with \`npm run icons\`
 * (dev-only \`lucide-static\` dependency — nothing ships to the browser).
 */`

const body = `
/** SVG markup for each built-in icon, keyed by name. */
export const iconSvgs = {
${entries.map(([name, svg]) => `  ${name}:\n    '${svg.replace(/'/g, "\\'")}',`).join('\n')}
} as const

export type IconName = keyof typeof iconSvgs

/** Markup for \`name\`, or \`null\` when the icon is unknown. */
export function iconMarkup(name: string): string | null {
  return Object.prototype.hasOwnProperty.call(iconSvgs, name)
    ? iconSvgs[name as IconName]
    : null
}

/** Whether a built-in icon exists for \`name\`. */
export function hasIcon(name: string): boolean {
  return iconMarkup(name) != null
}

/** Every built-in icon name. */
export function iconNames(): string[] {
  return Object.keys(iconSvgs)
}

/**
 * Create a fresh SVG element for \`name\` (a new node per call, so it can appear
 * in many places). Returns \`null\` for an unknown icon or when there is no DOM.
 */
export function createIcon(name: string): SVGElement | null {
  const markup = iconMarkup(name)
  if (!markup || typeof document === 'undefined') return null
  const template = document.createElement('template')
  template.innerHTML = markup
  const node = template.content.firstElementChild
  return node instanceof SVGElement ? node : null
}
`

writeFileSync(join(root, 'packages', 'ui', 'src', 'icons.ts'), `${banner}\n${body}`)
console.log(`wrote packages/ui/src/icons.ts (${entries.length} icons)`)
