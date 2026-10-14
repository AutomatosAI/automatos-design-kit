// @vitest-environment node
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/examples/[slug]/preview.png/route";

// PRD-004 K-008: GET /examples/<slug>/preview.png serves an example's assets/preview.png, and
// nothing else from the file system.

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function get(slug: string): Promise<Response> {
  const request = new Request(`http://localhost:3100/examples/${encodeURIComponent(slug)}/preview.png`);
  return GET(request, { params: Promise.resolve({ slug }) });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /examples/<slug>/preview.png", () => {
  it("serves the example's picture as a PNG", async () => {
    const response = await get("neon");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const served = new Uint8Array(await response.arrayBuffer());
    const file = new Uint8Array(await readFile(join(REPO, "skins", "neon", "assets", "preview.png")));
    expect(served).toEqual(file);
  });

  it.each(["nope", "../neon", "neon/../../package.json", "README.md", "constructor"])("refuses %s with a 404", async (slug) => {
    const response = await get(slug);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("There's no example skin by that name.");
  });
});
