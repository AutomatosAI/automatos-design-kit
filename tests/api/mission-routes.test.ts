// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as agents } from "@/app/api/agents/route";
import { POST as approve } from "@/app/api/missions/[id]/approve/route";
import { POST as cancel } from "@/app/api/missions/[id]/cancel/route";
import { GET as cost } from "@/app/api/missions/[id]/cost/route";
import { GET as events } from "@/app/api/missions/[id]/events/route";
import { PATCH as plan } from "@/app/api/missions/[id]/plan/route";
import { POST as pause } from "@/app/api/missions/[id]/pause/route";
import { POST as reject } from "@/app/api/missions/[id]/reject/route";
import { POST as replan } from "@/app/api/missions/[id]/replan/route";
import { POST as resume } from "@/app/api/missions/[id]/resume/route";
import { DELETE as deleteMission, GET as mission } from "@/app/api/missions/[id]/route";
import { GET as listMissions, POST as createMission } from "@/app/api/missions/route";
import { GET as stats } from "@/app/api/missions/stats/route";

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const MISSION_ID = "9d2b7c4e-1a3f-4b5c-8d6e-7f8091a2b3c4";
const BACKEND = "http://localhost:8000";

type Context = { params: Promise<{ id: string }> };
type MissionHandler = (request: Request, context: Context) => Promise<Response>;

const fetchMock = vi.fn<typeof fetch>();

/** As lib/client sends it: X-Workspace-ID, and a JSON Content-Type on anything but GET. */
function playRequest(path: string, init: RequestInit = {}): Request {
  const json = (init.method ?? "GET") === "GET" ? {} : { "Content-Type": "application/json" };
  return new Request(`http://localhost:3100${path}`, {
    ...init,
    headers: { "X-Workspace-ID": WORKSPACE_ID, ...json, ...(init.headers as Record<string, string>) },
  });
}

function jsonRequest(path: string, method: string, body: unknown): Request {
  return playRequest(path, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

function params(id: string = MISSION_ID): Context {
  return { params: Promise.resolve({ id }) };
}

function forwarded(index = 0): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`fetch call ${index} was not made`);
  return { url: String(call[0]), init: call[1] ?? {} };
}

function sentBody(index = 0): unknown {
  const { body } = forwarded(index).init;
  return typeof body === "string" ? JSON.parse(body) : body;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTOMATOS_BACKEND_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchMock.mockImplementation(async () => Response.json({ id: MISSION_ID, state: "running" }));
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Missions proxy routes: query allowlists", () => {
  it("keeps the list's state, limit and offset and drops anything else", async () => {
    await listMissions(playRequest(`/api/missions?state=running&workspace_id=${WORKSPACE_ID}&limit=20&offset=40&x=1`));

    expect(forwarded().url).toBe(`${BACKEND}/api/missions?state=running&limit=20&offset=40`);
  });

  it("keeps only period on stats", async () => {
    await stats(playRequest("/api/missions/stats?period=7d&workspace_id=other"));

    expect(forwarded().url).toBe(`${BACKEND}/api/missions/stats?period=7d`);
  });

  it("keeps event_type, limit and offset on events", async () => {
    await events(
      playRequest(`/api/missions/${MISSION_ID}/events?event_type=state_changed&limit=50&offset=50&order=asc`),
      params(),
    );

    expect(forwarded().url).toBe(
      `${BACKEND}/api/missions/${MISSION_ID}/events?event_type=state_changed&limit=50&offset=50`,
    );
  });

  it("forwards no query on the Mission, its cost or an action", async () => {
    await mission(playRequest(`/api/missions/${MISSION_ID}?workspace_id=other`), params());
    await cost(playRequest(`/api/missions/${MISSION_ID}/cost?workspace_id=other`), params());
    await pause(playRequest(`/api/missions/${MISSION_ID}/pause?force=1`, { method: "POST" }), params());

    expect(forwarded(0).url).toBe(`${BACKEND}/api/missions/${MISSION_ID}`);
    expect(forwarded(1).url).toBe(`${BACKEND}/api/missions/${MISSION_ID}/cost`);
    expect(forwarded(2).url).toBe(`${BACKEND}/api/missions/${MISSION_ID}/pause`);
  });

  it("sends the agents list to /api/agents/ with its allowlist only", async () => {
    fetchMock.mockImplementation(async () => Response.json([]));

    await agents(
      playRequest("/api/agents?include_workspace_system=true&limit=100&skip=0&status=active&search=re&agent_type=x&workspace_id=y"),
    );

    expect(forwarded().url).toBe(
      `${BACKEND}/api/agents/?include_workspace_system=true&limit=100&skip=0&status=active&search=re`,
    );
  });
});

