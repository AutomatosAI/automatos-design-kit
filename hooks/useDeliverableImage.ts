// An image Deliverable's picture as an object URL. Like the thumbnail, the file route
// needs X-Workspace-ID, so the bytes come through the API client, and the URL is revoked
// when the page goes. The picture shows in an <img>, where an SVG's scripts never run.

import { useEffect, useState } from "react";

import type { ApiClient } from "@/lib/client/api";

export type DeliverableImage =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly url: string }
  | { readonly status: "failed" };

const LOADING: DeliverableImage = { status: "loading" };

export function useDeliverableImage(client: ApiClient, id: string): DeliverableImage {
  const [image, setImage] = useState<DeliverableImage>(LOADING);

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    setImage(LOADING);
    client
      .deliverableFile(id)
      .then((blob) => {
        if (!live) return;
        made = URL.createObjectURL(blob);
        setImage({ status: "ready", url: made });
      })
      .catch((error: unknown) => {
        console.error(`[deliverable] the picture of Deliverable ${id} didn't load`, error);
        if (live) setImage({ status: "failed" });
      });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [client, id]);

  return image;
}
