/**
 * A plain, reproducible zip writer and reader for .autotheme packages, with no dependency.
 *
 * Written as core's reader wants it (orchestrator/services/themes/package.py): no zip64, no
 * encryption, no folder entries, every member deflated, a regular-file mode, one fixed time
 * (1980-01-01 00:00, as core's tests/fixtures/themes/build.py writes), members in path order.
 * The same files always give the same bytes for the same zlib. The reader is for checking a
 * written package (tests, and `pack` reading back what it wrote).
 */
import { deflateRawSync, inflateRawSync } from 'node:zlib'

export interface ZipEntry {
  readonly path: string
  readonly data: Uint8Array
}

const LOCAL_SIGNATURE = 0x04034b50
const CENTRAL_SIGNATURE = 0x02014b50
const END_SIGNATURE = 0x06054b50
const LOCAL_HEADER_BYTES = 30
const CENTRAL_HEADER_BYTES = 46
const END_RECORD_BYTES = 22
const VERSION_NEEDED = 20
const VERSION_MADE_BY = (3 << 8) | VERSION_NEEDED // made on Unix, so the mode below is read
const DEFLATED = 8
const STORED = 0
const DOS_TIME = 0 // 00:00:00
const DOS_DATE = (0 << 9) | (1 << 5) | 1 // 1980-01-01
const REGULAR_FILE_ATTRIBUTES = (0o100644 << 16) >>> 0
const ZIP_COMMENT_MAX = 0xffff
const DEFLATE_LEVEL = 9

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

interface Packed {
  readonly name: Buffer
  readonly crc: number
  readonly size: number
  readonly body: Buffer
}

function localHeader(entry: Packed): Buffer {
  const header = Buffer.alloc(LOCAL_HEADER_BYTES)
  header.writeUInt32LE(LOCAL_SIGNATURE, 0)
  header.writeUInt16LE(VERSION_NEEDED, 4)
  header.writeUInt16LE(0, 6) // flags: none (ASCII names, sizes known)
  header.writeUInt16LE(DEFLATED, 8)
  header.writeUInt16LE(DOS_TIME, 10)
  header.writeUInt16LE(DOS_DATE, 12)
  header.writeUInt32LE(entry.crc, 14)
  header.writeUInt32LE(entry.body.length, 18)
  header.writeUInt32LE(entry.size, 22)
  header.writeUInt16LE(entry.name.length, 26)
  header.writeUInt16LE(0, 28)
  return header
}

function centralHeader(entry: Packed, offset: number): Buffer {
  const header = Buffer.alloc(CENTRAL_HEADER_BYTES)
  header.writeUInt32LE(CENTRAL_SIGNATURE, 0)
  header.writeUInt16LE(VERSION_MADE_BY, 4)
  header.writeUInt16LE(VERSION_NEEDED, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(DEFLATED, 10)
  header.writeUInt16LE(DOS_TIME, 12)
  header.writeUInt16LE(DOS_DATE, 14)
  header.writeUInt32LE(entry.crc, 16)
  header.writeUInt32LE(entry.body.length, 20)
  header.writeUInt32LE(entry.size, 24)
  header.writeUInt16LE(entry.name.length, 28)
  // extra length 30, comment length 32, disk 34, internal attributes 36: all zero
  header.writeUInt32LE(REGULAR_FILE_ATTRIBUTES, 38)
  header.writeUInt32LE(offset, 42)
  return header
}

function endRecord(count: number, directoryBytes: number, directoryOffset: number): Buffer {
  const record = Buffer.alloc(END_RECORD_BYTES)
  record.writeUInt32LE(END_SIGNATURE, 0)
  record.writeUInt16LE(count, 8)
  record.writeUInt16LE(count, 10)
  record.writeUInt32LE(directoryBytes, 12)
  record.writeUInt32LE(directoryOffset, 16)
  return record
}

/** The zip of `entries`, in path order, every member deflated. */
export function writeZip(entries: readonly ZipEntry[]): Buffer {
  const packed: Packed[] = [...entries]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((entry) => ({
      name: Buffer.from(entry.path, 'utf8'),
      crc: crc32(entry.data),
      size: entry.data.length,
      body: deflateRawSync(entry.data, { level: DEFLATE_LEVEL }),
    }))
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  packed.forEach((entry) => {
    const header = localHeader(entry)
    locals.push(header, entry.name, entry.body)
    centrals.push(centralHeader(entry, offset), entry.name)
    offset += header.length + entry.name.length + entry.body.length
  })
  const directory = Buffer.concat(centrals)
  return Buffer.concat([...locals, directory, endRecord(packed.length, directory.length, offset)])
}

/** Where the end record starts, or -1. */
function findEndRecord(zip: Buffer): number {
  const lowest = Math.max(0, zip.length - END_RECORD_BYTES - ZIP_COMMENT_MAX)
  for (let at = zip.length - END_RECORD_BYTES; at >= lowest; at -= 1) {
    if (zip.readUInt32LE(at) === END_SIGNATURE) return at
  }
  return -1
}

/** One member's bytes from its central directory record at `at`. */
function readMember(zip: Buffer, at: number): ZipEntry & { readonly next: number } {
  if (zip.readUInt32LE(at) !== CENTRAL_SIGNATURE) throw new Error(`no central directory record at byte ${at}`)
  const method = zip.readUInt16LE(at + 10)
  const crc = zip.readUInt32LE(at + 16)
  const compressed = zip.readUInt32LE(at + 20)
  const nameBytes = zip.readUInt16LE(at + 28)
  const next = at + CENTRAL_HEADER_BYTES + nameBytes + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32)
  const path = zip.toString('utf8', at + CENTRAL_HEADER_BYTES, at + CENTRAL_HEADER_BYTES + nameBytes)
  const local = zip.readUInt32LE(at + 42)
  if (zip.readUInt32LE(local) !== LOCAL_SIGNATURE) throw new Error(`no local header for ${path}`)
  const start = local + LOCAL_HEADER_BYTES + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
  const body = zip.subarray(start, start + compressed)
  if (method !== DEFLATED && method !== STORED) throw new Error(`${path} uses compression method ${method}`)
  const data = method === DEFLATED ? inflateRawSync(body) : Buffer.from(body)
  if (crc32(data) !== crc) throw new Error(`${path} fails its CRC check`)
  return { path, data, next }
}

/** Every member of a zip written by `writeZip` (or any plain zip), in directory order. */
export function readZip(zip: Buffer): ZipEntry[] {
  const end = findEndRecord(zip)
  if (end < 0) throw new Error('not a zip: no end of central directory record')
  const count = zip.readUInt16LE(end + 10)
  const entries: ZipEntry[] = []
  let at = zip.readUInt32LE(end + 16)
  for (let index = 0; index < count; index += 1) {
    const { path, data, next } = readMember(zip, at)
    entries.push({ path, data })
    at = next
  }
  return entries
}
