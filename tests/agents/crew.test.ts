// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  autoMascot,
  autoWorkWords,
  AUTO_IDLE_WORDS,
  canSwitch,
  costLine,
  crewCount,
  crewOf,
  crewStatus,
  filterCrew,
  findAuto,
  lastActiveLine,
  modelRoute,
  switchTarget,
  switchWords,
} from "@/lib/agents/crew";
import { fleetById, parseFleet, type FleetAgent } from "@/lib/agents/fleet";
import { agentCategory } from "@/lib/agents/icons";
import { parseAgentList, parseAgentSummary, type AgentSummary } from "@/lib/agents/types";

// P-007, the pure parts of the Agents page: Auto by slug, the chips and search, the card's
// words, and the fleet and agent parsers.

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const NOW = new Date("2026-10-14T12:00:00Z");

function agent(id: number, name: string, extra: Partial<AgentSummary> = {}): AgentSummary {
  const parsed = parseAgentSummary({ id, name, status: "active" });
  if (!parsed) throw new Error("agent fixture");
  return { ...parsed, ...extra };
}

function live(agentId: number, extra: Partial<FleetAgent> = {}): FleetAgent {
  return {
    agentId,
    runtime: "api",
    current: null,
    queueDepth: 0,
    blockedCount: 0,
    lastActivityAt: null,
    cost24h: null,
    session: null,
    ...extra,
  };
}

const WORK = { kind: "board_task", id: "41", title: "Draft the launch post", since: null };

describe("finding Auto", () => {
  const decoy = agent(1, "Auto CTO", { isSystemAgent: true, slug: "auto-cto" });
  const other = agent(2, "Auto", { isSystemAgent: true, slug: "auto-another-workspace" });
  const impostor = agent(3, "Auto", { isSystemAgent: false, slug: `auto-${WORKSPACE_ID}` });
  const auto = agent(42, "Auto", { isSystemAgent: true, slug: `auto-${WORKSPACE_ID}` });

  it("is the system agent whose slug is auto-<workspace id>, never id 1", () => {
    expect(findAuto([decoy, other, impostor, auto], WORKSPACE_ID)?.id).toBe(42);
  });

  it("is null when the list doesn't carry him", () => {
    expect(findAuto([decoy, impostor], WORKSPACE_ID)).toBeNull();
  });

  it("leaves him out of the crew, and everyone else in", () => {
    expect(crewOf([decoy, auto, impostor], auto, WORKSPACE_ID).map((one) => one.id)).toEqual([1, 3]);
    expect(crewOf([decoy], null, WORKSPACE_ID).map((one) => one.id)).toEqual([1]);
  });

  it("leaves other workspaces' Autos out too (the super admin's list carries them)", () => {
    const elsewhere = agent(77, "Auto", { isSystemAgent: true, slug: "auto-9e6123dd-4a93-4b10-adcd-260bdcac7c04" });
    expect(crewOf([decoy, auto, elsewhere, impostor], auto, WORKSPACE_ID).map((one) => one.id)).toEqual([1, 3]);
    expect(crewOf([elsewhere], null, WORKSPACE_ID)).toEqual([]);
  });

  it("keeps the platform's own system agents such as auto-cto", () => {
    const cto = agent(5, "Auto CTO", { isSystemAgent: true, slug: "auto-cto" });
    expect(crewOf([cto, auto], auto, WORKSPACE_ID).map((one) => one.id)).toEqual([5]);
  });
});

describe("filters and search", () => {
  const crew = [
    agent(1, "Researcher Rae"),
    agent(2, "Coder", { runtime: "session" }),
    agent(3, "Writer Wren"),
  ];

  it("keeps API or Session agents by chip", () => {
    expect(filterCrew(crew, "all", "").map((one) => one.id)).toEqual([1, 2, 3]);
    expect(filterCrew(crew, "api", "").map((one) => one.id)).toEqual([1, 3]);
    expect(filterCrew(crew, "session", "").map((one) => one.id)).toEqual([2]);
  });

  it("searches by name, ignoring case and spaces around it, within the chip", () => {
    expect(filterCrew(crew, "all", "  WREN ").map((one) => one.id)).toEqual([3]);
    expect(filterCrew(crew, "session", "wren")).toEqual([]);
  });

  it("counts agents, who is working and the session agents", () => {
    const fleet = fleetById({ agents: [live(1, { current: WORK })], generatedAt: null });
    expect(crewCount(crew, fleet)).toBe("3 agents · 1 working · 1 session agent");
    expect(crewCount([crew[0] as AgentSummary], new Map())).toBe("1 agent · 0 working");
  });
});

