// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as performance } from "@/app/api/agents/[id]/performance/route";
import { GET as agent, PUT as updateAgent } from "@/app/api/agents/[id]/route";
import { GET as fleet } from "@/app/api/fleet/route";

// P-007: the agent and fleet proxy routes. Ids are whole numbers; PUT carries {status}
// ("active" | "inactive") and nothing else, refused here before the backend sees it.

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

function putRequest(id: string, body: unknown): Request {
  return playRequest(`/api/agents/${id}`, { method: "PUT", body: JSON.stringify(body) });
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
  fetchMock.mockImplementation(async () => Response.json({ id: 7, name: "Researcher", status: "active" }));
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("agent routes: reads", () => {
  it("forwards one agent with no query", async () => {
    await agent(playRequest("/api/agents/7?workspace_id=other"), params("7"));

    expect(forwarded().url).toBe(`${BACKEND}/api/agents/7`);
    expect(forwarded().init.method).toBe("GET");
  });

  it("keeps only period on performance", async () => {
    await performance(playRequest("/api/agents/7/performance?period=7d&workspace_id=other"), params("7"));

    expect(forwarded().url).toBe(`${BACKEND}/api/agents/7/performance?period=7d`);
  });

  it.each(["abc", "1.5", "0", "-3", "7;drop", "12345678901234"])("refuses the id %s before any call", async (id) => {
    const response = await agent(playRequest(`/api/agents/${encodeURIComponent(id)}`), params(id));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the backend's fleet for live status, with no query", async () => {
    fetchMock.mockImplementation(async () => Response.json({ agents: [] }));

    const response = await fleet(playRequest("/api/fleet?workspace_id=other"));

    expect(response.status).toBe(200);
    expect(forwarded().url).toBe(`${BACKEND}/api/v1/fleet`);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("agent routes: the switch", () => {
  it.each(["active", "inactive"])("forwards {status: %s} as PUT and nothing else", async (status) => {
    const response = await updateAgent(putRequest("7", { status }), params("7"));

    expect(response.status).toBe(200);
    expect(forwarded().url).toBe(`${BACKEND}/api/agents/7`);
    expect(forwarded().init.method).toBe("PUT");
    expect(JSON.parse(String(forwarded().init.body))).toEqual({ status });
  });

  const refused: readonly [string, unknown][] = [
    ["another field beside status", { status: "inactive", name: "Renamed" }],
    ["a field without status", { configuration: { runtime: "cli" } }],
    ["a status Play doesn't set", { status: "training" }],
    ["a status that isn't a string", { status: true }],
    ["an empty object", {}],
    ["a list", [{ status: "inactive" }]],
  ];

  it.each(refused)("refuses %s with 400 and no call", async (_what, body) => {
    const response = await updateAgent(putRequest("7", body), params("7"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says what it accepts when it refuses", async () => {
    const response = await updateAgent(putRequest("7", { status: "inactive", tools: [] }), params("7"));

    expect(await response.json()).toEqual({ error: expect.stringContaining("on or off") });
  });

  it("refuses a PUT not sent as JSON (415) and one from another site (403)", async () => {
    const plain = playRequest("/api/agents/7", {
      method: "PUT",
      body: JSON.stringify({ status: "inactive" }),
      headers: { "Content-Type": "text/plain" },
    });
    const crossSite = playRequest("/api/agents/7", {
      method: "PUT",
      body: JSON.stringify({ status: "inactive" }),
      headers: { "Sec-Fetch-Site": "cross-site" },
    });

    expect((await updateAgent(plain, params("7"))).status).toBe(415);
    expect((await updateAgent(crossSite, params("7"))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the backend's refusal back unchanged", async () => {
    fetchMock.mockImplementation(async () => Response.json({ detail: "Agent not found" }, { status: 404 }));

    const response = await updateAgent(putRequest("9", { status: "inactive" }), params("9"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: "Agent not found" });
  });
});
