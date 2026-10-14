import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { findExample } from "@/lib/skins/examples";
import { PREVIEW_PATH } from "@/lib/skins/format";

// GET /examples/<slug>/preview.png: an example skin's picture, read from skins/<slug>/assets/.
// Only the slugs of EXAMPLE_SKINS are served (no path from the URL reaches the file system).

const SKINS_DIR = "skins";

function notFound(message: string): Response {
  return new Response(message, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  const example = findExample(slug);
  if (!example) return notFound("There's no example skin by that name.");
  try {
    const bytes = await readFile(join(process.cwd(), SKINS_DIR, example.slug, PREVIEW_PATH));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(`[skins] couldn't read the preview of the ${example.slug} example:`, error);
    return notFound("This example's picture is missing.");
  }
}
