import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NO_STEPS, STEPS_LABEL } from "@/components/missions/MissionSteps";
import { ACTIVITY_LABEL, SHOW_OLDER } from "@/components/missions/MissionActivity";
import { MissionRunScreen } from "@/components/missions/MissionRunScreen";
import { DELIVERABLES_LABEL, SIDE_LABEL } from "@/components/missions/MissionSidePanel";
import { PLAN_LABEL } from "@/components/missions/PlanReview";
import { createApiClient } from "@/lib/client/api";
import { AWAITING_HUMAN_NOTE, REASON_LABEL } from "@/lib/missions/run";

import awaitingApproval from "./fixtures/awaiting-approval.json";
import completed from "./fixtures/completed.json";
import failed from "./fixtures/failed.json";
import planning from "./fixtures/planning.json";
import running from "./fixtures/running.json";
import { bodyOf, calls, deliverableRow, detailCalls, event, type Json, mockRunFetch, type RunFetchOptions } from "./run-helpers";

// The Mission run page (P-005), one JSON fixture per state group: the right actions show,
// the plan review edits and approves, a failed step shows why, polling stops once the
// Mission has ended, and Auto follows the Mission.

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/missions/m-run",
}));

const NOW = new Date("2026-10-14T12:00:00Z");
const ALL_ACTIONS = ["Approve plan", "Reject…", "Pause", "Resume", "Cancel Mission", "Replan", "Delete"];

function renderRun(details: readonly Json[], options: RunFetchOptions = {}, intervalMs = 60_000) {
  const fetchMock = mockRunFetch(details, options);
  const id = String(details[0]?.id);
  render(<MissionRunScreen id={id} client={createApiClient(fetchMock)} intervalMs={intervalMs} now={NOW} />);
  return fetchMock;
}

/** The header's buttons, by name, in order. */
function headerButtons(): readonly string[] {
  const header = screen.getByRole("heading", { level: 1 }).closest("header");
  return within(header as HTMLElement)
    .queryAllByRole("button")
    .map((button) => button.textContent ?? "");
}

function autoState(): string {
  return screen.getByTestId("auto-placeholder").textContent ?? "";
}

beforeEach(() => {
  push.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the Mission run page: actions by state", () => {
  it.each([
    ["planning", planning, "Planning", ["Cancel Mission"], "thinking"],
    ["awaiting_approval", awaitingApproval, "Needs approval", ["Approve plan", "Reject…", "Cancel Mission"], "listening"],
    ["running", running, "Running", ["Pause", "Cancel Mission"], "working"],
    ["paused", { ...running, state: "paused" }, "Paused", ["Resume", "Cancel Mission"], "idle"],
    ["awaiting_human", { ...running, state: "awaiting_human" }, "Waiting for a person", ["Cancel Mission"], "listening"],
    ["failed", failed, "Failed", ["Replan", "Resume", "Delete"], "oops"],
    ["completed", completed, "Done", ["Delete"], "celebrate"],
    ["cancelled", { ...running, state: "cancelled" }, "Cancelled", ["Delete"], "idle"],
  ])("%s: the chip, only the allowed actions, and Auto", async (_state, detail, chip, actions, auto) => {
    renderRun([detail]);
    const title = await screen.findByRole("heading", { level: 1, name: "Write a launch plan for the spring range" });
    expect(within(title.closest("header") as HTMLElement).getByText(chip)).toBeInTheDocument();
    expect(headerButtons()).toEqual(actions);
    for (const other of ALL_ACTIONS.filter((name) => !actions.includes(name))) {
      expect(screen.queryByRole("button", { name: other })).toBeNull();
    }
    expect(autoState()).toBe(auto);
  });

  it("says plainly that a Mission waiting for a person can only be cancelled", async () => {
    renderRun([{ ...running, state: "awaiting_human" }]);
    expect(await screen.findByText(AWAITING_HUMAN_NOTE)).toBeInTheDocument();
  });

  it("shows no steps yet while Auto plans, and the activity newest first", async () => {
    renderRun([planning]);
    expect(await screen.findByText(NO_STEPS)).toBeInTheDocument();
    const feed = screen.getByRole("list", { name: ACTIVITY_LABEL });
    const lines = within(feed).getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(lines[0]).toContain("Planning started (Pending → Planning)");
    expect(lines[1]).toContain("Mission created");
  });
});

