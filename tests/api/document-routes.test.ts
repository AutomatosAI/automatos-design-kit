// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as deleteImpact } from "@/app/api/documents/[id]/delete-impact/route";
import { GET as content } from "@/app/api/documents/[id]/content/route";
import { DELETE as deleteDocument, GET as getDocument } from "@/app/api/documents/[id]/route";
import { GET as queueStatus } from "@/app/api/documents/queue-status/route";
import { GET as listDocuments } from "@/app/api/documents/route";
import { POST as search } from "@/app/api/documents/search/route";

// P-009: the JSON document routes (knowledge.md). Query allowlists, whole-number ids,
// the search body trimmed to its fields and the backend's 422 handed back as it came.

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const BACKEND = "http://localhost:8000";

type Context = { params: Promise<{ id: string }> };

const fetchMock = vi.fn<typeof fetch>();

function playRequest(path: string, init: RequestInit = {}): Request {
  const json = (init.method ?? "GET") === "GET" ? {} : { "Content-Type": "application/json" };
  return new Request(`http://localhost:3100${path}`, {
    ...init,
    headers: { "X-Workspace-ID": WORKSPACE_ID, ...json, ...(init.headers as Record<string, string>) },
  });
}

function params(id: string): Context {
  return { params: Promise.resolve({ id }) };
}

function forwarded(index = 0): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`fetch call ${index} was not made`);
  return { url: String(call[0]), init: call[1] ?? {} };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTOMATOS_BACKEND_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchMock.mockImplementation(async () => Response.json({ id: 12, filename: "notes.md", status: "processed" }));
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("document routes: the list and the queue", () => {
  it("keeps only the list's allowlisted query keys", async () => {
    const query = "?skip=20&limit=10&status=processed&file_type=pdf&search=plan&workspace_id=other&team=ops&content_hash=x";

    const response = await listDocuments(playRequest(`/api/documents${query}`));

    expect(response.status).toBe(200);
    expect(forwarded().url).toBe(`${BACKEND}/api/documents?skip=20&limit=10&status=processed&file_type=pdf&search=plan`);
    expect(new Headers(forwarded().init.headers).get("X-Workspace-ID")).toBe(WORKSPACE_ID);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("asks the backend's queue route, with no query", async () => {
    await queueStatus(playRequest("/api/documents/queue-status?workspace_id=other"));

    expect(forwarded().url).toBe(`${BACKEND}/api/documents/queue/status`);
  });
});

describe("document routes: one document", () => {
  const reads: readonly [string, (request: Request, context: Context) => Promise<Response>, string][] = [
    ["the document", getDocument, ""],
    ["its content", content, "/content"],
    ["its delete impact", deleteImpact, "/delete-impact"],
  ];

  it.each(reads)("forwards %s with no query", async (_what, route, suffix) => {
    await route(playRequest(`/api/documents/12${suffix}?highlight_chunk_ids=1&workspace_id=other`), params("12"));

    expect(forwarded().url).toBe(`${BACKEND}/api/documents/12${suffix}`);
    expect(forwarded().init.method).toBe("GET");
  });

  it("forwards DELETE with no body", async () => {
    const response = await deleteDocument(playRequest("/api/documents/12", { method: "DELETE" }), params("12"));

    expect(response.status).toBe(200);
    expect(forwarded().url).toBe(`${BACKEND}/api/documents/12`);
    expect(forwarded().init.method).toBe("DELETE");
    expect(forwarded().init.body).toBeUndefined();
  });

  it("refuses a DELETE another site started, or one not typed as JSON", async () => {
    const crossSite = playRequest("/api/documents/12", { method: "DELETE", headers: { "Sec-Fetch-Site": "cross-site" } });
    const untyped = new Request("http://localhost:3100/api/documents/12", { method: "DELETE" });

    expect((await deleteDocument(crossSite, params("12"))).status).toBe(403);
    expect((await deleteDocument(untyped, params("12"))).status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-1", "1.5", "12;drop", "1234567890123", "../upload"])(
    "refuses the id %s before any call",
    async (id) => {
      const response = await getDocument(playRequest(`/api/documents/${encodeURIComponent(id)}`), params(id));

      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("document routes: search", () => {
  function searchRequest(body: unknown): Request {
    return playRequest("/api/documents/search?team=ops", { method: "POST", body: JSON.stringify(body) });
  }

  it("forwards the search fields and drops the rest", async () => {
    fetchMock.mockImplementation(async () => Response.json({ query: "plan", total_results: 0, results: [] }));

    const response = await search(searchRequest({ query: "plan", limit: 10, team: "ops", workspace_id: "other" }));

    expect(response.status).toBe(200);
    expect(forwarded().url).toBe(`${BACKEND}/api/documents/search`);
    expect(forwarded().init.method).toBe("POST");
    expect(JSON.parse(String(forwarded().init.body))).toEqual({ query: "plan", limit: 10 });
  });

  it("passes the backend's 422 back unchanged when the query is missing", async () => {
    const detail = { detail: "Search query is required" };
    fetchMock.mockImplementation(async () => Response.json(detail, { status: 422 }));

    const response = await search(searchRequest({}));

    expect(JSON.parse(String(forwarded().init.body))).toEqual({});
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(detail);
  });

  it("refuses a body that isn't a JSON object, before any call", async () => {
    expect((await search(searchRequest(["plan"]))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
