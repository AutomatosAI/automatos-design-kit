// @vitest-environment node
// The harness's PNG writer and reader (src/png.ts): a picture written and read back is the same picture, the file is
// a PNG any reader takes (its signature and its IHDR), and the reader refuses what it can't read.
import { describe, expect, it } from 'vitest'

import { decodePng, encodePng, type Raster } from '../src/png.ts'

function checkerboard(size: number): Raster {
  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const on = (x + y) % 2 === 0
      pixels.set(on ? [255, 0, 128, 255] : [0, 0, 0, 0], (y * size + x) * 4)
    }
  }
  return { width: size, height: size, pixels }
}

describe('the PNG writer', () => {
  it('writes a picture that reads back the same, pixel for pixel', () => {
    const picture = checkerboard(9)
    const back = decodePng(encodePng(picture))
    expect([back.width, back.height]).toEqual([9, 9])
    expect(back.pixels.equals(picture.pixels)).toBe(true)
  })

  it('writes a PNG: the signature, then IHDR with its size, 8-bit RGBA', () => {
    const file = encodePng(checkerboard(4))
    expect([...file.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(file.toString('ascii', 12, 16)).toBe('IHDR')
    expect([file.readUInt32BE(16), file.readUInt32BE(20), file[24], file[25]]).toEqual([4, 4, 8, 6])
  })

  it('refuses a file that is not a PNG', () => {
    expect(() => decodePng(Buffer.from('not a png'))).toThrow('not a PNG')
  })
})
