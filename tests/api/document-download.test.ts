// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as download } from "@/app/api/documents/[id]/download/route";
import { attachmentHeader, downloadTarget } from "@/lib/server/download";

// P-009: GET /api/documents/{id}/download. Play asks the backend for mode=url and never
// takes a path or URL from the browser. https: storage -> 302; anything else is fetched by
// Play's server and streamed as an attachment with nosniff and the sandbox CSP.

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const ASK = "http://localhost:8000/api/documents/12/download?mode=url";
const PRESIGNED = "https://docs.s3.eu-west-1.amazonaws.com/workspaces/ws/documents/12_notes.md?X-Amz-Signature=abc";
const MINIO = "http://localhost:9000/docs/workspaces/ws/documents/12_notes.md?X-Amz-Signature=abc";
const BYTES = new Uint8Array([0x23, 0x20, 0x4e, 0x6f, 0x74, 0x65, 0x73, 0x0a]);
const SANDBOX = "default-src 'none'; sandbox";

const fetchMock = vi.fn<typeof fetch>();

function playRequest(query = ""): Request {
  return new Request(`http://localhost:3100/api/documents/12/download${query}`, {
    headers: { "X-Workspace-ID": WORKSPACE_ID },
  });
}

function params(id = "12"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function calledUrls(): readonly string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

function link(url: string): Response {
  return Response.json({ url, filename: "notes.md" });
}

function file(headers: Record<string, string> = {}): Response {
  return new Response(BYTES, { headers: { "content-type": "text/markdown", ...headers } });
}

function expectSafeFile(response: Response): void {
  expect(response.status).toBe(200);
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("content-security-policy")).toBe(SANDBOX);
  expect(response.headers.get("content-disposition")).toMatch(/^attachment\b/);
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

describe("the document download route", () => {
  it("answers an https: storage URL with a 302 to it, fetching nothing else", async () => {
    fetchMock.mockResolvedValueOnce(link(PRESIGNED));

    const response = await download(playRequest(), params());

    expect(calledUrls()).toEqual([ASK]);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("X-Workspace-ID")).toBe(WORKSPACE_ID);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(PRESIGNED);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("fetches an http: URL on the server and streams the bytes with the safety headers", async () => {
    fetchMock.mockResolvedValueOnce(link(MINIO)).mockResolvedValueOnce(file());

    const response = await download(playRequest(), params());

    expect(calledUrls()).toEqual([ASK, MINIO]);
    expectSafeFile(response);
    expect(response.headers.get("content-type")).toBe("text/markdown");
    expect(response.headers.get("content-disposition")).toContain('filename="notes.md"');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
  });

  it("fetches a backend-relative path through the backend, with the workspace header", async () => {
    fetchMock.mockResolvedValueOnce(link("/api/files/12/raw")).mockResolvedValueOnce(file());

    const response = await download(playRequest(), params());

    expect(calledUrls()).toEqual([ASK, "http://localhost:8000/api/files/12/raw"]);
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("X-Workspace-ID")).toBe(WORKSPACE_ID);
    expectSafeFile(response);
  });

  it("streams the backend's own bytes (no storage) as an attachment, keeping its filename", async () => {
    const disposition = 'attachment; filename="notes.md"';
    fetchMock.mockResolvedValueOnce(
      new Response(BYTES, { headers: { "content-type": "application/octet-stream", "content-disposition": disposition } }),
    );

    const response = await download(playRequest(), params());

    expect(calledUrls()).toEqual([ASK]);
    expectSafeFile(response);
    expect(response.headers.get("content-disposition")).toBe(disposition);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
  });

  it("ignores any path, URL or mode the browser sends", async () => {
    fetchMock.mockResolvedValueOnce(link(PRESIGNED));

    await download(playRequest("?path=/etc/passwd&url=http://evil.example/&mode=redirect"), params());

    expect(calledUrls()).toEqual([ASK]);
  });

  it("refuses a bad id before any call", async () => {
    const response = await download(playRequest(), params("../../etc"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["file:///etc/passwd", "javascript:alert(1)", "//evil.example/x", "https://user:pw@s3.example/x"])(
    "won't open %s",
    async (url) => {
      fetchMock.mockResolvedValueOnce(link(url));

      const response = await download(playRequest(), params());

      expect(response.status).toBe(404);
      expect(calledUrls()).toEqual([ASK]);
    },
  );

  it("passes the backend's 404 back when the document has no file", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ detail: "Document not found" }, { status: 404 }));

    const response = await download(playRequest(), params());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: "Document not found" });
  });

  it("says so in words when storage refuses the file", async () => {
    fetchMock.mockResolvedValueOnce(link(MINIO)).mockResolvedValueOnce(new Response("expired", { status: 403 }));

    const response = await download(playRequest(), params());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: expect.stringContaining("couldn't hand over") });
  });
});

describe("download helpers", () => {
  it("sorts URLs into redirect, fetch, backend or none", () => {
    expect(downloadTarget(PRESIGNED)).toEqual({ kind: "redirect", url: PRESIGNED });
    expect(downloadTarget(MINIO)).toEqual({ kind: "fetch", url: MINIO });
    expect(downloadTarget("/api/x")).toEqual({ kind: "backend", path: "/api/x" });
    expect(downloadTarget("data:text/html,<b>x</b>")).toBeNull();
    expect(downloadTarget("notes.md")).toBeNull();
  });

  it("always downloads, and keeps an unusual filename safe in the header", () => {
    expect(attachmentHeader("inline", null)).toBe("attachment");
    expect(attachmentHeader('attachment; filename="a.pdf"', "b.pdf")).toBe('attachment; filename="a.pdf"');
    expect(attachmentHeader(null, 'Plan "Q4" é.md')).toBe(
      `attachment; filename="Plan _Q4_ _.md"; filename*=UTF-8''${encodeURIComponent('Plan "Q4" é.md')}`,
    );
  });
});
