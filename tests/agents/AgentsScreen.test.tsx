import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTO_ROLE } from "@/components/agents/AutoLeadCard";
import { AgentsScreen, FILTER_LABEL, LIST_LABEL, SEARCH_LABEL } from "@/components/agents/AgentsScreen";
import { createApiClient, type Fetch } from "@/lib/client/api";

// The Agents page (P-007): Auto found by his slug and shown first with his mascot, the
// crew grid with the session agent's cost on your plan, the switch that sends only
// {status}, the filter chips and search, and the fleet polled.

const WORKSPACE = { id: "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10", name: "Home" };
const NOW = new Date("2026-10-14T12:00:00Z");

type Row = Readonly<Record<string, unknown>>;

const AGENTS: readonly Row[] = [
  // A platform system agent at id 1: not Auto, whatever its name.
  { id: 1, name: "Auto CTO", slug: "auto-cto", status: "active", is_system_agent: true },
  {
    id: 7,
    name: "Researcher Rae",
    job_title: "Analyst",
    status: "active",
    marketplace_category: "research",
    configuration: { runtime: "api" },
    agent_model_config: { provider: "anthropic", model_id: "claude-sonnet-4-5" },
  },
  {
    id: 8,
    name: "Coder",
    status: "active",
    agent_type: "custom",
    configuration: { runtime: "cli", provider: "claude_code", model: "opus" },
  },
  {
    id: 42,
    name: "Auto",
    slug: `auto-${WORKSPACE.id}`,
    status: "active",
    is_system_agent: true,
    agent_model_config: { provider: "anthropic", model_id: "claude-opus-4-1" },
  },
];

const FLEET = {
  agents: [
    {
      agent_id: 7,
      runtime: "api",
      current: { kind: "board_task", id: 41, title: "Draft the launch post", since: null },
      queue_depth: 0,
      blocked: { count: 0, open_asks: [] },
      last_activity_at: "2026-10-14T11:55:00Z",
      cost_24h: { tokens: 1200, usd: 0.42 },
    },
    {
      agent_id: 8,
      runtime: "cli",
      current: null,
      queue_depth: 0,
      blocked: { count: 0, open_asks: [] },
      last_activity_at: null,
      cost_24h: { tokens: 41000, usd: 3.5 },
    },
  ],
};

interface MockOptions {
  readonly fleet?: () => Response;
  readonly update?: (body: unknown) => Response;
}

function mockAgentsFetch({ fleet, update }: MockOptions = {}) {
  return vi.fn<Fetch>(async (input, init) => {
    if (input === "/api/workspace") return Response.json(WORKSPACE);
    const url = new URL(input, "http://play.test");
    if (url.pathname === "/api/agents") return Response.json(AGENTS);
    if (url.pathname === "/api/fleet") return fleet ? fleet() : Response.json(FLEET);
    if (url.pathname.startsWith("/api/agents/") && init?.method === "PUT") {
      const body: unknown = JSON.parse(String(init.body));
      const id = Number(url.pathname.split("/").at(-1));
      const row = AGENTS.find((candidate) => candidate.id === id) ?? {};
      return update ? update(body) : Response.json({ ...row, ...(body as Row) });
    }
    return Response.json({ detail: "Not found" }, { status: 404 });
  });
}

function calls(fetchMock: ReturnType<typeof mockAgentsFetch>, path: string, method = "GET") {
  return fetchMock.mock.calls.filter(([input, init]) => input.startsWith(path) && (init?.method ?? "GET") === method);
}

function renderScreen(fetchMock: ReturnType<typeof mockAgentsFetch>, fleetIntervalMs?: number) {
  return render(<AgentsScreen client={createApiClient(fetchMock)} now={NOW} fleetIntervalMs={fleetIntervalMs} />);
}

async function crewList() {
  return screen.findByRole("list", { name: LIST_LABEL });
}

function card(name: string): HTMLElement {
  return screen.getByRole("article", { name });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Auto leads the crew", () => {
  it("finds Auto by his slug, not id 1, and shows him first as the lead card", async () => {
    renderScreen(mockAgentsFetch());

    const list = await crewList();
    const lead = screen.getByRole("region", { name: "Auto" });
    expect(within(lead).getByText(AUTO_ROLE)).toBeInTheDocument();
    expect(within(lead).getByText("Anthropic · claude-opus-4-1")).toBeInTheDocument();
    expect(lead.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const names = within(list).getAllByRole("heading").map((heading) => heading.textContent);
    expect(names).toEqual(["Auto CTO", "Researcher Rae", "Coder"]);
    expect(within(lead).queryByRole("switch")).not.toBeInTheDocument();
  });

  it("idles with words when the fleet has nothing for him (the core leaves him out)", async () => {
    const fetchMock = mockAgentsFetch();
    renderScreen(fetchMock);

    const lead = await screen.findByRole("region", { name: "Auto" });
    await waitFor(() => expect(calls(fetchMock, "/api/fleet").length).toBeGreaterThan(0));
    await within(card("Researcher Rae")).findByText("Working on Draft the launch post");
    expect(within(lead).getByTestId("auto-placeholder")).toHaveTextContent("idle");
    expect(within(lead).getByText("Nothing in hand. Ask me in chat.")).toBeInTheDocument();
  });

  it("works, with his work in words, while his fleet entry has something in hand", async () => {
    const withAuto = {
      agents: [
        ...FLEET.agents,
        { agent_id: 42, current: { kind: "mission_task", id: "t1", title: "Plan the week", since: null } },
      ],
    };
    renderScreen(mockAgentsFetch({ fleet: () => Response.json(withAuto) }));

    const lead = await screen.findByRole("region", { name: "Auto" });
    await waitFor(() => expect(within(lead).getByTestId("auto-placeholder")).toHaveTextContent("working"));
    expect(within(lead).getByText("Working on Plan the week")).toBeInTheDocument();
  });
});

