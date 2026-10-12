import { describe, expect, it } from 'vitest'
import { enforceUriAllowlist, sanitizeHtml } from '@editor/sanitize'

/**
 * OWASP XSS filter-evasion cheat-sheet style payloads. Every one of these must
 * come out of the sanitizer inert: no script execution vectors, no unsafe URL
 * schemes, and never a thrown exception.
 */
const XSS_PAYLOADS: string[] = [
  '<script>alert(1)</script>',
  '"><script>alert(1)</script>',
  "'><script>alert(String.fromCharCode(88,83,83))</script>",
  '<img src=x onerror=alert(1)>',
  '<img src=x onerror="alert(1)">',
  '<svg/onload=alert(1)>',
  '<svg><script>alert(1)</script></svg>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="java\tscript:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<body onload=alert(1)>',
  '<b onmouseover=alert(1)>hover</b>',
  '<div onpointerover="alert(1)">x</div>',
  '<form action="javascript:alert(1)"><input type="submit"></form>',
  '<input onfocus=alert(1) autofocus>',
  '<input onblur=alert(1) autofocus><input autofocus>',
  '<video><source onerror=alert(1)></video>',
  '<audio src=x onerror=alert(1)>',
  '<details open ontoggle=alert(1)>',
  '<object data="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></object>',
  '<embed src="javascript:alert(1)">',
  '<style>@import "javascript:alert(1)";</style>',
  '<style>body{background:url("javascript:alert(1)")}</style>',
  '<link rel="stylesheet" href="javascript:alert(1)">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>',
  '<table background="javascript:alert(1)"><tr><td>x</td></tr></table>',
  '<img src="data:text/html,<script>alert(1)</script>">',
  '<img src="data:text/html,<script>alert(1)</sc;xxript>">',
  '<xss style="xss:expression(alert(1))">x</xss>',
  '\u0000<script>alert(1)</script>',
]

/** Tags that must never survive the gate, whatever the payload. */
const DANGEROUS_TAGS = [
  'script', 'iframe', 'object', 'embed', 'style', 'link', 'meta', 'form',
  'input', 'svg', 'math', 'template', 'base', 'noscript', 'audio', 'video',
  'details', 'body',
]

const URI_ATTRIBUTES = new Set([
  'href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background',
  'cite', 'data', 'srcdoc', 'longdesc',
])

const OBFUSCATING = /[\u0000-\u0020\u007f-\u009f]/g

/**
 * Parse the sanitizer output and assert that nothing in it can execute: no
 * dangerous elements, no event-handler attributes, no unsafe URL schemes.
 * This is far more reliable than string matching (harmless text can contain
 * the substring "on…=" or "data:").
 */
