import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient, documentDownloadHref, type Fetch } from "@/lib/client/api";
import { type UploadSender, xhrUpload } from "@/lib/client/upload";

// The Knowledge client (P-010): the routes it calls, the upload's header and body, its
// failures as ApiError in words, and the XMLHttpRequest sender behind the progress bar.

const WORKSPACE = { id: "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10", name: "Home" };

function mockFetch(answer: (input: string, init?: RequestInit) => Response) {
  return vi.fn<Fetch>(async (input, init) => (input === "/api/workspace" ? Response.json(WORKSPACE) : answer(input, init)));
}

describe("document reads", () => {
  it("lists by skip and limit, and searches with {query} as JSON", async () => {
    const fetch = mockFetch((input) =>
      input.startsWith("/api/documents?") ? Response.json([{ id: 1, filename: "a.md" }]) : Response.json({ results: [] }),
    );
    const client = createApiClient(fetch);
    expect(await client.listDocuments({ skip: 50, limit: 50 })).toHaveLength(1);
    expect(fetch.mock.calls[1]?.[0]).toBe("/api/documents?skip=50&limit=50");
    await client.searchDocuments("salt");
    const [path, init] = fetch.mock.calls[2] ?? [];
    expect(path).toBe("/api/documents/search");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ query: "salt" });
  });

  it("deletes with DELETE and says why it couldn't", async () => {
    const fetch = mockFetch(() => Response.json({ detail: "Document not found" }, { status: 404 }));
    const client = createApiClient(fetch);
    await expect(client.deleteDocument(3)).rejects.toEqual(new ApiError(404, "Document not found"));
    expect(fetch.mock.calls[1]?.[1]?.method).toBe("DELETE");
    expect(documentDownloadHref(3)).toBe("/api/documents/3/download");
  });
});

describe("uploadDocument", () => {
  it("sends multipart through the sender with X-Play-Upload: 1, the workspace, and no Content-Type", async () => {
    const sender = vi.fn<UploadSender>(async () => ({
      status: 200,
      body: { document_id: 9, filename: "a.md", status: "processed", message: "ok" },
    }));
    const client = createApiClient(mockFetch(() => Response.json({})), sender);
    const onProgress = vi.fn();
    const result = await client.uploadDocument(new File(["hi"], "a.md"), { onProgress });
    expect(result).toEqual({ documentId: 9, filename: "a.md", status: "processed", message: "ok" });
    const request = sender.mock.calls[0]?.[0];
    expect(request?.url).toBe("/api/documents/upload");
    expect(request?.headers).toEqual({ "X-Play-Upload": "1", "X-Workspace-ID": WORKSPACE.id });
    expect(request?.body).toBeInstanceOf(FormData);
    expect(request?.onProgress).toBe(onProgress);
  });

  it("turns a refusal into an ApiError with the proxy's or the backend's words", async () => {
    const proxy = createApiClient(mockFetch(() => Response.json({})), async () => ({ status: 403, body: { error: "No" } }));
    await expect(proxy.uploadDocument(new File(["x"], "a.md"))).rejects.toEqual(new ApiError(403, "No"));
    const backend = createApiClient(mockFetch(() => Response.json({})), async () => ({ status: 400, body: { detail: "Bad type" } }));
    await expect(backend.uploadDocument(new File(["x"], "a.md"))).rejects.toEqual(new ApiError(400, "Bad type"));
    const odd = createApiClient(mockFetch(() => Response.json({})), async () => ({ status: 200, body: { status: "processed" } }));
    await expect(odd.uploadDocument(new File(["x"], "a.md"))).rejects.toBeInstanceOf(ApiError);
  });
});

/** Just enough of XMLHttpRequest for xhrUpload; the test drives its events. */
class FakeXhr {
  static last: FakeXhr | null = null;
  readonly headers = new Map<string, string>();
  readonly upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  };
  method = "";
  url = "";
  sent: unknown = null;
  status = 0;
  responseText = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.last = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value);
  }

  send(body: unknown) {
    this.sent = body;
  }

  abort() {
    this.onabort?.();
  }
}

describe("xhrUpload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeXhr.last = null;
  });

  function lastXhr(): FakeXhr {
    if (!FakeXhr.last) throw new Error("no request was made");
    return FakeXhr.last;
  }

  it("posts the form with the given headers, reports progress and reads the JSON answer", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const form = new FormData();
    const onProgress = vi.fn();
    const reply = xhrUpload({ url: "/api/documents/upload", headers: { "X-Play-Upload": "1" }, body: form, onProgress });
    const xhr = lastXhr();
    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe("/api/documents/upload");
    expect([...xhr.headers]).toEqual([["X-Play-Upload", "1"]]);
    expect(xhr.sent).toBe(form);
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 4, total: 8 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({ loaded: 4, total: 8 });
    xhr.status = 200;
    xhr.responseText = JSON.stringify({ document_id: 1 });
    xhr.onload?.();
    await expect(reply).resolves.toEqual({ status: 200, body: { document_id: 1 } });
  });

  it("gives null for a body that isn't JSON, and stops when the signal aborts", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const first = xhrUpload({ url: "/u", headers: {}, body: new FormData() });
    const xhr = lastXhr();
    xhr.status = 502;
    xhr.responseText = "<html>Bad gateway</html>";
    xhr.onload?.();
    await expect(first).resolves.toEqual({ status: 502, body: null });

    const controller = new AbortController();
    const second = xhrUpload({ url: "/u", headers: {}, body: new FormData(), signal: controller.signal });
    controller.abort();
    await expect(second).rejects.toMatchObject({ name: "AbortError" });
  });
});
