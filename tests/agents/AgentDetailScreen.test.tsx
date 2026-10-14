import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentDetailScreen } from "@/components/agents/AgentDetailScreen";
import { LIVE_SESSION, PERFORMANCE, sessionChatNote, SKILLS, TOOLS } from "@/components/agents/AgentDetailSections";
import { createApiClient, type Fetch } from "@/lib/client/api";

// One agent's page (P-008): the session line for a session agent, "Chat with <name>"
// opening a chat that carries agentId, the performance placeholders hidden, and Auto's
// mascot only on Auto's own page.

const WORKSPACE = { id: "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10", name: "Home" };
const NOW = new Date("2026-10-14T12:00:00Z");

type Row = Readonly<Record<string, unknown>>;

const RAE: Row = {
  id: 7,
  name: "Researcher Rae",
  description: "Finds and checks sources.",
  job_title: "Analyst",
  team: "Research",
  status: "active",
  configuration: { runtime: "api" },
  agent_model_config: { provider: "anthropic", model_id: "claude-sonnet-4-5" },
  skills: [{ id: 1, name: "Web research" }, { id: 2, name: "Citations" }],
  tools: [{ name: "GMAIL", description: "Send and read mail" }],
};

const CODER: Row = {
  id: 8,
  name: "Coder",
  status: "active",
  configuration: { runtime: "cli", provider: "claude_code", model: "opus" },
};

const AUTO: Row = {
  id: 42,
  name: "Auto",
  slug: `auto-${WORKSPACE.id}`,
  status: "active",
  is_system_agent: true,
  agent_model_config: { provider: "anthropic", model_id: "claude-opus-4-1" },
};

/** The core's answer for an agent with no performance_metrics (agent_endpoints.py). */
const NO_METRICS: Row = {
  overall_score: 85,
  success_rate: 0,
  average_response_time: 0,
  total_tasks: 0,
  completed_tasks: 0,
  failed_tasks: 0,
  total_tokens_used: 1200,
  total_cost: 0.42,
  total_requests: 3,
  average_memory_usage: 0,
  average_cpu_usage: 0,
  uptime_percentage: 99.8,
};

const FLEET = {
  agents: [
    {
      agent_id: 8,
      runtime: "cli",
      current: { kind: "board_task", id: 41, title: "Fix the nav", since: null },
      queue_depth: 0,
      blocked: { count: 0, open_asks: [] },
      last_activity_at: "2026-10-14T11:59:00Z",
      session: {
        provider: "claude_code",
        model: "opus",
        live_tool: "Edit",
        last_event: "PostToolUse",
        last_event_at: "2026-10-14T11:58:00Z",
      },
    },
  ],
};

function mockAgentFetch(agent: Row, performance: Row = NO_METRICS) {
  return vi.fn<Fetch>(async (input) => {
    if (input === "/api/workspace") return Response.json(WORKSPACE);
    const path = new URL(input, "http://play.test").pathname;
    if (path === "/api/fleet") return Response.json(FLEET);
    if (path === `/api/agents/${String(agent.id)}`) return Response.json(agent);
    if (path === `/api/agents/${String(agent.id)}/performance`) return Response.json(performance);
    return Response.json({ detail: "Agent not found" }, { status: 404 });
  });
}

