// A Deliverable's thumbnail as an object URL. The route needs X-Workspace-ID, so a plain
// <img src> can't load it: the bytes come through the API client and the URL is revoked
// when the card goes. null means none (404) or it failed: the card shows its fallback.

import { useEffect, useState } from "react";

import type { ApiClient } from "@/lib/client/api";

export function useThumbnail(client: ApiClient, id: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    client
      .deliverableThumbnail(id)
      .then((blob) => {
        if (!live || !blob) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch((error: unknown) => {
        console.warn(`[shelf] no thumbnail for Deliverable ${id}, showing its type colour`, error);
      });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [client, id]);

  return url;
}