describe("the plan review", () => {
  it("lists the steps in sequence with their agents' names", async () => {
    renderRun([awaitingApproval]);
    const plan = await screen.findByRole("list", { name: PLAN_LABEL });
    expect(within(plan).getByRole("textbox", { name: "Step 1 title" })).toHaveValue("Research the market");
    expect(within(plan).getByRole("textbox", { name: "Step 2 title" })).toHaveValue("Draft the plan");
    const agent = await within(plan).findByRole("combobox", { name: "Step 1 agent" });
    await waitFor(() => expect(within(agent).getByRole("option", { name: "Researcher Rae" })).toBeInTheDocument());
    expect(agent).toHaveValue("7");
    expect(within(plan).getByRole("combobox", { name: "Step 2 agent" })).toHaveValue("9");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("sends the edits, then approves", async () => {
    const user = userEvent.setup();
    const fetchMock = renderRun([awaitingApproval, { ...awaitingApproval, state: "running" }]);
    const plan = await screen.findByRole("list", { name: PLAN_LABEL });
    const title = within(plan).getByRole("textbox", { name: "Step 2 title" });
    await user.clear(title);
    await user.type(title, "Draft the one-page plan");
    await waitFor(() => expect(within(plan).getAllByRole("option", { name: "Writer Wren" }).length).toBeGreaterThan(0));
    await user.selectOptions(within(plan).getByRole("combobox", { name: "Step 1 agent" }), "9");
    await user.click(screen.getByRole("button", { name: "Approve plan" }));

    await waitFor(() => expect(calls(fetchMock)).toContain("POST /api/missions/m-review/approve"));
    const sent = calls(fetchMock);
    expect(sent.indexOf("PATCH /api/missions/m-review/plan")).toBeLessThan(sent.indexOf("POST /api/missions/m-review/approve"));
    expect(bodyOf(fetchMock, "PATCH /api/missions/m-review/plan")).toEqual({
      task_edits: [
        { task_id: "t2", title: "Draft the one-page plan" },
        { task_id: "t1", agent_id: 9 },
      ],
    });
    expect(await screen.findByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("refuses a blank title and saves nothing", async () => {
    const user = userEvent.setup();
    const fetchMock = renderRun([awaitingApproval]);
    const title = await screen.findByRole("textbox", { name: "Step 1 title" });
    await user.clear(title);
    expect(await screen.findByRole("alert")).toHaveTextContent("Every step needs a title.");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(calls(fetchMock).some((call) => call.startsWith("PATCH"))).toBe(false);
  });

  it("won't approve while a step has no title", async () => {
    const user = userEvent.setup();
    const fetchMock = renderRun([awaitingApproval]);
    await user.clear(await screen.findByRole("textbox", { name: "Step 1 title" }));
    await user.click(screen.getByRole("button", { name: "Approve plan" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Every step needs a title.");
    expect(calls(fetchMock).some((call) => call.startsWith("PATCH") || call.endsWith("/approve"))).toBe(false);
  });

  it("asks for a reason before it rejects", async () => {
    const user = userEvent.setup();
    const fetchMock = renderRun([awaitingApproval]);
    await user.click(await screen.findByRole("button", { name: "Reject…" }));
    const form = screen.getByRole("form", { name: "Reject plan" });
    const reason = within(form).getByRole("textbox", { name: REASON_LABEL });
    expect(reason).toHaveFocus();
    await user.click(within(form).getByRole("button", { name: "Reject plan" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Say why you are rejecting the plan.");
    expect(calls(fetchMock)).not.toContain("POST /api/missions/m-review/reject");

    await user.type(reason, "Too many channels");
    await user.click(within(form).getByRole("button", { name: "Reject plan" }));
    await waitFor(() => expect(bodyOf(fetchMock, "POST /api/missions/m-review/reject")).toEqual({ reason: "Too many channels" }));
  });

  it("shows a refused approval in words and refreshes the Mission", async () => {
    const user = userEvent.setup();
    const detail = "Mission is in 'running' state, expected 'awaiting_approval'";
    const fetchMock = renderRun([awaitingApproval, { ...awaitingApproval, state: "running" }], {
      routes: { "POST /api/missions/m-review/approve": () => Response.json({ detail }, { status: 400 }) },
    });
    await user.click(await screen.findByRole("button", { name: "Approve plan" }));
    expect(await screen.findByText("This Mission is already running, so it can't be approved.")).toBeInTheDocument();
    await waitFor(() => expect(detailCalls(fetchMock, "m-review")).toBe(2));
    expect(await screen.findByRole("button", { name: "Pause" })).toBeInTheDocument();
  });
});

describe("a running Mission", () => {
  it("shows each step's state, agent, tokens and output as text, with progress", async () => {
    renderRun([running]);
    const steps = await screen.findByRole("list", { name: STEPS_LABEL });
    const [first, second, third] = within(steps).getAllByRole("listitem");
    expect(within(first as HTMLElement).getByText("Done")).toBeInTheDocument();
    expect(within(second as HTMLElement).getByText("Running")).toBeInTheDocument();
    expect(within(third as HTMLElement).getByText("Waiting")).toBeInTheDocument();
    await waitFor(() => expect(first).toHaveTextContent("Researcher Rae · 3,200 tokens"));
    expect(third).toHaveTextContent("analyst");
    // The excerpt is the model's text: shown as written, never rendered.
    expect(within(first as HTMLElement).getByText(/<b>Prices<\/b> run 10% higher/)).toBeInTheDocument();
    expect((first as HTMLElement).querySelector("b")).toBeNull();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "33");
    expect(bar).toHaveAttribute("aria-valuetext", "1 of 3 steps done");
  });

  it("shows the cost, the times and the Mission's Deliverables in the side panel", async () => {
    const fetchMock = renderRun([running], { deliverables: [deliverableRow("d1", "m-run")] });
    const side = await screen.findByRole("complementary", { name: SIDE_LABEL });
    expect(await within(side).findByText("5,400 tokens")).toBeInTheDocument();
    expect(within(side).getByText(/about \$0\.0162/)).toBeInTheDocument();
    expect(within(side).getByText("Not yet")).toBeInTheDocument();
    const shelf = await within(side).findByRole("list", { name: DELIVERABLES_LABEL });
    expect(within(shelf).getByRole("link", { name: /Spring launch plan/ })).toHaveAttribute("href", "/deliverables/d1");
    const list = calls(fetchMock).find((call) => call.startsWith("GET /api/deliverables?")) ?? "";
    const params = new URL(list.slice("GET ".length), "http://play.test").searchParams;
    expect(params.get("source_type")).toBe("mission");
    expect(params.get("source_id")).toBe("m-run");
  });

  it("confirms Cancel in the page, keeps the Mission on Keep, and cancels on confirm", async () => {
    const user = userEvent.setup();
    const fetchMock = renderRun([running, { ...running, state: "cancelled" }]);
    const cancel = await screen.findByRole("button", { name: "Cancel Mission" });
    await user.click(cancel);
    const form = screen.getByRole("form", { name: "Cancel Mission" });
    expect(within(form).getByRole("button", { name: "Keep it going" })).toHaveFocus();
    await user.click(within(form).getByRole("button", { name: "Keep it going" }));
    expect(screen.queryByRole("form", { name: "Cancel Mission" })).toBeNull();
    expect(cancel).toHaveFocus();
    expect(calls(fetchMock)).not.toContain("POST /api/missions/m-run/cancel");

    await user.click(cancel);
    await user.click(within(screen.getByRole("form", { name: "Cancel Mission" })).getByRole("button", { name: "Cancel Mission" }));
    await waitFor(() => expect(calls(fetchMock)).toContain("POST /api/missions/m-run/cancel"));
    expect(await screen.findByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("pages older activity from GET /events by offset", async () => {
    const user = userEvent.setup();
    const recent = Array.from({ length: 50 }, (_, index) =>
      event(`r${index}`, "task_started", `2026-10-14T09:${String(59 - index).padStart(2, "0")}:00Z`),
    );
    const fetchMock = renderRun([{ ...running, recent_events: recent }], {
      events: () => ({ events: [event("old1", "run_created", "2026-10-14T08:00:00Z")], total: 51, limit: 50, offset: 50 }),
    });
    await user.click(await screen.findByRole("button", { name: SHOW_OLDER }));
    const feed = screen.getByRole("list", { name: ACTIVITY_LABEL });
    await waitFor(() => expect(within(feed).getAllByRole("listitem")).toHaveLength(51));
    expect(within(feed).getAllByRole("listitem").at(-1)).toHaveTextContent("Mission created");
    expect(calls(fetchMock)).toContain("GET /api/missions/m-run/events?limit=50&offset=50");
    expect(screen.queryByRole("button", { name: SHOW_OLDER })).toBeNull();
  });
});

describe("a failed Mission", () => {
  it("shows why the step failed", async () => {
    renderRun([failed]);
    const steps = await screen.findByRole("list", { name: STEPS_LABEL });
    const failedStep = within(steps).getAllByRole("listitem")[1] as HTMLElement;
    expect(within(failedStep).getByText("Failed")).toBeInTheDocument();
    expect(within(failedStep).getByText("The draft missed the budget section three times.")).toBeInTheDocument();
    expect(failedStep).toHaveTextContent("attempt 3");
  });

  it("deletes after the in-page confirmation and goes back to the Missions", async () => {
    const user = userEvent.setup();
    const fetchMock = renderRun([failed]);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    const form = screen.getByRole("form", { name: "Delete Mission" });
    expect(calls(fetchMock)).not.toContain("DELETE /api/missions/m-fail");
    await user.click(within(form).getByRole("button", { name: "Delete Mission" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/missions"));
    expect(calls(fetchMock)).toContain("DELETE /api/missions/m-fail");
  });
});

describe("polling and Auto", () => {
  it("polls while the Mission runs and stops once it has completed, when Auto celebrates", async () => {
    const fetchMock = renderRun([running, running, { ...completed, id: "m-run" }], {}, 20);
    expect(await screen.findByText("Done", { selector: "header *" })).toBeInTheDocument();
    expect(autoState()).toBe("celebrate");
    const polls = detailCalls(fetchMock, "m-run");
    expect(polls).toBe(3);
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(detailCalls(fetchMock, "m-run")).toBe(polls);
  });

  it("follows this Mission's state as it moves", async () => {
    const moved = { ...awaitingApproval, id: "m-plan" };
    renderRun([planning, moved, { ...moved, state: "failed" }], {}, 100);
    await waitFor(() => expect(autoState()).toBe("thinking"));
    await waitFor(() => expect(autoState()).toBe("listening"));
    await waitFor(() => expect(autoState()).toBe("oops"));
  });
});
