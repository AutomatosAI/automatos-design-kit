// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, type Fetch } from "@/lib/client/api";

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const MISSION_ID = "9d2b7c4e-1a3f-4b5c-8d6e-7f8091a2b3c4";

/** Answers /api/workspace, then every other call with `answer`; records the calls. */
function mockFetch(answer: () => Response) {
  return vi.fn<Fetch>(async (input) =>
    input === "/api/workspace" ? Response.json({ id: WORKSPACE_ID, name: "Home" }) : answer(),
  );
}

function lastCall(fetchMock: ReturnType<typeof mockFetch>): { path: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("no call");
  return { path: call[0], init: call[1] ?? {} };
}

function bodyOf(init: RequestInit): unknown {
  return typeof init.body === "string" ? JSON.parse(init.body) : undefined;
}

const missionOk = (): Response => Response.json({ id: MISSION_ID, goal: "Write it", state: "awaiting_approval" });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mission reads", () => {
  it("lists with only the filters given", async () => {
    const fetchMock = mockFetch(() => Response.json({ missions: [], total: 0, limit: 20, offset: 0 }));
    const client = createApiClient(fetchMock);

    await client.listMissions();
    expect(lastCall(fetchMock).path).toBe("/api/missions");

    await client.listMissions({ state: "running", limit: 20, offset: 40 });
    expect(lastCall(fetchMock).path).toBe("/api/missions?state=running&limit=20&offset=40");
    expect(new Headers(lastCall(fetchMock).init.headers).get("X-Workspace-ID")).toBe(WORKSPACE_ID);
  });

  it("asks for stats, events and cost on their routes", async () => {
    const fetchMock = mockFetch(() => Response.json({}));
    const client = createApiClient(fetchMock);

    await client.missionStats("7d");
    expect(lastCall(fetchMock).path).toBe("/api/missions/stats?period=7d");
    await client.missionEvents(MISSION_ID, { eventType: "state_changed", offset: 50 });
    expect(lastCall(fetchMock).path).toBe(`/api/missions/${MISSION_ID}/events?event_type=state_changed&offset=50`);
    await client.missionCost(MISSION_ID);
    expect(lastCall(fetchMock).path).toBe(`/api/missions/${MISSION_ID}/cost`);
  });

  it("reads one Mission, and refuses an answer it can't read", async () => {
    const ok = createApiClient(mockFetch(() => Response.json({ id: MISSION_ID, state: "running", tasks: [] })));
    expect((await ok.getMission(MISSION_ID)).state).toBe("running");

    const broken = createApiClient(mockFetch(() => Response.json({ state: "running" })));
    await expect(broken.getMission(MISSION_ID)).rejects.toBeInstanceOf(ApiError);
  });

  it("lists agents with Auto included", async () => {
    const fetchMock = mockFetch(() => Response.json([{ id: 1, name: "Auto", is_system_agent: true }]));

    const agents = await createApiClient(fetchMock).listAgents();

    expect(lastCall(fetchMock).path).toBe("/api/agents?include_workspace_system=true&limit=100");
    expect(agents).toEqual([{ id: 1, name: "Auto", slug: null, status: null, isSystemAgent: true }]);
  });
});

describe("mission writes", () => {
  it("creates a Mission with the backend's field names", async () => {
    const fetchMock = mockFetch(missionOk);

    const mission = await createApiClient(fetchMock).createMission({
      goal: "Write it",
      config: { source: "chat", chat_id: "c1" },
    });

    expect(mission.id).toBe(MISSION_ID);
    expect(lastCall(fetchMock).path).toBe("/api/missions");
    expect(lastCall(fetchMock).init.method).toBe("POST");
    expect(bodyOf(lastCall(fetchMock).init)).toEqual({ goal: "Write it", config: { source: "chat", chat_id: "c1" } });
  });

  it("sends each action to its route with the right method and body", async () => {
    const fetchMock = mockFetch(missionOk);
    const client = createApiClient(fetchMock);
    const cases: readonly [() => Promise<void>, string, string, unknown][] = [
      [() => client.approveMission(MISSION_ID), "/approve", "POST", {}],
      [() => client.approveMission(MISSION_ID, "Keep it short"), "/approve", "POST", { note: "Keep it short" }],
      [() => client.rejectMission(MISSION_ID, "Wrong audience"), "/reject", "POST", { reason: "Wrong audience" }],
      [() => client.pauseMission(MISSION_ID), "/pause", "POST", undefined],
      [() => client.resumeMission(MISSION_ID), "/resume", "POST", {}],
      [() => client.cancelMission(MISSION_ID), "/cancel", "POST", undefined],
      [() => client.replanMission(MISSION_ID, "Use the brief"), "/replan", "POST", { notes: "Use the brief" }],
      [
        () => client.editMissionPlan(MISSION_ID, [{ taskId: "t1", agentId: 4 }]),
        "/plan",
        "PATCH",
        { task_edits: [{ task_id: "t1", agent_id: 4 }] },
      ],
    ];

    for (const [act, suffix, method, body] of cases) {
      await act();
      const { path, init } = lastCall(fetchMock);
      expect({ path, method: init.method, body: bodyOf(init) }).toEqual({
        path: `/api/missions/${MISSION_ID}${suffix}`,
        method,
        body,
      });
      expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    }
  });

  it("never sends modifications with an approval", async () => {
    const fetchMock = mockFetch(missionOk);

    await createApiClient(fetchMock).approveMission(MISSION_ID, "ok");

    expect(bodyOf(lastCall(fetchMock).init)).not.toHaveProperty("modifications");
  });

  it("deletes with DELETE and accepts the empty 204", async () => {
    const fetchMock = mockFetch(() => new Response(null, { status: 204 }));

    await expect(createApiClient(fetchMock).deleteMission(MISSION_ID)).resolves.toBeUndefined();
    expect(lastCall(fetchMock)).toMatchObject({ path: `/api/missions/${MISSION_ID}`, init: { method: "DELETE" } });
  });
});

describe("refused moves", () => {
  it("turns a 409 into a sentence naming the state", async () => {
    const client = createApiClient(
      mockFetch(() => Response.json({ detail: "Invalid run transition: running → running (entity x)" }, { status: 409 })),
    );

    const error = await client.approveMission(MISSION_ID).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: "This Mission is already running, so it can't be approved." });
  });

  it("does the same for the core's 400 state check", async () => {
    const client = createApiClient(
      mockFetch(() =>
        Response.json({ detail: "Cannot delete mission in state 'running'. Cancel it first." }, { status: 400 }),
      ),
    );

    await expect(client.deleteMission(MISSION_ID)).rejects.toMatchObject({
      status: 400,
      message: "This Mission is already running, so it can't be deleted.",
    });
  });

  it("keeps the backend's words for anything else", async () => {
    const detail = "Mission has been replanned 3 times, maximum is 3";
    const client = createApiClient(mockFetch(() => Response.json({ detail }, { status: 400 })));

    await expect(client.replanMission(MISSION_ID)).rejects.toMatchObject({ status: 400, message: detail });
  });
});
