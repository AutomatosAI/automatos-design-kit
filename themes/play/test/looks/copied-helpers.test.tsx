/**
 * PRD-261 A-14d — what Play's look editor copied from core when it stopped importing it, held to core's own, so the
 * two never drift apart.
 *
 * Moved from core's components/looks/__tests__/copied-helpers.test.tsx and rewritten for the kit (PRD-261 B-05e):
 * core's modules are not in the kit, so what core's helpers do is written down here as core has it at
 * 101a0bf33f64fb4f89af81b4293415be60b661ac, where core's test ran both side by side:
 *
 * - downloadText (core's lib/download-text.ts → components/looks/download-text.ts): the same file, the same link
 *   taken away, the URL let go after the same delay, DOWNLOAD_REVOKE_AFTER_MS = 1000;
 * - copyToClipboard (core's lib/utils.ts → components/looks/clipboard.ts): true once the browser takes the text;
 *   false, logged as console.error('Failed to copy to clipboard:', error), when it refuses;
 * - the sample card's kind word (core's lib/chat/deliverables.ts KIND_WORDS.document, 'Document' → the style
 *   sheet's SAMPLE_KIND);
 * - the mark on a Play-only screen's h1 (components/looks/screen-heading.ts): builtin Play's host finds it by
 *   SCREEN_HEADING_SELECTOR ('[data-play-only-heading]', core's lib/theme-host/builtin/play-only-route.tsx), and the
 *   host's look runtime under an installed theme by '[data-theme-heading]' (PRD-261 K-19c).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { copyToClipboard } from '../../src/components/looks/clipboard.ts'
import { DOWNLOAD_REVOKE_AFTER_MS, downloadText } from '../../src/components/looks/download-text.ts'
import { PLAY_ONLY_HEADING } from '../../src/components/looks/screen-heading.ts'
import { SAMPLE_KIND } from '../../src/components/looks/style/style-components.tsx'

const BLOB_URL = 'blob:a14d-download'

/** Core's lib/download-text.ts DOWNLOAD_REVOKE_AFTER_MS. */
const CORE_REVOKE_AFTER_MS = 1000
/** What core's lib/utils.ts copyToClipboard logs, with the refusal, when the browser refuses. */
const CORE_COPY_REFUSED = 'Failed to copy to clipboard:'
/** Core's lib/chat/deliverables.ts KIND_WORDS.document. */
const CORE_DOCUMENT_WORD = 'Document'
/** Core's lib/theme-host/builtin/play-only-route.tsx SCREEN_HEADING_SELECTOR. */
const CORE_SCREEN_HEADING_SELECTOR = '[data-play-only-heading]'
/** The heading the host's look runtime looks for under an installed theme (PRD-261 K-19c). */
const THEME_HEADING_SELECTOR = '[data-theme-heading]'

interface DownloadRecord {
  readonly blobTypes: readonly string[]
  readonly downloads: readonly { readonly href: string; readonly download: string }[]
  readonly linksLeft: number
  readonly revokedBefore: number
  readonly revokedAfter: readonly unknown[][]
}

/** What core's downloadText('ember.look.json', '{}', 'application/json') does, recorded as below. */
const CORE_DOWNLOAD: DownloadRecord = {
  blobTypes: ['application/json'],
  downloads: [{ href: BLOB_URL, download: 'ember.look.json' }],
  linksLeft: 0,
  revokedBefore: 0,
  revokedAfter: [[BLOB_URL]],
}

const urlOriginals = {
  createObjectURL: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
  revokeObjectURL: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
}
const clipboardOriginal = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  for (const [name, original] of Object.entries(urlOriginals)) {
    if (original) Object.defineProperty(URL, name, original)
    else Reflect.deleteProperty(URL, name)
  }
  if (clipboardOriginal) Object.defineProperty(navigator, 'clipboard', clipboardOriginal)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

/** What one download helper does with jsdom's missing object URLs and downloads stood in. */
function recordDownload(download: typeof downloadText, revokeAfterMs: number): DownloadRecord {
  const blobTypes: string[] = []
  const downloads: { href: string; download: string }[] = []
  const revoke = vi.fn()
  const create = (blob: Blob) => {
    blobTypes.push(blob.type)
    return BLOB_URL
  }
  Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true, writable: true })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ href: this.getAttribute('href') ?? '', download: this.download })
  })
  download('ember.look.json', '{}', 'application/json')
  const linksLeft = document.querySelectorAll('a[download]').length
  vi.advanceTimersByTime(revokeAfterMs - 1)
  const revokedBefore = revoke.mock.calls.length
  vi.advanceTimersByTime(1)
  click.mockRestore()
  return { blobTypes, downloads, linksLeft, revokedBefore, revokedAfter: revoke.mock.calls }
}

function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

describe("Play's copies of core's helpers", () => {
  it('downloadText saves the same file and lets the URL go after the same delay as core', () => {
    expect(DOWNLOAD_REVOKE_AFTER_MS).toBe(CORE_REVOKE_AFTER_MS)
    expect(recordDownload(downloadText, CORE_REVOKE_AFTER_MS)).toEqual(CORE_DOWNLOAD)
  })

  it('copyToClipboard answers as core does, when the browser takes the text and when it refuses', async () => {
    const written = vi.fn(async (_text: string) => undefined)
    stubClipboard(written)
    expect(await copyToClipboard('{"a":1}')).toBe(true)
    expect(written.mock.calls).toEqual([['{"a":1}']])

    const refusal = new Error('blocked')
    stubClipboard(async () => {
      throw refusal
    })
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await copyToClipboard('x')).toBe(false)
    expect(logged.mock.calls).toEqual([[CORE_COPY_REFUSED, refusal]])
  })

  it("the style sheet's sample card names its kind in core's words", () => {
    expect(SAMPLE_KIND).toBe(CORE_DOCUMENT_WORD)
  })

  it("marks a Play-only screen's heading where builtin Play's host and the installed theme's look runtime look for it", () => {
    const heading = document.createElement('h1')
    for (const [name, value] of Object.entries(PLAY_ONLY_HEADING)) heading.setAttribute(name, String(value))
    expect(heading.matches(CORE_SCREEN_HEADING_SELECTOR)).toBe(true)
    expect(heading.matches(THEME_HEADING_SELECTOR)).toBe(true)
  })
})
