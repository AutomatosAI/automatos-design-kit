import { ownBuffer } from "./assets";
import { skinFontFamily } from "./css";
import { FONT_FILE_PATTERN, FONT_SLOTS, type FontSlot, type SkinFonts } from "./format";

// A skin's own woff2 faces, registered with the browser through the FontFace API, as Studio does
// (core PRD-259 decision K2, frontend/lib/skins/fonts.ts): the stylesheet names the family
// skinFontFamily() makes and never holds @font-face or url(). Studio hands FontFace the file's
// bytes (an ArrayBuffer), so the kit does too. A face the browser refuses leaves the slot on its
// fallback font: logged, never thrown. Relative imports only (the CLI runs lib/skins under tsx).

/** One face to register: the family the CSS names and the woff2 bytes behind it. */
export interface FaceSource {
  readonly slot: FontSlot;
  readonly family: string;
  readonly bytes: Uint8Array;
}

/** Where faces go: the page's document.fonts in a browser, a fake in tests. */
export interface FontHost {
  /** Loads the face and adds it to the page; resolves to the function that removes it again. */
  readonly register: (family: string, bytes: ArrayBuffer) => Promise<() => void>;
}

const NOTHING_TO_UNDO = (): void => undefined;

/** The browser's FontFace API, or null where it is missing (the server, jsdom). */
export function browserFontHost(): FontHost | null {
  if (typeof FontFace === "undefined" || typeof document === "undefined" || !document.fonts) return null;
  const fonts = document.fonts;
  return {
    register: async (family, bytes) => {
      const face = await new FontFace(family, bytes).load();
      fonts.add(face);
      return () => {
        fonts.delete(face);
      };
    },
  };
}

/** The slots that name a woff2 whose bytes are at hand (a shipped face needs no registration). */
export function skinFaceSources(
  fonts: SkinFonts,
  skinId: string,
  bytesOf: (path: string) => Uint8Array | undefined,
): readonly FaceSource[] {
  return FONT_SLOTS.flatMap((slot) => {
    const path = fonts[slot];
    if (path === undefined || !FONT_FILE_PATTERN.test(path)) return [];
    const bytes = bytesOf(path);
    return bytes === undefined ? [] : [{ slot, family: skinFontFamily(skinId, slot), bytes }];
  });
}

async function registerOne(source: FaceSource, host: FontHost): Promise<() => void> {
  try {
    return await host.register(source.family, ownBuffer(source.bytes));
  } catch (error) {
    console.warn(`[skins] The browser could not load the ${source.slot} font; it keeps its fallback font.`, error);
    return NOTHING_TO_UNDO;
  }
}

/** Registers every face; resolves to the function that removes them all again. Never rejects. */
export async function registerFaces(sources: readonly FaceSource[], host: FontHost): Promise<() => void> {
  const removers = await Promise.all(sources.map((source) => registerOne(source, host)));
  return () => removers.forEach((remove) => remove());
}
