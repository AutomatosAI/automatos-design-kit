import { forwardUpload } from "@/lib/server/upload";

// The one multipart route: X-Play-Upload required, 50 MB cap checked before reading, raw
// body streamed through unparsed (lib/server/upload.ts). The backend processes the file
// before it answers, so this request may last minutes.

export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  return forwardUpload(request);
}
