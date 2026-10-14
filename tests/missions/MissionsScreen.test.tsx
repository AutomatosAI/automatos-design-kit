import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOAD_MORE } from "@/components/page/GridPage";
import { CLOSE, COMPOSER_TITLE, GOAL_LABEL, START } from "@/components/missions/MissionComposer";
import { FILTER_LABEL, LIST_LABEL, MissionsScreen } from "@/components/missions/MissionsScreen";
import { STATS_TITLE } from "@/components/missions/MissionStatsStrip";
import { createApiClient, type Fetch } from "@/lib/client/api";

// The Missions list (P-004): chips set the state filter, cards show their state and
// progress, Load more pages by offset, and the composer validates and opens the new Mission.

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/missions",
}));

const WORKSPACE = { id: "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10", name: "Home" };
const NOW = new Date("2026-10-14T12:00:00Z");
const STATS = { total_missions: 12, success_rate: 0.75, avg_duration_minutes: 45, period: "30d" };

type Row = Readonly<Record<string, unknown>>;

function row(id: string, state: string, extra: Row = {}): Row {
  return { id, goal: `Goal ${id}`, state, tokens_used: 0, created_at: "2026-10-14T10:00:00Z", ...extra };
}

/** Rows by state; the list answers like the backend: one state filter, limit and offset. */
function mockMissionsFetch(rows: readonly Row[], create?: () => Response) {
  return vi.fn<Fetch>(async (input, init) => {
    if (input === "/api/workspace") return Response.json(WORKSPACE);
    const url = new URL(input, "http://play.test");
    if (url.pathname === "/api/missions/stats") return Response.json(STATS);
    if (url.pathname === "/api/missions" && init?.method === "POST") {
      return create ? create() : Response.json(row("m-new", "pending"));
    }
    if (url.pathname === "/api/missions") {
      const state = url.searchParams.get("state");
      const offset = Number(url.searchParams.get("offset") ?? "0");
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const matching = rows.filter((candidate) => !state || candidate.state === state);
      return Response.json({ missions: matching.slice(offset, offset + limit), total: matching.length, limit, offset });
    }
    return Response.json({ detail: "Not found" }, { status: 404 });
  });
}

function listCalls(fetchMock: ReturnType<typeof mockMissionsFetch>): readonly string[] {
  return fetchMock.mock.calls
    .filter(([input, init]) => input.startsWith("/api/missions?") && (init?.method ?? "GET") === "GET")
    .map(([input]) => input);
}

function renderScreen(fetchMock: ReturnType<typeof mockMissionsFetch>, intervalMs?: number) {
  return render(<MissionsScreen client={createApiClient(fetchMock)} now={NOW} intervalMs={intervalMs} />);
}

