import { useEffect, useState } from "react";

import type { StorageSource } from "@/lib/looks/storage";
import { DRAFT_KEY, readStoredDraft } from "@/lib/skins/draft-store";
import { startDraft, type SkinDraft } from "@/lib/skins/model";

// The editor's draft, read-only, for the preview gallery: read from this browser after mount
// (Studio's own look when nothing is kept), and read again when the editor changes it in
// another tab. readStoredDraft never throws and checks every field.

export interface StoredDraft {
  readonly draft: SkinDraft;
  /** False until storage has been read. */
  readonly loaded: boolean;
}

const NOT_READ: StoredDraft = { draft: startDraft("studio"), loaded: false };

export function useStoredDraft(storage: StorageSource): StoredDraft {
  const [state, setState] = useState<StoredDraft>(NOT_READ);

  useEffect(() => {
    const read = () => setState({ draft: readStoredDraft(storage) ?? startDraft("studio"), loaded: true });
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === DRAFT_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storage]);

  return state;
}
