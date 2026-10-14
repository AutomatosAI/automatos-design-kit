// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as upload } from "@/app/api/documents/upload/route";
import { MAX_UPLOAD_BYTES, UPLOAD_HEADER } from "@/lib/documents/rules";
import { forwardUpload, MAX_UPLOAD_BODY_BYTES, UPLOAD_TIMEOUT_MS } from "@/lib/server/upload";

// P-009: POST /api/documents/upload, the one route that isn't JSON. It needs
// X-Play-Upload: 1 (a custom header forces a preflight another site can't pass), keeps
// the Host and Sec-Fetch-Site checks, refuses over 50 MB before reading a byte, and
// streams the raw multipart body through with its boundary, never parsing the form.

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const BOUNDARY = "----PlayFormBoundary7MA4YWxkTrZu0gW";
const MULTIPART = `multipart/form-data; boundary=${BOUNDARY}`;
const BODY = new TextEncoder().encode(
  [
    `--${BOUNDARY}`,
    'Content-Disposition: form-data; name="file"; filename="notes.md"',
    "Content-Type: text/markdown",
    "",
    "# Notes\r\nBytes é stay as they are.",
    `--${BOUNDARY}`,
    'Content-Disposition: form-data; name="tags"',
    "",
    "plans,q4",
    `--${BOUNDARY}--`,
    "",
  ].join("\r\n"),
);

const fetchMock = vi.fn<typeof fetch>();

type UploadOptions = { headers?: Record<string, string>; body?: Uint8Array<ArrayBuffer>; host?: string };

function uploadRequest({ headers = {}, body = BODY, host = "localhost:3100" }: UploadOptions = {}): Request {
  return new Request(`http://${host}/api/documents/upload`, {
    method: "POST",
    headers: {
      "Content-Type": MULTIPART,
      "Content-Length": String(body.byteLength),
      [UPLOAD_HEADER]: "1",
      "X-Workspace-ID": WORKSPACE_ID,
      ...headers,
    },
    body,
  });
}

function forwarded(): { url: string; init: RequestInit & { duplex?: string } } {
  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error("the upload was not forwarded");
  return { url: String(call[0]), init: call[1] ?? {} };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTOMATOS_BACKEND_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchMock.mockImplementation(async () =>
    Response.json({ document_id: 12, filename: "notes.md", status: "processed", message: "Processed" }),
  );
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the upload route: refusals", () => {
  it("refuses an upload without X-Play-Upload: 1, before any call", async () => {
    const without = await upload(uploadRequest({ headers: { [UPLOAD_HEADER]: "" } }));
    const wrong = await upload(uploadRequest({ headers: { [UPLOAD_HEADER]: "yes" } }));

    expect(without.status).toBe(403);
    expect(wrong.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses over 50 MB from the declared length, without reading the body", async () => {
    const request = uploadRequest({ headers: { "Content-Length": String(MAX_UPLOAD_BODY_BYTES + 1) } });

    const response = await upload(request);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: expect.stringContaining("50 MB") });
    expect(request.bodyUsed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(MAX_UPLOAD_BYTES).toBe(50 * 1024 * 1024);
  });

  it("refuses an upload that doesn't say its length (411)", async () => {
    expect((await upload(uploadRequest({ headers: { "Content-Length": "lots" } }))).status).toBe(411);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the Host and Sec-Fetch-Site checks", async () => {
    const rebound = await upload(uploadRequest({ host: "attacker.example:3100" }));
    const crossSite = await upload(uploadRequest({ headers: { "Sec-Fetch-Site": "cross-site" } }));

    expect(rebound.status).toBe(403);
    expect(crossSite.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a body that isn't multipart with a boundary (415)", async () => {
    const json = await upload(uploadRequest({ headers: { "Content-Type": "application/json" } }));
    const noBoundary = await upload(uploadRequest({ headers: { "Content-Type": "multipart/form-data" } }));

    expect(json.status).toBe(415);
    expect(noBoundary.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the upload route: streaming through", () => {
  it("forwards the body bytes unchanged, with the original boundary, as a half-duplex stream", async () => {
    const response = await upload(uploadRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ status: "processed" }));
    const { url, init } = forwarded();
    expect(url).toBe("http://localhost:8000/api/documents/upload");
    expect(init.method).toBe("POST");
    expect(init.duplex).toBe("half");
    expect(init.body).toBeInstanceOf(ReadableStream);
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe(MULTIPART);
    expect(headers.get("X-Workspace-ID")).toBe(WORKSPACE_ID);
    expect(headers.get(UPLOAD_HEADER)).toBeNull();
    expect(new Uint8Array(await new Response(init.body).arrayBuffer())).toEqual(BODY);
  });

  it("passes the backend's answer back as it came, with the safety headers", async () => {
    fetchMock.mockImplementation(async () => Response.json({ detail: "File type does not match" }, { status: 400 }));

    const response = await upload(uploadRequest());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ detail: "File type does not match" });
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("waits up to five minutes, then says Automatos took too long", async () => {
    expect(UPLOAD_TIMEOUT_MS).toBe(5 * 60 * 1000);
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
    );

    const response = await forwardUpload(uploadRequest(), 20);

    expect(response.status).toBe(504);
  });

  it("says Automatos isn't running when the backend can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await upload(uploadRequest());

    expect(response.status).toBe(502);
  });
});
