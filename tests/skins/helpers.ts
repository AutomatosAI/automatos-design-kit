import { MASCOT_FORMATS, MASCOT_STATES, type AssetEntry, type SniffedType } from "@/lib/skins/format";

// Shared fixtures for the skin format tests: a valid skin.json, manifests, and the first bytes
// of each file type the validator sniffs.

export type Json = Record<string, unknown>;

/**
 * A Studio-based skin whose pairs all pass AA (the light card is given as hex). Each tone sets
 * both sides of every pair it touches (decision K5): background brings foreground, ring and
 * muted-foreground, and muted-foreground brings card and card-foreground.
 */
export function validSkin(): Json {
  return {
    schema: "automatos-skin/v1",
    slug: "warm-paper",
    name: "Warm Paper",
    version: "1.0.0",
    author: "Kit Tests",
    description: "Cream paper and ink.",
    licence: "Apache-2.0",
    base: "studio",
    tones: ["light", "dark"],
    tokens: {
      light: {
        background: "38 50% 92%",
        foreground: "30 12% 9%",
        card: "#FFFFFF",
        "card-foreground": "30 12% 9%",
        primary: "30 12% 9%",
        "primary-foreground": "38 50% 96%",
        "muted-foreground": "36 12% 36%",
        ring: "82 30% 33%",
      },
      dark: {
        background: "30 12% 9%",
        foreground: "38 40% 90%",
        card: "30 10% 12%",
        "card-foreground": "38 40% 90%",
        "muted-foreground": "38 18% 62%",
        ring: "82 35% 52%",
      },
    },
    shape: { radius: 10, glow: 12 },
    mascot: { mode: "auto", shell: "bronze", light: "mint" },
  };
}

export function withField(skin: Json, key: string, value: unknown): Json {
  return { ...skin, [key]: value };
}

export function withTokens(skin: Json, tone: "light" | "dark", values: Json): Json {
  const tokens = skin.tokens as Record<string, Json>;
  return { ...skin, tokens: { ...tokens, [tone]: { ...tokens[tone], ...values } } };
}

export function withoutTokens(skin: Json, tone: "light" | "dark", names: readonly string[]): Json {
  const tokens = skin.tokens as Record<string, Json>;
  const kept = Object.fromEntries(Object.entries(tokens[tone]).filter(([name]) => !names.includes(name)));
  return { ...skin, tokens: { ...tokens, [tone]: kept } };
}

export function omit(skin: Json, keys: readonly string[]): Json {
  return Object.fromEntries(Object.entries(skin).filter(([key]) => !keys.includes(key)));
}

export function asset(path: string, sniffedType: SniffedType, bytes = 1024): AssetEntry {
  return { path, bytes, sniffedType };
}

export function mascotSet(bytesEach = 1024): AssetEntry[] {
  return MASCOT_STATES.flatMap((state) =>
    MASCOT_FORMATS.map((format) => asset(`assets/mascot/${state}.${format}`, format, bytesEach)),
  );
}

function withHead(head: readonly number[], length = 64): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => head[index] ?? 0);
}

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

export const PNG_BYTES = withHead([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, ...ascii("IHDR")]);
export const WOFF2_BYTES = withHead(ascii("wOF2"));
export const WEBM_BYTES = withHead([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84, ...ascii("webm")]);
export const MP4_BYTES = withHead([0, 0, 0, 0x1c, ...ascii("ftyp"), ...ascii("isom"), 0, 0, 2, 0]);
export const TEXT_BYTES = new TextEncoder().encode("body { color: red }");

export function bytesFor(type: SniffedType): Uint8Array {
  const table: Record<SniffedType, Uint8Array> = { png: PNG_BYTES, woff2: WOFF2_BYTES, webm: WEBM_BYTES, mp4: MP4_BYTES, unknown: TEXT_BYTES };
  return table[type];
}
