import type { SniffedType } from "./format";

// What a file is by its first bytes, never by its name. Pure; reads at most SNIFF_BYTES.

export const SNIFF_BYTES = 64;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WOFF2 = [0x77, 0x4f, 0x46, 0x32]; // "wOF2"
const EBML = [0x1a, 0x45, 0xdf, 0xa3];
const WEBM_DOCTYPE = [0x77, 0x65, 0x62, 0x6d]; // "webm"
const FTYP = [0x66, 0x74, 0x79, 0x70]; // "ftyp"
/** MP4-family brands; QuickTime ("qt  ") is refused, as browsers won't play it everywhere. */
const MP4_BRANDS: ReadonlySet<string> = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "hvc1", "dash", "M4V "]);

function startsWith(bytes: Uint8Array, signature: readonly number[], at = 0): boolean {
  return bytes.length >= at + signature.length && signature.every((value, index) => bytes[at + index] === value);
}

function contains(bytes: Uint8Array, signature: readonly number[]): boolean {
  for (let at = 0; at + signature.length <= bytes.length; at += 1) {
    if (startsWith(bytes, signature, at)) return true;
  }
  return false;
}

function isMp4(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, FTYP, 4) || bytes.length < 12) return false;
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return MP4_BRANDS.has(brand);
}

export function sniffType(bytes: Uint8Array): SniffedType {
  const head = bytes.subarray(0, SNIFF_BYTES);
  if (startsWith(head, PNG)) return "png";
  if (startsWith(head, WOFF2)) return "woff2";
  if (startsWith(head, EBML) && contains(head, WEBM_DOCTYPE)) return "webm";
  if (isMp4(head)) return "mp4";
  return "unknown";
}
