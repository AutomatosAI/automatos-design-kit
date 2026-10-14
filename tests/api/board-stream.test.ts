// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as stream } from "@/app/api/tasks/stream/route";

// B-001: the board's live stream passes through as it arrives: no buffering, no
// compression (Cache-Control no-transform), and the proxy's safety checks still hold.

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";

const fetchMock = vi.fn<typeof fetch>();

function streamRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3100/api/tasks/stream?workspace_id=other", {
    headers: { "X-Workspace-ID": WORKSPACE_ID, ...headers },
  });
}

type Backend = { response: Response; send: (text: string) => void; close: () => void };

function backendStream(): Backend {
  const encoder = new TextEncoder();
  const holder: { controller?: ReadableStreamDefaultController<Uint8Array> } = {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      holder.controller = controller;
    },
  });
  const controller = (): ReadableStreamDefaultController<Uint8Array> => {
    if (!holder.controller) throw new Error("the stream has not started");
    return holder.controller;
  };
  return {
    response: new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
    }),
    send: (text) => controller().enqueue(encoder.encode(text)),
    close: () => controller().close(),
  };
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

describe("GET /api/tasks/stream", () => {
  it("asks the backend's stream for events, uncompressed, with the workspace and no query", async () => {
    fetchMock.mockResolvedValue(backendStream().response);

    await stream(streamRequest());

    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch was not called");
    expect(String(call[0])).toBe("http://localhost:8000/api/v1/tasks/stream");
    const headers = new Headers(call[1]?.headers);
    expect(headers.get("accept")).toBe("text/event-stream");
    expect(headers.get("accept-encoding")).toBe("identity");
    expect(headers.get("x-workspace-id")).toBe(WORKSPACE_ID);
    expect(call[1]?.body).toBeUndefined();
  });

  it("answers no-cache, no-transform with the safety headers", async () => {
    fetchMock.mockResolvedValue(backendStream().response);

    const response = await stream(streamRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const cacheControl = response.headers.get("cache-control") ?? "";
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).toContain("no-transform");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.has("content-encoding")).toBe(false);
  });

  it("passes each chunk through as it arrives", async () => {
    const backend = backendStream();
    fetchMock.mockResolvedValue(backend.response);

    const response = await stream(streamRequest());
    if (!response.body) throw new Error("no stream");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    backend.send(": heartbeat\n\n");
    expect(decoder.decode((await reader.read()).value)).toBe(": heartbeat\n\n");

    backend.send('event: board_changed\ndata: {"task_id": 42}\n\n');
    expect(decoder.decode((await reader.read()).value)).toBe('event: board_changed\ndata: {"task_id": 42}\n\n');

    backend.close();
    expect((await reader.read()).done).toBe(true);
  });

  it("keeps the proxy's checks: another site and a foreign Host are refused before any call", async () => {
    const crossSite = await stream(streamRequest({ "Sec-Fetch-Site": "cross-site" }));
    const rebound = await stream(
      new Request("http://attacker.example:3100/api/tasks/stream", { headers: { "X-Workspace-ID": WORKSPACE_ID } }),
    );

    expect(crossSite.status).toBe(403);
    expect(rebound.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 502 when Automatos isn't running", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await stream(streamRequest());

    expect(response.status).toBe(502);
  });
});
