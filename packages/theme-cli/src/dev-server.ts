/**
 * The web server `automatos-theme dev` serves the harness with (PRD-261 B-02i): node:http, on one address of this
 * machine, over one folder, the last harness build that passed. That build holds what the harness app needs and
 * nothing else: the page and its scripts and stylesheet (the theme's src/ bundled into them), and the theme folder's
 * assets/ (vite.harness.config.ts copies them in; theme.json and the look data are built into the page). So no path
 * reaches the theme folder or the harness themselves, nor anything outside them.
 *
 * - GET and HEAD only (405 otherwise); 503 until the first build is in.
 * - `/` is the page (index.html). A path names a file under the folder after its %-escapes are decoded, so an
 *   escaped `..` or `/` can't step out: anything that resolves outside the folder, or through a link to outside it,
 *   is 404, as is a folder, a dotfile and a missing file.
 * - Every answer is `Cache-Control: no-store`, so a reload after a rebuild gets the new build, and carries
 *   `X-Content-Type-Options: nosniff`. One byte range is answered (206 or 416): WebKit plays a video only so.
 */
import { createReadStream, realpathSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'

export const INDEX_FILE = 'index.html'
const URL_BASE = 'http://dev.invalid'
const STATUS = Object.freeze({
  ok: 200, partial: 206, notFound: 404, notAllowed: 405, unsatisfiable: 416, unreadable: 500, building: 503,
})
const READ_METHODS: readonly string[] = ['GET', 'HEAD']
/** The types of the files a harness build writes, and of a theme's assets. */
const CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.vtt': 'text/vtt; charset=utf-8',
})
const OTHER_TYPE = 'application/octet-stream'
const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/

/** True when `path` is `root` itself or under it. */
function within(root: string, path: string): boolean {
  const rel = relative(root, path)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/**
 * The path a request names, decoded, relative to the served folder; null for one that isn't a path from `/` (a proxy's
 * whole URL, `*`) or can't be decoded. The URL's own `.` and `..` segments are resolved first, never above `/`.
 */
function requestedPath(url: string): string | null {
  if (!url.startsWith('/')) return null
  try {
    const pathname = decodeURIComponent(new URL(`${URL_BASE}${url}`).pathname)
    return pathname === '/' ? INDEX_FILE : pathname.replace(/^\/+/, '')
  } catch {
    return null
  }
}

/** The file under `root` a request's URL names, or null: nothing outside `root`, no folder, no dotfile, nothing missing. */
export function servedFile(root: string, url: string): string | null {
  const path = requestedPath(url)
  if (path === null || path.includes('\0') || path.split(/[\\/]/).some((part) => part.startsWith('.'))) return null
  const target = resolve(root, path)
  if (!within(root, target) || target === resolve(root)) return null
  try {
    const real = realpathSync(target)
    return within(realpathSync(root), real) && statSync(real).isFile() ? real : null
  } catch {
    return null
  }
}

export type ByteRange = readonly [start: number, end: number]

/**
 * One `Range: bytes=a-b` (or `a-`, or the last `-n`) of a `size`-byte file: the range, 'unsatisfiable' when it starts
 * past the end, or null to send the whole file (no header, several ranges, or one that isn't valid, as RFC 9110 lets
 * a server ignore).
 */
export function byteRange(header: string | undefined, size: number): ByteRange | 'unsatisfiable' | null {
  const match = header === undefined ? null : SINGLE_RANGE.exec(header.trim())
  const [first, last] = [match?.[1] ?? '', match?.[2] ?? '']
  if (first === '' && last === '') return null
  if (first === '') {
    const length = Math.min(Number(last), size)
    return length === 0 ? 'unsatisfiable' : [size - length, size - 1]
  }
  const start = Number(first)
  if (last !== '' && Number(last) < start) return null
  return start >= size ? 'unsatisfiable' : [start, last === '' ? size - 1 : Math.min(Number(last), size - 1)]
}

const baseHeaders = (): Record<string, string> => ({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })

function reply(response: ServerResponse, status: number, text: string, headers: Readonly<Record<string, string>> = {}): void {
  response.writeHead(status, { ...baseHeaders(), 'Content-Type': CONTENT_TYPES['.txt'], ...headers })
  response.end(`${text}\n`)
}

/** Sends one file, whole or the one range asked for. */
function sendFile(request: IncomingMessage, response: ServerResponse, file: string): void {
  const size = statSync(file).size
  const range = byteRange(request.headers.range, size)
  if (range === 'unsatisfiable') {
    response.writeHead(STATUS.unsatisfiable, { ...baseHeaders(), 'Content-Range': `bytes */${size}` })
    response.end()
    return
  }
  const [start, end] = range ?? [0, size - 1]
  const headers: Record<string, string> = {
    ...baseHeaders(),
    'Content-Type': CONTENT_TYPES[extname(file).toLowerCase()] ?? OTHER_TYPE,
    'Content-Length': String(Math.max(end - start + 1, 0)),
    'Accept-Ranges': 'bytes',
    ...(range === null ? {} : { 'Content-Range': `bytes ${start}-${end}/${size}` }),
  }
  response.writeHead(range === null ? STATUS.ok : STATUS.partial, headers)
  if (request.method === 'HEAD' || size === 0) {
    response.end()
    return
  }
  const stream = createReadStream(file, { start, end })
  stream.on('error', () => response.destroy())
  stream.pipe(response)
}

/** Answers one request from `root`, the folder served now (null before the first build). */
export function answer(request: IncomingMessage, response: ServerResponse, root: string | null): void {
  if (!READ_METHODS.includes(request.method ?? '')) {
    reply(response, STATUS.notAllowed, 'The harness answers GET and HEAD only.', { Allow: READ_METHODS.join(', ') })
    return
  }
  if (root === null) {
    reply(response, STATUS.building, 'The harness is still building: reload in a moment.')
    return
  }
  const file = servedFile(root, request.url ?? '/')
  try {
    if (file !== null) {
      sendFile(request, response, file)
      return
    }
  } catch (error) {
    // ENOENT: a rebuild replaced the folder between the lookup and the read, so the file is gone, as a missing one is.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      reply(response, STATUS.unreadable, `The harness build's file can't be read (${String(error)}).`)
      return
    }
  }
  reply(response, STATUS.notFound, 'Not in the harness build.')
}