describe("Missions proxy routes: methods and bodies", () => {
  it("creates a Mission with the JSON body", async () => {
    const body = { goal: "Write the launch post", config: { source: "chat", chat_id: "c1" } };

    await createMission(jsonRequest("/api/missions", "POST", body));

    expect(forwarded().url).toBe(`${BACKEND}/api/missions`);
    expect(forwarded().init.method).toBe("POST");
    expect(sentBody()).toEqual(body);
  });

  const withBodies: readonly [string, MissionHandler, string, unknown][] = [
    ["approve", approve, "POST", { note: "Keep it short" }],
    ["reject", reject, "POST", { reason: "Wrong audience" }],
    ["resume", resume, "POST", {}],
    ["replan", replan, "POST", { notes: "Use the new brief" }],
    ["plan", plan, "PATCH", { task_edits: [{ task_id: "t1", title: "Draft" }] }],
  ];

  it.each(withBodies)("forwards %s with its JSON body", async (suffix, handler, method, body) => {
    await handler(jsonRequest(`/api/missions/${MISSION_ID}/${suffix}`, method, body), params());

    expect(forwarded().url).toBe(`${BACKEND}/api/missions/${MISSION_ID}/${suffix}`);
    expect(forwarded().init.method).toBe(method);
    expect(sentBody()).toEqual(body);
  });

  const bodiless: readonly [string, MissionHandler][] = [
    ["pause", pause],
    ["cancel", cancel],
  ];

  it.each(bodiless)("forwards %s as a POST with no body", async (suffix, handler) => {
    await handler(playRequest(`/api/missions/${MISSION_ID}/${suffix}`, { method: "POST" }), params());

    expect(forwarded().url).toBe(`${BACKEND}/api/missions/${MISSION_ID}/${suffix}`);
    expect(forwarded().init.method).toBe("POST");
    expect(forwarded().init.body).toBeUndefined();
  });

  it("deletes with the backend's 204", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));

    const response = await deleteMission(playRequest(`/api/missions/${MISSION_ID}`, { method: "DELETE" }), params());

    expect(forwarded().url).toBe(`${BACKEND}/api/missions/${MISSION_ID}`);
    expect(forwarded().init.method).toBe("DELETE");
    expect(response.status).toBe(204);
  });

  it("passes a refusal through with its status", async () => {
    const detail = "Mission is in 'running' state, expected 'awaiting_approval'";
    fetchMock.mockImplementation(async () => Response.json({ detail }, { status: 400 }));

    const response = await approve(jsonRequest(`/api/missions/${MISSION_ID}/approve`, "POST", {}), params());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ detail });
  });
});

describe("Missions proxy routes: safety", () => {
  const idRoutes: readonly [string, MissionHandler, string][] = [
    ["", mission, "GET"],
    ["", deleteMission, "DELETE"],
    ["/events", events, "GET"],
    ["/cost", cost, "GET"],
    ["/pause", pause, "POST"],
    ["/cancel", cancel, "POST"],
  ];

  it.each(idRoutes)("refuses a bad id on %s (%s) without calling the backend", async (suffix, handler, method) => {
    const traversal = await handler(playRequest(`/api/missions/x${suffix}`, { method }), params("../workspaces/current"));
    const query = await handler(playRequest(`/api/missions/x${suffix}`, { method }), params("m1?state=x"));

    expect(traversal.status).toBe(400);
    expect(query.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a cross-site request and a foreign Host", async () => {
    const crossSite = await approve(
      playRequest(`/api/missions/${MISSION_ID}/approve`, {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" },
      }),
      params(),
    );
    const rebound = await listMissions(new Request("http://evil.example:3100/api/missions"));

    expect(crossSite.status).toBe(403);
    expect(rebound.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a bodyless action not typed as JSON (a cross-site form or no-cors POST)", async () => {
    const bare = (method: string) => new Request(`http://localhost:3100/api/missions/${MISSION_ID}`, { method });
    const paused = await pause(bare("POST"), params());
    const cancelled = await cancel(bare("POST"), params());
    const deleted = await deleteMission(bare("DELETE"), params());

    expect([paused.status, cancelled.status, deleted.status]).toEqual([415, 415, 415]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a body that isn't JSON", async () => {
    const form = await createMission(
      playRequest("/api/missions", {
        method: "POST",
        body: "goal=hi",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
    );
    const notAnObject = await reject(jsonRequest(`/api/missions/${MISSION_ID}/reject`, "POST", ["no"]), params());

    expect(form.status).toBe(415);
    expect(notAnObject.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("puts nosniff and the sandbox CSP on every answer", async () => {
    const answers = [
      await listMissions(playRequest("/api/missions")),
      await mission(playRequest(`/api/missions/${MISSION_ID}`), params()),
      await cancel(playRequest(`/api/missions/${MISSION_ID}/cancel`, { method: "POST" }), params()),
      await agents(playRequest("/api/agents")),
    ];

    for (const response of answers) {
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    }
  });
});
