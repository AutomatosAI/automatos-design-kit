import { useEffect, useRef } from "react";

import { START_PARAM, findExample } from "@/lib/skins/examples";
import type { SkinDraft } from "@/lib/skins/model";

// "Start from this" on the Examples page opens the editor at /?start=<slug>. Once the stored
// draft is read, the example replaces it as one step (so Undo brings the stored one back), and
// the query leaves the address so a reload doesn't start again. An unknown slug changes nothing.

export function useStartFromLink(loaded: boolean, onStart: (draft: SkinDraft) => void): void {
  const handled = useRef(false);
  useEffect(() => {
    if (!loaded || handled.current) return;
    handled.current = true;
    const slug = new URLSearchParams(window.location.search).get(START_PARAM);
    if (slug === null) return;
    const example = findExample(slug);
    if (example) onStart(example.draft);
    else console.warn(`[skins] the link asked to start from an example the kit doesn't have, so the draft is unchanged.`);
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [loaded, onStart]);
}