describe("a card's words", () => {
  it("says the state in words: off, working, blocked, can't run, queued, idle", () => {
    const one = agent(1, "Rae");
    expect(crewStatus({ ...one, status: "inactive" }, live(1, { current: WORK }))).toEqual({ tone: "paused", label: "Off" });
    expect(crewStatus(one, live(1, { current: WORK }))).toEqual({ tone: "running", label: "Working" });
    expect(crewStatus(one, live(1, { blockedCount: 2 }))).toEqual({ tone: "needs-you", label: "Blocked" });
    expect(crewStatus({ ...one, unavailable: "No CLI host online" }, undefined)).toEqual({
      tone: "paused",
      label: "Can't run now",
    });
    expect(crewStatus(one, live(1, { queueDepth: 1 }))).toEqual({ tone: "queued", label: "Queued" });
    expect(crewStatus(one, undefined)).toEqual({ tone: "idle", label: "Idle" });
  });

  it("shows a session agent's tokens on your plan, never dollars", () => {
    const line = costLine("session", { tokens: 41000, usd: 1.25 });
    expect(line).toBe("41,000 tokens in 24 h · on your plan");
    expect(line).not.toContain("$");
  });

  it("shows an API agent's cost in dollars, and nothing when the fleet couldn't count it", () => {
    expect(costLine("api", { tokens: 1200, usd: 0.4234 })).toBe("$0.42 in 24 h");
    expect(costLine("api", { tokens: 10, usd: 0.0004 })).toBe("under $0.01 in 24 h");
    expect(costLine("api", null)).toBeNull();
  });

  it("reads the model route as provider · model", () => {
    expect(modelRoute({ provider: "anthropic", model: "claude-sonnet-4-5" })).toBe("Anthropic · claude-sonnet-4-5");
    expect(modelRoute({ provider: "claude_code", model: null })).toBe("Claude code");
    expect(modelRoute({ provider: null, model: null })).toBeNull();
  });

  it("says when it was last active", () => {
    expect(lastActiveLine(live(1, { lastActivityAt: "2026-10-14T11:55:00Z" }), NOW)).toBe("Last active 5 min ago");
    expect(lastActiveLine(live(1, { lastActivityAt: "2026-10-14T11:59:50Z" }), NOW)).toBe("Last active just now");
    expect(lastActiveLine(undefined, NOW)).toBeNull();
  });

  it("picks an icon from the category, then the agent type, else Custom", () => {
    expect(agentCategory({ category: "research", agentType: "custom" }).label).toBe("Research");
    expect(agentCategory({ category: "Customer Support", agentType: null }).label).toBe("Support");
    expect(agentCategory({ category: null, agentType: "data_analyst" }).label).toBe("Analytics");
    expect(agentCategory({ category: "made-up", agentType: "made-up" }).label).toBe("Custom");
  });
});

describe("the switch", () => {
  it("is never on Auto or another system agent", () => {
    expect(canSwitch(agent(42, "Auto", { isSystemAgent: true }))).toBe(false);
    expect(canSwitch(agent(7, "Rae"))).toBe(true);
  });

  it("turns an agent the other way, and says so", () => {
    const on = agent(7, "Rae");
    const off = { ...on, status: "inactive" };
    expect(switchTarget(on)).toBe("inactive");
    expect(switchTarget(off)).toBe("active");
    expect(switchWords(on).confirm).toBe("Switch off");
    expect(switchWords(off).confirm).toBe("Switch on");
    expect(switchWords(on).question).toContain("Rae");
  });
});

describe("Auto's mascot", () => {
  it("works while his fleet entry has something in hand, and idles otherwise", () => {
    expect(autoMascot(live(42, { current: WORK }))).toBe("working");
    expect(autoWorkWords(live(42, { current: WORK }))).toBe("Working on Draft the launch post");
    expect(autoMascot(live(42))).toBe("idle");
    expect(autoMascot(undefined)).toBe("idle");
    expect(autoWorkWords(undefined)).toBe(AUTO_IDLE_WORDS);
  });
});

describe("parsing", () => {
  it("reads an API agent's model from agent_model_config.model_id and a session agent's from configuration", () => {
    const [api, session] = parseAgentList([
      {
        id: 7,
        name: "Rae",
        job_title: " Analyst ",
        marketplace_category: "research",
        configuration: { runtime: "api" },
        agent_model_config: { provider: "anthropic", model_id: "claude-sonnet-4-5" },
      },
      { id: 8, name: "Coder", configuration: { runtime: "CLI", provider: "claude_code", model: "opus" } },
    ]);
    expect(api).toMatchObject({ runtime: "api", provider: "anthropic", model: "claude-sonnet-4-5", jobTitle: "Analyst" });
    expect(api?.category).toBe("research");
    expect(session).toMatchObject({ runtime: "session", provider: "claude_code", model: "opus" });
  });

  it("reads the fleet, dropping rows without an integer agent id", () => {
    const fleet = parseFleet({
      generated_at: "2026-10-14T12:00:00Z",
      agents: [
        {
          agent_id: 7,
          runtime: "cli",
          current: { kind: "board_task", id: 41, title: "Fix the nav", since: null },
          queue_depth: 2,
          blocked: { count: 1, open_asks: [] },
          last_activity_at: "2026-10-14T11:00:00Z",
          cost_24h: { tokens: 900, usd: 0.02 },
          session: { provider: "claude_code", model: "opus", live_tool: "Edit" },
        },
        { agent_id: "x" },
        { agent_id: 9 },
      ],
    });
    expect(fleet.agents.map((entry) => entry.agentId)).toEqual([7, 9]);
    expect(fleet.agents[0]).toMatchObject({
      runtime: "session",
      current: { id: "41", title: "Fix the nav" },
      queueDepth: 2,
      blockedCount: 1,
      cost24h: { tokens: 900, usd: 0.02 },
      session: { liveTool: "Edit" },
    });
    expect(fleet.agents[1]).toMatchObject({ runtime: "api", current: null, cost24h: null, session: null });
    expect(parseFleet(null).agents).toEqual([]);
  });
});
