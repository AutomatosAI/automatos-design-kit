/**
 * A picture's size in pixels, read from its header alone: a PNG's IHDR chunk, or a JPEG's first frame header (SOF).
 * `previews --phone` reads it to warn of a phone screenshot that isn't portrait; core's reader checks no size, so
 * nothing is refused on it. null when the bytes hold no header this reads.
 */

export interface PictureSize {
  readonly width: number
  readonly height: number
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const IHDR = 'IHDR'
const IHDR_TYPE_AT = 12
const IHDR_WIDTH_AT = 16
const IHDR_HEIGHT_AT = 20
const IHDR_END = 24
const MARKER = 0xff
const SOI = [0xff, 0xd8]
/** Start of scan: the coded picture follows, so no frame header came first. */
const SOS = 0xda
/** Markers that stand alone, with no length after them: TEM and RST0 to RST7. */
const STANDALONE = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7])
/** The frame headers SOF0 to SOF15, but DHT (C4), JPG (C8) and DAC (CC), which share the range. */
const FRAME_HEADERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
/** In a frame header: the marker (2 bytes), its length (2), the sample precision (1), then height (2) and width (2). */
const FRAME_HEIGHT_AT = 5
const FRAME_WIDTH_AT = 7
const FRAME_END = 9
const MARKER_BYTES = 2
const LENGTH_MIN = 2

function startsWith(data: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => data[index] === byte)
}

function view(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength)
}

/** A PNG's width and height from its IHDR chunk, which comes first. */
export function pngSize(data: Uint8Array): PictureSize | null {
  if (data.length < IHDR_END || !startsWith(data, PNG_SIGNATURE)) return null
  if (String.fromCharCode(...data.subarray(IHDR_TYPE_AT, IHDR_WIDTH_AT)) !== IHDR) return null
  return { width: view(data).getUint32(IHDR_WIDTH_AT), height: view(data).getUint32(IHDR_HEIGHT_AT) }
}

/** One JPEG segment read at `at`: where the next one starts, or the size it gives (null: none to read). */
type Step = { readonly next: number } | { readonly size: PictureSize | null }

function segmentStep(data: Uint8Array, at: number): Step {
  const marker = data[at + 1]
  if (marker === MARKER) return { next: at + 1 }
  if (STANDALONE.has(marker)) return { next: at + MARKER_BYTES }
  if (marker === SOS || at + FRAME_HEIGHT_AT > data.length) return { size: null }
  if (FRAME_HEADERS.has(marker)) {
    if (at + FRAME_END > data.length) return { size: null }
    return { size: { width: view(data).getUint16(at + FRAME_WIDTH_AT), height: view(data).getUint16(at + FRAME_HEIGHT_AT) } }
  }
  const length = view(data).getUint16(at + MARKER_BYTES)
  return length < LENGTH_MIN ? { size: null } : { next: at + MARKER_BYTES + length }
}

/** A JPEG's width and height from its first frame header, read segment by segment from the start. */
export function jpegSize(data: Uint8Array): PictureSize | null {
  if (!startsWith(data, SOI)) return null
  let at = SOI.length
  while (at + MARKER_BYTES <= data.length && data[at] === MARKER) {
    const step = segmentStep(data, at)
    if ('size' in step) return step.size
    at = step.next
  }
  return null
}

/** The picture's size, a PNG's or a JPEG's, or null. */
export function pictureSize(data: Uint8Array): PictureSize | null {
  return pngSize(data) ?? jpegSize(data)
}
