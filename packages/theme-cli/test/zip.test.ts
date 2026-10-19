/**
 * The zip writer: plain, reproducible, and the shape core's reader (Python zipfile plus the
 * package.py checks) expects: no folder entries, deflated members, a regular-file mode, a fixed
 * time, members in path order, no zip64.
 */
import { describe, expect, it } from 'vitest'
import { crc32, readZip, writeZip } from '../src/zip.ts'

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)

const ENTRIES = [
  { path: 'theme.json', data: encode('{"id": "automatos-e2e/hello"}\n') },
  { path: 'dist/entry.js', data: encode('export default {}\n') },
  { path: 'README.md', data: new Uint8Array(0) },
]

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array(0))).toBe(0)
  })
})

describe('writeZip', () => {
  const zip = writeZip(ENTRIES)

  it('reads back to the same files, in path order', () => {
    const entries = readZip(zip)
    expect(entries.map((entry) => entry.path)).toEqual(['README.md', 'dist/entry.js', 'theme.json'])
    entries.forEach((entry) => {
      const source = ENTRIES.find((item) => item.path === entry.path)
      expect(Buffer.from(entry.data).equals(Buffer.from(source?.data ?? []))).toBe(true)
    })
  })

  it('writes the same bytes for the same files in any order', () => {
    expect(writeZip([...ENTRIES].reverse()).equals(zip)).toBe(true)
  })

  it('writes deflated members with a fixed time and a regular-file mode', () => {
    expect(zip.readUInt32LE(0)).toBe(0x04034b50)
    expect(zip.readUInt16LE(8)).toBe(8)
    expect(zip.readUInt16LE(10)).toBe(0)
    expect(zip.readUInt16LE(12)).toBe(0x21)
    const end = zip.length - 22
    expect(zip.readUInt32LE(end)).toBe(0x06054b50)
    expect(zip.readUInt16LE(end + 10)).toBe(ENTRIES.length)
    const central = zip.readUInt32LE(end + 16)
    expect(zip.readUInt32LE(central)).toBe(0x02014b50)
    expect(zip.readUInt16LE(central + 4) >> 8).toBe(3)
    expect(zip.readUInt32LE(central + 38) >>> 16).toBe(0o100644)
  })

  it('refuses to read something that is not a zip', () => {
    expect(() => readZip(Buffer.from('not a zip at all, just some text here'))).toThrow(/not a zip/)
  })
})