describe("the crew grid", () => {
  it("shows each agent's role, state, model route, runtime, work and cost", async () => {
    renderScreen(mockAgentsFetch());
    await crewList();

    const rae = card("Researcher Rae");
    expect(within(rae).getByText("Research · Analyst")).toBeInTheDocument();
    expect(within(rae).getByText("Anthropic · claude-sonnet-4-5")).toBeInTheDocument();
    expect(within(rae).getByText("API")).toBeInTheDocument();
    expect(await within(rae).findByText("Working on Draft the launch post")).toBeInTheDocument();
    expect(within(rae).getByText("Working")).toBeInTheDocument();
    expect(within(rae).getByText("Last active 5 min ago · $0.42 in 24 h")).toBeInTheDocument();
  });

  it("shows a session agent's tokens on your plan, never dollars", async () => {
    renderScreen(mockAgentsFetch());
    await crewList();

    const coder = card("Coder");
    expect(within(coder).getByText("Session")).toBeInTheDocument();
    expect(within(coder).getByText("Claude code · opus")).toBeInTheDocument();
    expect(await within(coder).findByText("41,000 tokens in 24 h · on your plan")).toBeInTheDocument();
    expect(coder.textContent).not.toContain("$");
  });

  it("filters by chip and searches by name", async () => {
    const user = userEvent.setup();
    renderScreen(mockAgentsFetch());
    const list = await crewList();
    const chips = screen.getByRole("group", { name: FILTER_LABEL });

    await user.click(within(chips).getByRole("button", { name: "Session" }));
    expect(within(list).getAllByRole("article")).toHaveLength(1);
    expect(within(list).getByRole("article", { name: "Coder" })).toBeInTheDocument();

    await user.click(within(chips).getByRole("button", { name: "API" }));
    expect(within(list).queryByRole("article", { name: "Coder" })).not.toBeInTheDocument();
    expect(within(list).getByRole("article", { name: "Researcher Rae" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Auto" })).toBeInTheDocument();

    await user.click(within(chips).getByRole("button", { name: "All" }));
    await user.type(screen.getByRole("searchbox", { name: SEARCH_LABEL }), "rae");
    expect(within(list).getAllByRole("article")).toHaveLength(1);

    await user.clear(screen.getByRole("searchbox", { name: SEARCH_LABEL }));
    await user.type(screen.getByRole("searchbox", { name: SEARCH_LABEL }), "nobody");
    expect(await screen.findByText("No agents match.")).toBeInTheDocument();
  });

  it("polls the fleet while the page is open", async () => {
    const fetchMock = mockAgentsFetch();
    renderScreen(fetchMock, 20);
    await crewList();

    await waitFor(() => expect(calls(fetchMock, "/api/fleet").length).toBeGreaterThanOrEqual(3));
    expect(calls(fetchMock, "/api/agents?").length).toBe(1);
  });
});

describe("the on/off switch", () => {
  it("confirms in the page, then sends only {status}", async () => {
    const user = userEvent.setup();
    const fetchMock = mockAgentsFetch();
    renderScreen(fetchMock);
    await crewList();

    const toggle = within(card("Researcher Rae")).getByRole("switch", { name: "Researcher Rae" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);
    expect(calls(fetchMock, "/api/agents/", "PUT")).toHaveLength(0);

    const form = screen.getByRole("form", { name: "Switch off" });
    expect(within(form).getByRole("button", { name: "Keep on" })).toHaveFocus();
    await user.click(within(form).getByRole("button", { name: "Switch off" }));

    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
    const puts = calls(fetchMock, "/api/agents/", "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0]?.[0]).toBe("/api/agents/7");
    expect(JSON.parse(String(puts[0]?.[1]?.body))).toEqual({ status: "inactive" });
    expect(within(card("Researcher Rae")).getByText("Off", { selector: "span[data-tone]" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Switch off" })).not.toBeInTheDocument();
    await waitFor(() => expect(toggle).toHaveFocus());
  });

  it("sends nothing when you keep it as it is", async () => {
    const user = userEvent.setup();
    const fetchMock = mockAgentsFetch();
    renderScreen(fetchMock);
    await crewList();

    const toggle = within(card("Coder")).getByRole("switch", { name: "Coder" });
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Keep on" }));

    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(calls(fetchMock, "/api/agents/", "PUT")).toHaveLength(0);
    expect(toggle).toHaveFocus();
  });

  it("shows a refusal in words and leaves the agent as it was", async () => {
    const user = userEvent.setup();
    renderScreen(mockAgentsFetch({ update: () => Response.json({ detail: "Agent not found" }, { status: 404 }) }));
    await crewList();

    const toggle = within(card("Coder")).getByRole("switch", { name: "Coder" });
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Switch off" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Play couldn't switch that agent. Agent not found");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(screen.getByRole("button", { name: "Switch off" })).toHaveFocus());
  });

  it("is on every crew card but the system agents", async () => {
    renderScreen(mockAgentsFetch());
    const list = await crewList();

    expect(within(list).getAllByRole("switch").map((one) => one.getAttribute("aria-label"))).toEqual([
      "Researcher Rae",
      "Coder",
    ]);
  });
});