function renderAgent(agent: Row, performance?: Row) {
  const fetchMock = mockAgentFetch(agent, performance);
  render(<AgentDetailScreen id={Number(agent.id)} client={createApiClient(fetchMock)} now={NOW} />);
  return fetchMock;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("an agent's page", () => {
  it("shows who it is, its state, skills as chips, tools and its model route", async () => {
    renderAgent(RAE);
    expect(await screen.findByRole("heading", { level: 1, name: "Researcher Rae" })).toBeInTheDocument();
    expect(screen.getByText("Analyst · Research team")).toBeInTheDocument();
    expect(screen.getByText("Finds and checks sources.")).toBeInTheDocument();
    expect(screen.getByText("Idle")).toBeInTheDocument();
    const header = screen.getByRole("heading", { level: 1 }).closest("header") as HTMLElement;
    expect(within(header).getByText("API")).toBeInTheDocument();
    const skills = screen.getByRole("list", { name: SKILLS });
    expect(within(skills).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Web research", "Citations"]);
    expect(within(screen.getByRole("list", { name: TOOLS })).getByText("GMAIL")).toBeInTheDocument();
    const side = screen.getByRole("complementary", { name: "Details" });
    expect(within(side).getByText("Anthropic")).toBeInTheDocument();
    expect(within(side).getByText("claude-sonnet-4-5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agents" })).toHaveAttribute("href", "/agents");
  });

  it("Chat with <name> opens a new chat that carries the agent's id", async () => {
    renderAgent(RAE);
    const chat = await screen.findByRole("link", { name: "Chat with Researcher Rae" });
    expect(chat).toHaveAttribute("href", "/?agent=7");
  });

  it("hides the performance placeholders instead of showing 0", async () => {
    renderAgent(RAE);
    const section = await screen.findByRole("region", { name: PERFORMANCE });
    await within(section).findByText("Tokens");
    expect(within(section).getByText("1,200")).toBeInTheDocument();
    expect(within(section).getByText("$0.42")).toBeInTheDocument();
    expect(within(section).getByText("No tasks recorded yet.")).toBeInTheDocument();
    for (const hidden of [/success rate/i, /memory/i, /cpu/i, /uptime/i, /score/i, /average response/i, /^Done$/]) {
      expect(within(section).queryByText(hidden)).not.toBeInTheDocument();
    }
    expect(within(section).queryByText("0%")).not.toBeInTheDocument();
    expect(within(section).queryByText("85")).not.toBeInTheDocument();
  });

  it("shows the success rate and tasks once the core has counted some", async () => {
    renderAgent(RAE, { ...NO_METRICS, success_rate: 75, total_tasks: 4, completed_tasks: 3, failed_tasks: 1 });
    const section = await screen.findByRole("region", { name: PERFORMANCE });
    expect(await within(section).findByText("75%")).toBeInTheDocument();
    expect(within(section).getByText("Success rate")).toBeInTheDocument();
    expect(within(section).queryByText("No tasks recorded yet.")).not.toBeInTheDocument();
  });

  it("has no Auto on another agent's page", async () => {
    renderAgent(RAE);
    await screen.findByRole("heading", { level: 1, name: "Researcher Rae" });
    expect(screen.queryByRole("complementary", { name: "Auto" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("auto-placeholder")).not.toBeInTheDocument();
  });

  it("says the agent wasn't found when the core 404s", async () => {
    render(<AgentDetailScreen id={99} client={createApiClient(mockAgentFetch(RAE))} now={NOW} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Play couldn't load this agent.");
  });
});

describe("a session agent's page", () => {
  it("shows the live session line from the fleet", async () => {
    renderAgent(CODER);
    const session = await screen.findByRole("region", { name: LIVE_SESSION });
    expect(
      await within(session).findByText("Claude code · opus · Using Edit · Last event: used a tool, 2 min ago"),
    ).toBeInTheDocument();
    expect(screen.getByText("Working on Fix the nav")).toBeInTheDocument();
    expect(screen.getByText("Working")).toBeInTheDocument();
  });

  it("offers no chat, since the core answers chat to a session agent with an error", async () => {
    renderAgent(CODER);
    await screen.findByRole("heading", { level: 1, name: "Coder" });
    expect(screen.queryByRole("link", { name: /^Chat with/ })).not.toBeInTheDocument();
    expect(screen.getByText(sessionChatNote("Coder"))).toBeInTheDocument();
    const performance = screen.getByRole("region", { name: PERFORMANCE });
    expect(await within(performance).findByText("On your plan")).toBeInTheDocument();
    expect(within(performance).queryByText("$0.42")).not.toBeInTheDocument();
  });
});

describe("Auto's own page", () => {
  it("has Auto in the mascot column, and Chat with Auto opens the ordinary chat", async () => {
    renderAgent(AUTO);
    await screen.findByRole("heading", { level: 1, name: "Auto" });
    const column = screen.getByRole("complementary", { name: "Auto" });
    expect(within(column).getByTestId("auto-placeholder")).toHaveTextContent(/idle/i);
    expect(screen.getByRole("link", { name: "Chat with Auto" })).toHaveAttribute("href", "/");
  });
});