function assertInert(html: string): void {
  const container = document.createElement('div')
  container.innerHTML = html

  for (const tag of DANGEROUS_TAGS) {
    expect(container.querySelector(tag), `unexpected <${tag}>`).toBeNull()
  }

  for (const element of Array.from(container.querySelectorAll('*'))) {
    for (const attr of element.getAttributeNames()) {
      const name = attr.toLowerCase()
      expect(name.startsWith('on'), `event handler attribute ${name}`).toBe(false)
      const value = element.getAttribute(attr) ?? ''
      expect(value).not.toMatch(/expression\s*\(/i)
      if (URI_ATTRIBUTES.has(name)) {
        expect(value.replace(OBFUSCATING, ''), `unsafe ${name} scheme`).not.toMatch(
          /^(javascript|vbscript|data|file):/i,
        )
      }
    }
  }
}

describe('sanitizeHtml: XSS payloads', () => {
  it.each(XSS_PAYLOADS)('neutralizes %j', (payload) => {
    let output = ''
    expect(() => {
      output = sanitizeHtml(payload)
    }).not.toThrow()
    expect(typeof output).toBe('string')
    assertInert(output)
  })
})

describe('sanitizeHtml: allowlist behaviour', () => {
  it('keeps ordinary formatting', () => {
    const output = sanitizeHtml('<p>Hello <strong>bold</strong> <em>it</em></p>')
    expect(output).toBe('<p>Hello <strong>bold</strong> <em>it</em></p>')
  })

  it('keeps safe link schemes but drops the unsafe ones', () => {
    expect(sanitizeHtml('<a href="https://example.com">ok</a>')).toContain('href="https://example.com"')
    expect(sanitizeHtml('<a href="mailto:a@b.c">mail</a>')).toContain('href="mailto:a@b.c"')
    const unsafe = sanitizeHtml('<a href="javascript:alert(1)">bad</a>')
    expect(unsafe).not.toContain('javascript:')
    expect(unsafe).toBe('<a>bad</a>')
  })

  it('strips data: URIs by default', () => {
    expect(sanitizeHtml('<img src="data:image/png;base64,AAAA">')).not.toContain('data:')
    expect(sanitizeHtml('<img src="data:text/html,<script>alert(1)</script>">')).not.toContain('data:')
  })

  it('honours an explicitly allowlisted data: scheme', () => {
    const output = sanitizeHtml('<img src="data:image/png;base64,AAAA">', {
      allowedSchemes: ['data'],
    })
    expect(output).toContain('data:image/png;base64,AAAA')
  })

  it('keeps review marks but strips arbitrary data attributes', () => {
    const review = sanitizeHtml(
      '<span data-insertion="true" data-author="Alice" data-date="1000">x</span>',
    )
    expect(review).toContain('data-insertion="true"')
    expect(review).toContain('data-author="Alice"')

    const arbitrary = sanitizeHtml('<p data-tracker="x" data-anything="y">t</p>')
    expect(arbitrary).not.toContain('data-tracker')
    expect(arbitrary).not.toContain('data-anything')
  })

  it('honours custom allowlists', () => {
    const output = sanitizeHtml('<p data-x="1">hi</p>', {
      allowedTags: ['p'],
      allowedAttributes: ['data-x'],
    })
    expect(output).toBe('<p data-x="1">hi</p>')
  })

  it('cannot be bypassed by the normalize pre-step', () => {
    const output = sanitizeHtml('<p>safe</p>', {
      normalize: (html) => `${html}<script>alert(1)</script>`,
    })
    expect(output).not.toMatch(/<script/i)
    expect(output).toContain('safe')
  })
})

describe('enforceUriAllowlist', () => {
  it('removes disallowed schemes while keeping relative URLs', () => {
    const element = document.createElement('div')
    element.innerHTML =
      '<a id="a" href="javascript:alert(1)"></a>' +
      '<a id="b" href="/relative"></a>' +
      '<a id="c" href="#anchor"></a>' +
      '<a id="d" href="https://ok.example"></a>' +
      '<img id="e" src="data:image/png;base64,AAAA">'

    const schemes = ['http', 'https', 'mailto', 'tel']
    for (const node of Array.from(element.querySelectorAll('*'))) {
      enforceUriAllowlist(node, schemes)
    }

    expect(element.querySelector('#a')?.hasAttribute('href')).toBe(false)
    expect(element.querySelector('#b')?.getAttribute('href')).toBe('/relative')
    expect(element.querySelector('#c')?.getAttribute('href')).toBe('#anchor')
    expect(element.querySelector('#d')?.getAttribute('href')).toBe('https://ok.example')
    expect(element.querySelector('#e')?.hasAttribute('src')).toBe(false)
  })
})

/* ------------------------------------------------------------------ fuzz */

/** Deterministic PRNG so failures are reproducible. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const ALPHABET = [
  '<', '>', '/', '"', "'", '=', ' ', '\\', '\t', '\n', '\u0000', '&', '#', ';',
  's', 'c', 'r', 'i', 'p', 't', 'a', 'l', 'e', 'o', 'n', 'w', 'x', 'j',
  'd', 'v', 'm', 'g', ':', '(', ')', '!', '-', '1', '%',
]

function randomString(random: () => number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(random() * ALPHABET.length)]
  }
  return out
}

describe('sanitizeHtml: fuzz', () => {
  it('never throws and never emits an active vector', () => {
    const random = makeRandom(0xc0ffee)
    for (let i = 0; i < 1000; i += 1) {
      const input = randomString(random, 1 + Math.floor(random() * 120))
      let output = ''
      expect(() => {
        output = sanitizeHtml(input)
      }).not.toThrow()
      assertInert(output)
    }
  })

  it('never throws on mutated XSS payloads', () => {
    const random = makeRandom(0x5eed)
    for (const payload of XSS_PAYLOADS) {
      for (let i = 0; i < 20; i += 1) {
        const cut = Math.floor(random() * payload.length)
        const mutated = `${payload.slice(0, cut)}${randomString(random, 8)}${payload.slice(cut)}`
        let output = ''
        expect(() => {
          output = sanitizeHtml(mutated)
        }).not.toThrow()
        assertInert(output)
      }
    }
  })

  it('always returns a string for hostile input', () => {
    const inputs = [
      '',
      '<',
      '>>>>',
      '<p',
      '<p>unclosed',
      '<a href=',
      '<a href="',
      '<img src="x" onerror=',
      '\u0000\u0001\u0002',
      '<!-- comment --><p>ok</p>',
      '<div><div><div><p>deep</p></div></div></div>',
      '<p>a</p>'.repeat(500),
    ]
    for (const input of inputs) {
      const output = sanitizeHtml(input)
      expect(typeof output).toBe('string')
      assertInert(output)
    }
  })
})
