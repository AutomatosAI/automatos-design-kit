// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as cancelChat } from "@/app/api/chat/[id]/cancel/route";
import { GET as chatMessages } from "@/app/api/chat/[id]/messages/route";
import { GET as chatHistory } from "@/app/api/chat/history/route";
import { GET as deliverable } from "@/app/api/deliverables/[id]/route";
import { GET as thumbnail } from "@/app/api/deliverables/[id]/thumbnail/route";
import { GET as deliverables } from "@/app/api/deliverables/route";
import { GET as workspace } from "@/app/api/workspace/route";

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const CHAT_ID = "7b0e4c1a-2d3f-4a5b-8c6d-9e0f1a2b3c4d";
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);

const fetchMock = vi.fn<typeof fetch>();

function playRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost:3100${path}`, {
    ...init,
    headers: { "X-Workspace-ID": WORKSPACE_ID, ...(init.headers as Record<string, string>) },
  });
}

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function forwarded(): { url: string; init: RequestInit; headers: Headers } {
  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error("fetch was not called");
  const init = call[1] ?? {};
  return { url: String(call[0]), init, headers: new Headers(init.headers) };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
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

describe("the JSON proxy routes", () => {
  it("maps GET /api/workspace to /api/workspaces/current", async () => {
    fetchMock.mockResolvedValue(json({ id: WORKSPACE_ID, name: "Home" }));

    const response = await workspace(new Request("http://localhost:3100/api/workspace"));

    expect(forwarded().url).toBe("http://localhost:8000/api/workspaces/current");
    expect(forwarded().init.method).toBe("GET");
    expect(await response.json()).toEqual({ id: WORKSPACE_ID, name: "Home" });
  });

  it("forwards the query string and X-Workspace-ID", async () => {
    fetchMock.mockResolvedValue(json([]));

    await chatHistory(playRequest("/api/chat/history?limit=5"));

    expect(forwarded().url).toBe("http://localhost:8000/api/chat/history?limit=5");
    expect(forwarded().headers.get("x-workspace-id")).toBe(WORKSPACE_ID);
  });

  it("forwards every Deliverable filter on the query string, unchanged", async () => {
    fetchMock.mockResolvedValue(json({ success: true, deliverables: [], total: 0 }));
    const search = "?source_type_exclude=heartbeat&artifact_type=report&limit=24&offset=48";

    await deliverables(playRequest(`/api/deliverables${search}`));

    expect(forwarded().url).toBe(`http://localhost:8000/api/deliverables${search}`);
  });

  it("drops query parameters the route doesn't allow", async () => {
    fetchMock.mockImplementation(async () => json({ id: WORKSPACE_ID }));

    await workspace(new Request(`http://localhost:3100/api/workspace?workspace_id=${WORKSPACE_ID}`));
    await chatHistory(playRequest(`/api/chat/history?workspace_id=${WORKSPACE_ID}&limit=4`));

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://localhost:8000/api/workspaces/current");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("http://localhost:8000/api/chat/history?limit=4");
  });

  it("puts the id in the path and keeps include_content", async () => {
    fetchMock.mockResolvedValue(json({ success: true, deliverable: { id: "d1" } }));

    await deliverable(playRequest("/api/deliverables/d1?include_content=true"), params("d1"));

    expect(forwarded().url).toBe("http://localhost:8000/api/deliverables/d1?include_content=true");
  });

  it("loads a conversation's messages", async () => {
    fetchMock.mockResolvedValue(json([]));

    await chatMessages(playRequest(`/api/chat/${CHAT_ID}/messages`), params(CHAT_ID));

    expect(forwarded().url).toBe(`http://localhost:8000/api/chat/${CHAT_ID}/messages`);
  });

  it("forwards cancel as a POST with no body", async () => {
    fetchMock.mockResolvedValue(json({ cancelled: true }));

    const response = await cancelChat(
      playRequest(`/api/chat/${CHAT_ID}/cancel`, { method: "POST" }),
      params(CHAT_ID),
    );

    expect(forwarded().url).toBe(`http://localhost:8000/api/chat/${CHAT_ID}/cancel`);
    expect(forwarded().init.method).toBe("POST");
    expect(forwarded().init.body).toBeUndefined();
    expect(await response.json()).toEqual({ cancelled: true });
  });

  it("passes the thumbnail through as bytes with its content-type", async () => {
    fetchMock.mockResolvedValue(
      new Response(PNG_BYTES, {
        status: 200,
        headers: { "content-type": "image/png", "cache-control": "private, max-age=300" },
      }),
    );

    const response = await thumbnail(playRequest("/api/deliverables/d1/thumbnail"), params("d1"));

    expect(forwarded().url).toBe("http://localhost:8000/api/deliverables/d1/thumbnail");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it("returns the backend status unchanged", async () => {
    fetchMock.mockResolvedValue(json({ detail: "Preview not found" }, 404));

    const response = await thumbnail(playRequest("/api/deliverables/d1/thumbnail"), params("d1"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: "Preview not found" });
  });

  it("returns 502 when the backend can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await deliverables(playRequest("/api/deliverables"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Automatos isn't running at http://localhost:8000",
    });
  });

  it("never forwards Authorization or other browser headers", async () => {
    fetchMock.mockResolvedValue(json([]));

    await chatHistory(
      playRequest("/api/chat/history", { headers: { Authorization: "Bearer x", Cookie: "a=b" } }),
    );

    const { headers } = forwarded();
    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
  });

  it("rejects an id that could change the backend path, without calling it", async () => {
    const traversal = await deliverable(playRequest("/api/deliverables/x"), params("../workspaces/current"));
    const query = await chatMessages(playRequest("/api/chat/x/messages"), params("c1?limit=1"));

    expect(traversal.status).toBe(400);
    expect(query.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a cross-site request without calling the backend", async () => {
    const response = await workspace(
      playRequest("/api/workspace", { headers: { "Sec-Fetch-Site": "cross-site" } }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