beforeEach(() => {
  push.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the Missions list", () => {
  it("shows a card per Mission with its state, progress, age and tokens, and no Auto", async () => {
    const progress = { total: 4, done: 1, active: 1, verified: 1, failed: 0, skipped: 0, all_terminal: false };
    const fetchMock = mockMissionsFetch([
      row("m1", "running", { goal: "Plan the launch", tokens_used: 1200, task_progress: progress }),
      row("m2", "awaiting_approval", { created_at: "2026-10-13T09:00:00Z" }),
    ]);
    renderScreen(fetchMock);

    const card = await screen.findByRole("link", { name: /Plan the launch/ });
    expect(card).toHaveAttribute("href", "/missions/m1");
    expect(within(card).getByText("Running")).toBeInTheDocument();
    const bar = within(card).getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(bar).toHaveAttribute("aria-valuetext", "1 of 4 steps done");
    expect(within(card).getByText("2 h ago · 1,200 tokens")).toBeInTheDocument();

    const waiting = screen.getByRole("link", { name: /Goal m2/ });
    expect(within(waiting).getByText("Needs approval")).toBeInTheDocument();
    expect(within(waiting).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("2 Missions")).toBeInTheDocument();
    expect(document.querySelector("[data-glow]")).toBeNull();
  });

  it("shows the last 30 days over the list", async () => {
    renderScreen(mockMissionsFetch([]));
    const strip = await screen.findByRole("region", { name: STATS_TITLE });
    await within(strip).findByText("75%");
    expect(within(strip).getByText("Missions")).toBeInTheDocument();
    expect(within(strip).getByText("12")).toBeInTheDocument();
    expect(within(strip).getByText("45 min")).toBeInTheDocument();
  });

  it("sets the state filter from the chips, one call per state", async () => {
    const fetchMock = mockMissionsFetch([
      row("m1", "running"),
      row("m2", "awaiting_approval"),
      row("m3", "awaiting_human"),
      row("m4", "completed"),
    ]);
    const user = userEvent.setup();
    renderScreen(fetchMock);
    await screen.findByRole("link", { name: /Goal m1/ });
    expect(listCalls(fetchMock)).toEqual(["/api/missions?limit=20&offset=0"]);

    const chips = screen.getByRole("group", { name: FILTER_LABEL });
    await user.click(within(chips).getByRole("button", { name: "Needs you" }));
    expect(within(chips).getByRole("button", { name: "Needs you" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.queryByRole("link", { name: /Goal m1/ })).not.toBeInTheDocument());
    expect(await screen.findByRole("link", { name: /Goal m2/ })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Goal m3/ })).toBeInTheDocument();
    expect(listCalls(fetchMock)).toEqual(
      expect.arrayContaining([
        "/api/missions?state=awaiting_approval&limit=20&offset=0",
        "/api/missions?state=awaiting_human&limit=20&offset=0",
      ]),
    );

    await user.click(within(chips).getByRole("button", { name: "Done" }));
    await screen.findByRole("link", { name: /Goal m4/ });
    expect(listCalls(fetchMock)).toContain("/api/missions?state=completed&limit=20&offset=0");
    expect(screen.queryByRole("link", { name: /Goal m2/ })).not.toBeInTheDocument();

    await user.click(within(chips).getByRole("button", { name: "Failed" }));
    expect(await screen.findByText("No failed Missions.")).toBeInTheDocument();
  });

  it("loads more by offset", async () => {
    const rows = Array.from({ length: 23 }, (_, index) =>
      row(`m${index}`, "completed", { created_at: new Date(Date.UTC(2026, 9, 14, 0, 59 - index)).toISOString() }),
    );
    const fetchMock = mockMissionsFetch(rows);
    const user = userEvent.setup();
    renderScreen(fetchMock);

    const list = await screen.findByRole("list", { name: LIST_LABEL });
    expect(within(list).getAllByRole("link")).toHaveLength(20);
    await user.click(screen.getByRole("button", { name: LOAD_MORE }));

    await waitFor(() => expect(within(list).getAllByRole("link")).toHaveLength(23));
    expect(listCalls(fetchMock)).toContain("/api/missions?limit=20&offset=20");
    expect(screen.queryByRole("button", { name: LOAD_MORE })).not.toBeInTheDocument();
  });

  it("polls the list while the page is open", async () => {
    const fetchMock = mockMissionsFetch([row("m1", "running")]);
    renderScreen(fetchMock, 20);
    await screen.findByRole("link", { name: /Goal m1/ });
    await waitFor(() => expect(listCalls(fetchMock).length).toBeGreaterThanOrEqual(3));
  });

  it("says when the list can't load, with Try again", async () => {
    const fetchMock = vi.fn<Fetch>(async (input) => {
      if (input === "/api/workspace") return Response.json(WORKSPACE);
      if (input.startsWith("/api/missions/stats")) return Response.json(STATS);
      return Response.json({ detail: "boom" }, { status: 500 });
    });
    render(<MissionsScreen client={createApiClient(fetchMock)} now={NOW} />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Play couldn't load your Missions.");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("the New Mission composer", () => {
  it("validates the goal's length and opens the new Mission after Start", async () => {
    const fetchMock = mockMissionsFetch([]);
    const user = userEvent.setup();
    renderScreen(fetchMock);

    await user.click(await screen.findByRole("button", { name: COMPOSER_TITLE }));
    const form = screen.getByRole("form", { name: COMPOSER_TITLE });
    const goal = within(form).getByRole("textbox", { name: GOAL_LABEL });
    const start = within(form).getByRole("button", { name: START });
    expect(goal).toHaveFocus();
    expect(start).toBeDisabled();
    expect(within(form).getByText("0 / 10,000")).toBeInTheDocument();

    fireEvent.change(goal, { target: { value: "x".repeat(10_001) } });
    expect(start).toBeDisabled();
    expect(goal).toHaveAttribute("aria-invalid", "true");
    expect(within(form).getByText("10,001 / 10,000")).toBeInTheDocument();
    expect(within(form).getByText(/That's 1 character over the limit/)).toBeInTheDocument();

    fireEvent.change(goal, { target: { value: "  Plan the launch  " } });
    expect(start).toBeEnabled();
    await user.click(start);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/missions/m-new"));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toBe("/api/missions");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ goal: "Plan the launch" });
  });

  it("says when the Mission couldn't start, and stays open", async () => {
    const fetchMock = mockMissionsFetch([], () => Response.json({ detail: "Planner is down" }, { status: 500 }));
    const user = userEvent.setup();
    renderScreen(fetchMock);

    await user.click(await screen.findByRole("button", { name: COMPOSER_TITLE }));
    const form = screen.getByRole("form", { name: COMPOSER_TITLE });
    await user.type(within(form).getByRole("textbox", { name: GOAL_LABEL }), "Plan the launch");
    await user.click(within(form).getByRole("button", { name: START }));

    expect(await within(form).findByRole("alert")).toHaveTextContent("Play couldn't start the Mission.");
    expect(within(form).getByRole("button", { name: START })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("closes and puts focus back on New Mission", async () => {
    const user = userEvent.setup();
    renderScreen(mockMissionsFetch([]));

    await user.click(await screen.findByRole("button", { name: COMPOSER_TITLE }));
    await user.click(screen.getByRole("button", { name: CLOSE }));

    expect(screen.queryByRole("form", { name: COMPOSER_TITLE })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: COMPOSER_TITLE })).toHaveFocus());
  });
});
