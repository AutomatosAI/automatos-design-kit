import { isMascotPath, type StoredAsset } from "./assets";
import { FONTS_DIR, FONT_SLOTS, PREVIEW_PATH, type SkinError } from "./format";
import { draftFromSkin, draftToSkinJson, type SkinDraft } from "./model";
import { packSkin, unpackSkin, type PackFile, type PackResult } from "./pack";

// The editor's side of packing (PRD-004 K-007): the draft plus its font and mascot files to a
// .autoskin, and a .autoskin back to a draft plus files. The editor keeps no preview picture,
// so an imported package's assets/preview.png is left out (and the person is told). Pure.

export const PREVIEW_NOT_KEPT = "The package's preview picture isn't kept by the editor. Add it to the skin's folder before npm run pack.";

export type DraftImport =
  | { readonly ok: true; readonly draft: SkinDraft; readonly assets: readonly StoredAsset[]; readonly notes: readonly string[] }
  | { readonly ok: false; readonly errors: readonly SkinError[] };

/** The draft as skin.json's text, as Export writes it. */
export function draftSkinText(draft: SkinDraft): string {
  return `${JSON.stringify(draftToSkinJson(draft), null, 2)}\n`;
}

/** The font files the draft names, then the mascot files when its mascot is custom. */
export function draftPackFiles(draft: SkinDraft, assets: ReadonlyMap<string, StoredAsset>): readonly PackFile[] {
  const fontPaths = FONT_SLOTS.flatMap((slot) => {
    const font = draft.fonts[slot];
    return font !== undefined && font.startsWith(FONTS_DIR) ? [font] : [];
  });
  const mascotPaths = draft.mascot.mode === "custom" ? [...assets.keys()].filter(isMascotPath).sort() : [];
  // Two slots may share one file: it goes in once. A named file that isn't here is left for the
  // validator to report as missing.
  return [...new Set([...fontPaths, ...mascotPaths])].flatMap((path) => {
    const asset = assets.get(path);
    return asset === undefined ? [] : [{ path, bytes: asset.bytes }];
  });
}

/** The draft packed, or the validator's reasons it can't be. */
export function packDraft(draft: SkinDraft, assets: ReadonlyMap<string, StoredAsset>): PackResult {
  return packSkin(draftSkinText(draft), draftPackFiles(draft, assets));
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** A .autoskin as a new draft and the files the editor keeps for it. */
export function importDraft(bytes: Uint8Array): DraftImport {
  const unpacked = unpackSkin(bytes);
  if (!unpacked.ok) return unpacked;
  const assets = unpacked.files
    .filter((file) => file.path.startsWith(FONTS_DIR) || isMascotPath(file.path))
    .map((file) => ({ path: file.path, name: fileName(file.path), bytes: file.bytes }));
  const notes = unpacked.files.some((file) => file.path === PREVIEW_PATH) ? [PREVIEW_NOT_KEPT] : [];
  return { ok: true, draft: draftFromSkin(unpacked.skin), assets, notes };
}
