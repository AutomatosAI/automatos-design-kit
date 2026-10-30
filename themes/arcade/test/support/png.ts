// A small PNG writer and reader for Auto's stills (test/stills.test.ts): 8-bit RGBA, no interlace, every row filter
// 0 on write. Node's zlib does the deflating and its crc32 the checksums. The reader takes only what the writer
// writes (and refuses the rest), so a test compares a committed still's pixels with what the sprite engine draws,
// whatever zlib version wrote the bytes.
import { crc32, deflateSync, inflateSync } from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const RGBA = 6
const BYTES_PER_PIXEL = 4

export interface Raster {
  readonly width: number
  readonly height: number
  /** RGBA, row by row. */
  readonly pixels: Buffer
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0)
  return Buffer.concat([head, data, crc])
}

export function encodePng({ width, height, pixels }: Raster): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, RGBA, 0, 0, 0], 8)
  const stride = width * BYTES_PER_PIXEL
  const rows = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) pixels.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  return Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

export function decodePng(file: Buffer): Raster {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG')
  let at = 8
  let width = 0
  let height = 0
  const data: Buffer[] = []
  while (at < file.length) {
    const length = file.readUInt32BE(at)
    const type = file.toString('ascii', at + 4, at + 8)
    const body = file.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      if (body[8] !== 8 || body[9] !== RGBA || body[12] !== 0) throw new Error('only 8-bit RGBA, not interlaced')
    }
    if (type === 'IDAT') data.push(body)
    at += 12 + length
  }
  const rows = inflateSync(Buffer.concat(data))
  const stride = width * BYTES_PER_PIXEL
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    if (rows[y * (stride + 1)] !== 0) throw new Error('only filter 0')
    rows.copy(pixels, y * stride, y * (stride + 1) + 1, (y + 1) * (stride + 1))
  }
  return { width, height, pixels }
}
