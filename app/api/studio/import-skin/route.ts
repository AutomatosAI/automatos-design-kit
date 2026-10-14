import { BACKEND_IMPORT_PATH, forwardSkin } from "@/lib/server/skin-forward";

// Load into my Automatos: the packed skin goes to POST /api/skins/import, which installs it in
// this workspace at once (core PRD-259 S-003). X-Skin-Kit: 1 required, 15 MB cap checked before
// reading, raw multipart body streamed through unparsed (lib/server/skin-forward.ts).

export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  return forwardSkin(request, BACKEND_IMPORT_PATH);
}
