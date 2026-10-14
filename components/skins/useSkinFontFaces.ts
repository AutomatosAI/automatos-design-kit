import { useEffect } from "react";

import type { StoredAsset } from "@/lib/skins/assets";
import { browserFontHost, registerFaces, skinFaceSources, type FontHost } from "@/lib/skins/font-faces";
import type { SkinFonts } from "@/lib/skins/format";
import { DRAFT_PREVIEW_ID } from "@/lib/skins/preview";

// The draft's own font files, registered through the FontFace API under the families the preview
// CSS names (skin-kit-draft-<slot>), the way Studio loads a skin's fonts (decision K2). They are
// removed again when the files or the fonts change, and when the page goes.

/** `host` undefined means the browser's own; null means no FontFace API (nothing registers). */
export function useSkinFontFaces(
  fonts: SkinFonts,
  assets: ReadonlyMap<string, StoredAsset>,
  host?: FontHost | null,
): void {
  useEffect(() => {
    const target = host === undefined ? browserFontHost() : host;
    if (target === null) return;
    const sources = skinFaceSources(fonts, DRAFT_PREVIEW_ID, (path) => assets.get(path)?.bytes);
    if (sources.length === 0) return;
    let live = true;
    let remove = (): void => undefined;
    registerFaces(sources, target)
      .then((undo) => {
        if (live) remove = undo;
        else undo();
      })
      .catch((error: unknown) => console.error("[skins] the draft's fonts couldn't be registered:", error));
    return () => {
      live = false;
      remove();
    };
  }, [fonts, assets, host]);
}
