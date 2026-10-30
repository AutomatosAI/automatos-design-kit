/**
 * A picture's size from its header (src/picture-size.ts), which `previews --phone` reads to warn of a landscape phone
 * screenshot: a PNG's IHDR (written here by the harness's PNG writer) and a JPEG's first frame header, past the
 * segments before it, fill bytes and standalone markers included. Bytes with no header it can read give null.
 */
import { describe, expect, it } from 'vitest'
import { encodePng } from '@automatos/theme-harness/png'
import { jpegSize, pictureSize, pngSize } from '../src/picture-size.ts'

const SOI = [0xff, 0xd8]
/** APP0 (JFIF): marker, length 16, then 14 bytes. */
const APP0 = [0xff, 0xe0, 0x00, 0x10, ...new Array<number>(14).fill(0)]
const SOS = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]

/** A frame header `marker` of a `width` by `height` picture: marker, length 17, precision 8, height, width, 3 components. */
function frame(marker: number, width: number, height: number): number[] {
  return [0xff, marker, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, ...new Array<number>(9).fill(0)]
}

const jpeg = (...parts: number[][]): Uint8Array => Uint8Array.from([...SOI, ...parts.flat()])

describe('pngSize', () => {
  it('reads the width and height from the IHDR chunk', () => {
    const file = new Uint8Array(encodePng({ width: 9, height: 19, pixels: Buffer.alloc(9 * 19 * 4) }))
    expect(pngSize(file)).toEqual({ width: 9, height: 19 })
    expect(pictureSize(file)).toEqual({ width: 9, height: 19 })
  })

  it('is null for a PNG signature with no IHDR after it, and for bytes that are no PNG', () => {
    expect(pngSize(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]))).toBeNull()
    expect(pngSize(jpeg(APP0, frame(0xc0, 1179, 2556)))).toBeNull()
  })
})

describe('jpegSize', () => {
  it('reads a baseline frame header after the segments before it', () => {
    expect(jpegSize(jpeg(APP0, frame(0xc0, 1179, 2556), SOS))).toEqual({ width: 1179, height: 2556 })
  })

  it('reads a progressive frame header, past fill bytes and a standalone marker', () => {
    expect(jpegSize(jpeg([0xff, 0xff], [0xff, 0xd0], APP0, frame(0xc2, 2556, 1179)))).toEqual({ width: 2556, height: 1179 })
    expect(pictureSize(jpeg(frame(0xc2, 2556, 1179)))).toEqual({ width: 2556, height: 1179 })
  })

  it('skips the tables (DHT, C4) that share the frame headers\' range', () => {
    const dht = [0xff, 0xc4, 0x00, 0x05, 0x00, 0x00, 0x00]
    expect(jpegSize(jpeg(dht, frame(0xc0, 30, 60)))).toEqual({ width: 30, height: 60 })
  })

  it('is null with no frame header before the scan, a frame header cut short, a bad length, or no JPEG', () => {
    expect(jpegSize(jpeg(APP0, SOS, frame(0xc0, 30, 60)))).toBeNull()
    expect(jpegSize(jpeg(APP0, frame(0xc0, 30, 60).slice(0, 7)))).toBeNull()
    expect(jpegSize(jpeg([0xff, 0xe1, 0x00, 0x01, 0x00, 0x00]))).toBeNull()
    expect(jpegSize(Uint8Array.from([0xff, 0xd8, 0xff]))).toBeNull()
    expect(pictureSize(new TextEncoder().encode('not an image'))).toBeNull()
  })
})
