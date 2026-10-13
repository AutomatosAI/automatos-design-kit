// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const TURN = {
  id: "",
  message: { role: "user", parts: [{ type: "text", text: "hello" }] },
  selectedVisibilityType: "private",
};

const fetchMock = vi.fn<typeof fetch>();

function chatRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3100/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

function forwardedInit(): RequestInit {
  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error("fetch was not called");
  return call[1] ?? {};
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

describe("POST /api/chat", () => {
  it("forwards the JSON body and X-Workspace-ID to the backend", async () => {
    fetchMock.mockResolvedValue(new Response("0:\"hi\"\n", { status: 200 }));

    await POST(chatRequest(JSON.stringify(TURN), { "X-Workspace-ID": WORKSPACE_ID }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:8000/api/chat");
    const init = forwardedInit();
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(TURN);
    const headers = new Headers(init.headers);
    expect(headers.get("x-workspace-id")).toBe(WORKSPACE_ID);
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("uses AUTOMATOS_BACKEND_URL when it is set", async () => {
    vi.stubEnv("AUTOMATOS_BACKEND_URL", "http://backend:8000/");
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));

    await POST(chatRequest(JSON.stringify(TURN)));

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://backend:8000/api/chat");
  });

  it("never sends an Authorization header, even when the browser sends one", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));

    await POST(chatRequest(JSON.stringify(TURN), { Authorization: "Bearer from-the-page" }));

    const headers = new Headers(forwardedInit().headers);
    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("x-api-key")).toBe(false);
  });

  it("passes the stream through chunk by chunk, without buffering", async () => {
    const holder: { controller?: ReadableStreamDefaultController<Uint8Array> } = {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        holder.controller = controller;
      },
    });
    fetchMock.mockResolvedValue(
      new Response(stream, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } }),
    );

    const response = await POST(chatRequest(JSON.stringify(TURN)));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const backend = holder.controller;
    if (!response.body || !backend) throw new Error("no stream");

    const reader = response.body.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    backend.enqueue(encoder.encode('d:{"type":"chat-id","chatId":"c1"}\n'));
    const first = await reader.read();
    expect(decoder.decode(first.value)).toBe('d:{"type":"chat-id","chatId":"c1"}\n');

    backend.enqueue(encoder.encode('0:"Hel'));
    const second = await reader.read();
    expect(decoder.decode(second.value)).toBe('0:"Hel');

    backend.close();
    expect((await reader.read()).done).toBe(true);
  });

  it("returns the backend status and content-type unchanged", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"detail":"Workspace not found"}', {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await POST(chatRequest(JSON.stringify(TURN)));

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual({ detail: "Workspace not found" });
  });

  it("returns 502 when the backend can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await POST(chatRequest(JSON.stringify(TURN)));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Automatos isn't running at http://localhost:8000",
    });
    expect(console.error).toHaveBeenCalled();
  });

  it("rejects a body that is not a JSON object without calling the backend", async () => {
    const response = await POST(chatRequest("not json"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a cross-site or non-JSON post without calling the backend", async () => {
    const crossSite = await POST(chatRequest(JSON.stringify(TURN), { "Sec-Fetch-Site": "cross-site" }));
    const textPlain = await POST(chatRequest(JSON.stringify(TURN), { "Content-Type": "text/plain" }));

    expect(crossSite.status).toBe(403);
    expect(textPlain.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed workspace id without calling the backend", async () => {
    const response = await POST(
      chatRequest(JSON.stringify(TURN), { "X-Workspace-ID": "../../admin" }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
