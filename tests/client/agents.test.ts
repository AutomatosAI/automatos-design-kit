// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, type Fetch } from "@/lib/client/api";

// P-007: the agent calls go to Play's own routes, and the switch sends {status} only.

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";

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

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("agent calls", () => {
  it("reads one agent and the fleet through Play's routes", async () => {
    const one = mockFetch(() => Response.json({ id: 7, name: "Rae", status: "active" }));
    expect((await createApiClient(one).getAgent(7)).name).toBe("Rae");
    expect(lastCall(one).path).toBe("/api/agents/7");

    const fleet = mockFetch(() => Response.json({ agents: [{ agent_id: 7, current: null }] }));
    expect((await createApiClient(fleet).getFleet()).agents.map((entry) => entry.agentId)).toEqual([7]);
    expect(lastCall(fleet).path).toBe("/api/fleet");
  });

  it("switches an agent with PUT {status} and a JSON Content-Type", async () => {
    const fetchMock = mockFetch(() => Response.json({ id: 7, name: "Rae", status: "inactive" }));

    const updated = await createApiClient(fetchMock).setAgentStatus(7, "inactive");

    expect(updated.status).toBe("inactive");
    const { path, init } = lastCall(fetchMock);
    expect(path).toBe("/api/agents/7");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ status: "inactive" });
    expect(init.headers).toMatchObject({ "Content-Type": "application/json", "X-Workspace-ID": WORKSPACE_ID });
  });

  it("refuses an agent answer it can't read", async () => {
    const broken = mockFetch(() => Response.json({ name: "No id" }));
    await expect(createApiClient(broken).getAgent(7)).rejects.toBeInstanceOf(ApiError);
  });
});
