// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as deliverableFile } from "@/app/api/deliverables/[id]/file/route";

// GET /api/deliverables/{id}/file: reads the Deliverable's own preview_url from the
// backend, then passes that file's bytes through. The browser never names a path.

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const RAW = `/api/workspaces/${WORKSPACE_ID}/files/raw?path=outputs%2Fposter.png`;
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const fetchMock = vi.fn<typeof fetch>();

function playRequest(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost:3100${path}`, { headers: { "X-Workspace-ID": WORKSPACE_ID, ...headers } });
}

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function calledUrls(): readonly string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

function row(previewUrl: string | null): Response {
  return Response.json({ success: true, deliverable: { id: "d1", artifact_type: "image", preview_url: previewUrl } });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTOMATOS_BACKEND_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the Deliverable file route", () => {
  it("looks the Deliverable up, then passes its file's bytes through with the workspace header", async () => {
    fetchMock
      .mockResolvedValueOnce(row(RAW))
      .mockResolvedValueOnce(new Response(PNG_BYTES, { headers: { "content-type": "image/png" } }));

    const response = await deliverableFile(playRequest("/api/deliverables/d1/file"), params("d1"));

    expect(calledUrls()).toEqual([
      "http://localhost:8000/api/deliverables/d1",
      `http://localhost:8000${RAW}`,
    ]);
    const fileCall = fetchMock.mock.calls[1]?.[1];
    expect(new Headers(fileCall?.headers).get("X-Workspace-ID")).toBe(WORKSPACE_ID);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it("ignores any path the browser sends", async () => {
    fetchMock
      .mockResolvedValueOnce(row(RAW))
      .mockResolvedValueOnce(new Response(PNG_BYTES, { headers: { "content-type": "image/png" } }));

    await deliverableFile(playRequest("/api/deliverables/d1/file?path=.env"), params("d1"));

    expect(calledUrls()[1]).toBe(`http://localhost:8000${RAW}`);
  });

  it("answers 404 without a second call when the Deliverable has no raw file", async () => {
    for (const preview of [null, `/api/workspaces/${WORKSPACE_ID}/files/content?path=notes.md`, "https://elsewhere.example/a.png"]) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(row(preview));

      const response = await deliverableFile(playRequest("/api/deliverables/d1/file"), params("d1"));

      expect(response.status).toBe(404);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("passes the backend's 404 for a missing Deliverable straight back", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ detail: "Deliverable not found" }, { status: 404 }));

    const response = await deliverableFile(playRequest("/api/deliverables/d1/file"), params("d1"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: "Deliverable not found" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says Automatos isn't running when the backend doesn't answer", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const response = await deliverableFile(playRequest("/api/deliverables/d1/file"), params("d1"));

    expect(response.status).toBe(502);
  });

  it("refuses a bad id and a cross-site request without calling the backend", async () => {
    const badId = await deliverableFile(playRequest("/api/deliverables/x/file"), params("../workspaces/current"));
    const crossSite = await deliverableFile(
      playRequest("/api/deliverables/d1/file", { "Sec-Fetch-Site": "cross-site" }),
      params("d1"),
    );

    expect(badId.status).toBe(400);
    expect(crossSite.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