export interface DevServerOptions {
  readonly host: string
  readonly port: number
  /** The folder served now: the last harness build that passed, or null before the first. */
  readonly root: () => string | null
  /** An error the listening server raised later, which it survives. */
  readonly onError: (error: Error) => void
}

export type Listening =
  | { readonly ok: true; readonly port: number; readonly close: () => Promise<void> }
  | { readonly ok: false; readonly code: string; readonly message: string }

/** Why the server could not listen, in one sentence. */
function listenProblem(error: NodeJS.ErrnoException, host: string, port: number): string {
  const where = `${host}:${port}`
  if (error.code === 'EADDRINUSE') {
    return `${where} is in use, so the harness can't be served there: stop what runs on it, or pick another --port <n>.`
  }
  if (error.code === 'EACCES') return `this user may not listen on ${where}: choose another port with --port <n>.`
  return `the harness can't be served on ${where} (${error.message}).`
}

function closed(server: Server): Promise<void> {
  return new Promise((done) => {
    server.close(() => done())
    server.closeAllConnections()
  })
}

/** Listens on host:port and answers from `root()`; resolves once listening, or with why it could not. */
export function listenDev(options: DevServerOptions): Promise<Listening> {
  const server = createServer((request, response) => answer(request, response, options.root()))
  return new Promise((done) => {
    const refused = (error: NodeJS.ErrnoException): void => {
      done({ ok: false, code: error.code ?? 'ERROR', message: listenProblem(error, options.host, options.port) })
    }
    server.once('error', refused)
    server.listen({ host: options.host, port: options.port }, () => {
      server.off('error', refused)
      server.on('error', options.onError)
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : options.port
      done({ ok: true, port, close: () => closed(server) })
    })
  })
}
