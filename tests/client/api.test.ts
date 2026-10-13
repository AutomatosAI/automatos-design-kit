// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, type Fetch } from "@/lib/client/api";

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const WORKSPACE = { id: WORKSPACE_ID, name: "Home", slug: "home" };

type Routes = Readonly<Record<string, () => Response>>;

/** A fetch that answers by path (query string ignored) and records every call. */
function mockFetch(routes: Routes) {
  return vi.fn<Fetch>(async (input) => {
    const path = input.split("?")[0] ?? input;
    const answer = routes[path];
    if (!answer) throw new Error(`unexpected call to ${input}`);
    return answer();
  });
}

const workspaceOk = (): Response => Response.json(WORKSPACE);

function callsTo(fetchMock: ReturnType<typeof mockFetch>, path: string): readonly [string, RequestInit][] {
  return fetchMock.mock.calls
    .filter(([input]) => input.split("?")[0] === path)
    .map(([input, init]): [string, RequestInit] => [input, init ?? {}]);
}

function firstCallTo(fetchMock: ReturnType<typeof mockFetch>, path: string): [string, RequestInit] {
  const call = callsTo(fetchMock, path)[0];
  if (!call) throw new Error(`no call to ${path}`);
  return call;
}

function headerOf(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lib/client/api", () => {
  it("fetches the workspace once and sends its id on every call", async () => {
    const fetchMock = mockFetch({
      "/api/workspace": workspaceOk,
      "/api/chat/history": () => Response.json([]),
      "/api/deliverables": () => Response.json({ success: true, deliverables: [], total: 0 }),
    });
    const client = createApiClient(fetchMock);

    await Promise.all([client.listChats(), client.listDeliverables()]);
    await client.listChats();

    expect(callsTo(fetchMock, "/api/workspace")).toHaveLength(1);
    const calls = [...callsTo(fetchMock, "/api/chat/history"), ...callsTo(fetchMock, "/api/deliverables")];
    expect(calls).toHaveLength(3);
    for (const [, init] of calls) expect(headerOf(init, "X-Workspace-ID")).toBe(WORKSPACE_ID);
  });

  it("doesn't send X-Workspace-ID when asking for the workspace", async () => {
    const fetchMock = mockFetch({ "/api/workspace": workspaceOk });

    expect(await createApiClient(fetchMock).getWorkspace()).toEqual({ id: WORKSPACE_ID, name: "Home" });
    const [, init] = firstCallTo(fetchMock, "/api/workspace");
    expect(headerOf(init, "X-Workspace-ID")).toBeNull();
  });

  it("doesn't cache a failed workspace call, so Check again can retry", async () => {
    const fetchMock = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(
        Response.json({ error: "Automatos isn't running at http://localhost:8000" }, { status: 502 }),
      )
      .mockResolvedValueOnce(workspaceOk());
    const client = createApiClient(fetchMock);

    const first = await client.getWorkspace().catch((error: unknown) => error);
    expect(first).toBeInstanceOf(ApiError);
    expect(first).toMatchObject({ status: 502, message: "Automatos isn't running at http://localhost:8000" });

    expect((await client.getWorkspace()).id).toBe(WORKSPACE_ID);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("asks for Deliverables with heartbeat hidden, the type filter and the offset", async () => {
    const fetchMock = mockFetch({
      "/api/workspace": workspaceOk,
      "/api/deliverables": () => Response.json({ success: true, deliverables: [], total: 0 }),
    });

    await createApiClient(fetchMock).listDeliverables({ artifactType: "report", limit: 24, offset: 48 });

    const [input] = firstCallTo(fetchMock, "/api/deliverables");
    const query = new URLSearchParams(input.split("?")[1]);
    expect(query.get("source_type_exclude")).toBe("heartbeat");
    expect(query.get("artifact_type")).toBe("report");
    expect(query.get("limit")).toBe("24");
    expect(query.get("offset")).toBe("48");
  });

  it("returns success: false from the Deliverables list instead of an empty list", async () => {
    const fetchMock = mockFetch({
      "/api/workspace": workspaceOk,
      "/api/deliverables": () => Response.json({ success: false, error: "query failed", deliverables: [] }),
    });

    const listed = await createApiClient(fetchMock).listDeliverables();

    expect(listed).toEqual({ success: false, error: "query failed" });
  });

  it("reads a Deliverable from its {success, deliverable} wrapper", async () => {
    const fetchMock = mockFetch({
      "/api/workspace": workspaceOk,
      "/api/deliverables/d1": () =>
        Response.json({
          success: true,
          deliverable: { id: "d1", title: "Q3 report", artifact_type: "report", content: "# Hi" },
        }),
    });

    const shown = await createApiClient(fetchMock).getDeliverable("d1");

    expect(shown).toMatchObject({ id: "d1", title: "Q3 report", artifactType: "report", content: "# Hi" });
    const [input] = firstCallTo(fetchMock, "/api/deliverables/d1");
    expect(input).toBe("/api/deliverables/d1?include_content=true");
  });

  it("gets a thumbnail as bytes, and null when there is none", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const fetchMock = mockFetch({
      "/api/workspace": workspaceOk,
      "/api/deliverables/d1/thumbnail": () => new Response(png, { headers: { "content-type": "image/png" } }),
      "/api/deliverables/d2/thumbnail": () => Response.json({ detail: "Preview not found" }, { status: 404 }),
    });
    const client = createApiClient(fetchMock);

    const blob = await client.deliverableThumbnail("d1");
    if (!blob) throw new Error("no thumbnail");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(png);
    expect(await client.deliverableThumbnail("d2")).toBeNull();
  });

  it("posts the chat turn as JSON and cancels with a bodyless POST", async () => {
    const fetchMock = mockFetch({
      "/api/workspace": workspaceOk,
      "/api/chat": () => new Response('0:"hi"\n'),
      "/api/chat/c1/cancel": () => Response.json({ cancelled: true }),
    });
    const client = createApiClient(fetchMock);
    const turn = {
      id: "",
      message: { role: "user" as const, parts: [{ type: "text" as const, text: "hello" }] },
      selectedVisibilityType: "private" as const,
    };

    const response = await client.streamChat(turn);
    expect(await response.text()).toBe('0:"hi"\n');
    const [, chatInit] = firstCallTo(fetchMock, "/api/chat");
    expect(chatInit.method).toBe("POST");
    expect(headerOf(chatInit, "Content-Type")).toBe("application/json");
    expect(JSON.parse(String(chatInit.body))).toEqual(turn);

    expect(await client.cancelChat("c1")).toBe(true);
    const [, cancelInit] = firstCallTo(fetchMock, "/api/chat/c1/cancel");
    expect(cancelInit.method).toBe("POST");
    expect(cancelInit.body).toBeUndefined();
    expect(headerOf(cancelInit, "Content-Type")).toBe("application/json");
  });

  it("turns a 502 into an ApiError carrying the backend's words", async () => {
    const fetchMock = mockFetch({
      "/api/workspace": workspaceOk,
      "/api/chat/history": () => Response.json({ error: "Automatos isn't running at x" }, { status: 502 }),
    });

    const error = await createApiClient(fetchMock).listChats().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, message: "Automatos isn't running at x" });
  });
});
