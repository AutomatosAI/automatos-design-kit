import { BACKEND_SUBMIT_PATH, forwardSkin } from "@/lib/server/skin-forward";

// Submit to the Marketplace: the packed skin goes to POST /api/marketplace/skins, pending review
// unless the author is trusted (core PRD-259 S-005). The same checks and streaming as the import
// route (lib/server/skin-forward.ts).

export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  return forwardSkin(request, BACKEND_SUBMIT_PATH);
}
