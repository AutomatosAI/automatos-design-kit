/**
 * The web server of `automatos-theme dev` (PRD-261 B-02i), over a made-up build folder in the system temp folder:
 * which file a request's path names (only one under the folder: no `..` however escaped, no link out, no folder, no
 * dotfile), the one byte range it answers, and its answers over a real node:http server on 127.0.0.1: the types,
 * no-store, HEAD, 206, 416, 405, and 503 before a build is in.
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { HARNESS_HOST } from '@automatos/theme-harness/router'
import { afterEach, describe, expect, it } from 'vitest'
import { byteRange, INDEX_FILE, listenDev, servedFile, type ByteRange } from '../src/dev-server.ts'

const CLIP = Buffer.from('0123456789')
const folders: string[] = []
const closes: (() => Promise<void>)[] = []

afterEach(async () => {
  await Promise.all(closes.splice(0).map((close) => close()))
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

function writeFile(path: string, data: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

/** A build folder (the page, a script, a clip, a dotfile, a link out) beside a file outside it. */
function buildFolder(): { readonly root: string; readonly outside: string } {
  const top = mkdtempSync(join(tmpdir(), 'automatos-dev-server-'))
  folders.push(top)
  const root = join(top, 'build')
  writeFile(join(root, INDEX_FILE), '<p>page</p>')
  writeFile(join(root, 'harness/app.js'), 'export {}\n')
  writeFile(join(root, 'assets/mascot/idle.mp4'), CLIP)
  writeFile(join(root, '.env'), 'NOT=served')
  const outside = join(top, 'outside.txt')
  writeFile(outside, 'outside')
  symlinkSync(outside, join(root, 'assets/out.txt'))
  symlinkSync(top, join(root, 'up'))
  return { root, outside }
}

interface Answer {
  readonly status: number
  readonly headers: IncomingHttpHeaders
  readonly body: string
}

function ask(port: number, path: string, method = 'GET', headers: Readonly<Record<string, string>> = {}): Promise<Answer> {
  return new Promise((done, fail) => {
    const sent = httpRequest({ host: HARNESS_HOST, port, path, method, headers, agent: false }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => {
        done({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString() })
      })
    })
    sent.on('error', fail)
    sent.end()
  })
}

/** A server on a free port over `root()`; its port. */
async function serving(root: () => string | null): Promise<number> {
  const listening = await listenDev({ host: HARNESS_HOST, port: 0, root, onError: (error) => { throw error } })
  if (!listening.ok) throw new Error(listening.message)
  closes.push(listening.close)
  return listening.port
}

describe('the file a request names', () => {
  it('is the page for /, whatever the query, and a file under the folder by its path', () => {
    const { root } = buildFolder()
    const real = realpathSync(root)
    expect(servedFile(root, '/')).toBe(join(real, INDEX_FILE))
    expect(servedFile(root, '/?path=/chat&tone=dark')).toBe(join(real, INDEX_FILE))
    expect(servedFile(root, '/harness/app.js')).toBe(join(real, 'harness/app.js'))
    expect(servedFile(root, '/assets/mascot/idle%2Emp4')).toBe(join(real, 'assets/mascot/idle.mp4'))
  })

  it.each([
    '/../outside.txt', '/..%2Foutside.txt', '/harness/..%2F..%2Foutside.txt', '/%2e%2e/outside.txt', '/harness/%2E%2E%2F%2E%2E%2Foutside.txt',
    '/assets/..%5C..%5Coutside.txt', '/assets/out.txt', '/up/outside.txt', '/.env', '/harness', '/harness/', '/missing.js', '/%00',
    '/%E0%A4%A', '//outside.txt',
  ])('is none for %s', (path) => {
    expect(servedFile(buildFolder().root, path)).toBeNull()
  })
})

/** A Range header (or none), the file's size, and what is sent. */
type RangeCase = [header: string | undefined, size: number, sent: ByteRange | 'unsatisfiable' | null]
const RANGES: RangeCase[] = [
  [undefined, 10, null], ['bytes=0-', 10, [0, 9]], ['bytes=2-5', 10, [2, 5]], ['bytes=2-50', 10, [2, 9]], ['bytes=-3', 10, [7, 9]],
  ['bytes=-30', 10, [0, 9]], ['bytes=10-', 10, 'unsatisfiable'], ['bytes=0-', 0, 'unsatisfiable'], ['bytes=-0', 10, 'unsatisfiable'],
  ['bytes=5-2', 10, null], ['bytes=0-1,4-5', 10, null], ['items=0-1', 10, null], ['bytes=-', 10, null],
]

describe('the byte range a request asks for', () => {
  it.each(RANGES)('%s of %d bytes is %j', (header, size, sent) => {
    expect(byteRange(header, size)).toEqual(sent)
  })
})

describe('the answers', () => {
  it('serves each file with its type, no-store and nosniff, and HEAD with no body', async () => {
    const { root } = buildFolder()
    const port = await serving(() => root)
    const page = await ask(port, '/')
    expect([page.status, page.body, page.headers['content-type']]).toEqual([200, '<p>page</p>', 'text/html; charset=utf-8'])
    expect([page.headers['cache-control'], page.headers['x-content-type-options']]).toEqual(['no-store', 'nosniff'])
    expect((await ask(port, '/assets/mascot/idle.mp4')).headers['content-type']).toBe('video/mp4')
    const head = await ask(port, '/harness/app.js', 'HEAD')
    expect([head.status, head.body, head.headers['content-length']]).toEqual([200, '', '10'])
  })

  it('answers one byte range with 206, and one past the end with 416', async () => {
    const { root } = buildFolder()
    const port = await serving(() => root)
    const part = await ask(port, '/assets/mascot/idle.mp4', 'GET', { Range: 'bytes=2-5' })
    expect([part.status, part.body, part.headers['content-range'], part.headers['accept-ranges']]).toEqual([206, '2345', 'bytes 2-5/10', 'bytes'])
    const past = await ask(port, '/assets/mascot/idle.mp4', 'GET', { Range: 'bytes=10-' })
    expect([past.status, past.headers['content-range']]).toEqual([416, 'bytes */10'])
  })

  it('refuses a method but GET and HEAD, says 404 outside the folder, and 503 before a build is in', async () => {
    const { root } = buildFolder()
    const port = await serving(() => root)
    const post = await ask(port, '/', 'POST')
    expect([post.status, post.headers.allow]).toEqual([405, 'GET, HEAD'])
    const out = await ask(port, '/assets/out.txt')
    expect([out.status, out.body.includes('outside')]).toEqual([404, false])
    const building = await ask(await serving(() => null), '/')
    expect(building.status).toBe(503)
  })
})
