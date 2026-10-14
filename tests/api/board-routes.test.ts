// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as answer } from "@/app/api/approvals/[id]/answer/route";
import { POST as deny } from "@/app/api/approvals/[id]/deny/route";
import { POST as grant } from "@/app/api/approvals/[id]/grant/route";
import { GET as approvals } from "@/app/api/approvals/route";
import { POST as approve } from "@/app/api/tasks/[id]/approve/route";
import { POST as cancel } from "@/app/api/tasks/[id]/cancel/route";
import { POST as reject } from "@/app/api/tasks/[id]/reject/route";
import { DELETE as deleteTask, GET as task, PATCH as editTask } from "@/app/api/tasks/[id]/route";
import { POST as runNow } from "@/app/api/tasks/[id]/run-now/route";
import { PATCH as moveTask } from "@/app/api/tasks/[id]/status/route";
import { POST as createTask, GET as tasks } from "@/app/api/tasks/route";

// B-001: the board's proxy routes. Query allowlists, whole-number ids, and bodies cut
// down to the documented fields (an edit never carries a status).

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const BACKEND = "http://localhost:8000";

type Context = { params: Promise<{ id: string }> };
type IdRoute = (request: Request, context: Context) => Promise<Response>;

const fetchMock = vi.fn<typeof fetch>();

function playRequest(path: string, init: RequestInit = {}): Request {
  const json: Record<string, string> = (init.method ?? "GET") === "GET" ? {} : { "Content-Type": "application/json" };
  return new Request(`http://localhost:3100${path}`, {
    ...init,
    headers: { "X-Workspace-ID": WORKSPACE_ID, ...json, ...(init.headers as Record<string, string>) },
  });
}

function sent(path: string, method: string, body?: unknown): Request {
  return playRequest(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

function params(id: string): Context {
  return { params: Promise.resolve({ id }) };
}

function forwarded(index = 0): { url: string; init: RequestInit; body: unknown } {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`fetch call ${index} was not made`);
  const init = call[1] ?? {};
  return { url: String(call[0]), init, body: init.body ? JSON.parse(String(init.body)) : undefined };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTOMATOS_BACKEND_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchMock.mockImplementation(async () => Response.json({ id: 42, status: "inbox" }));
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("task list and create", () => {
  it("keeps only the list's allowlisted query", async () => {
    const query =
      "status=inbox%2Creview&agent_id=7&priority=high&search=report&limit=50&offset=10&finished_limit=20"
      + "&workspace_id=other&parent_task_id=3";

    await tasks(playRequest(`/api/tasks?${query}`));

    expect(forwarded().url).toBe(
      `${BACKEND}/api/v1/tasks?status=inbox%2Creview&agent_id=7&priority=high&search=report&limit=50&offset=10&finished_limit=20`,
    );
    expect(forwarded().init.method).toBe("GET");
  });

  it("creates a Task with the documented fields only", async () => {
    const body = {
      title: "Write the report",
      description: "Two pages",
      assigned_agent_id: 7,
      priority: "high",
      tags: ["q4"],
      source_type: "mission",
      status: "done",
    };

    await createTask(sent("/api/tasks", "POST", body));

    expect(forwarded().url).toBe(`${BACKEND}/api/v1/tasks`);
    expect(forwarded().init.method).toBe("POST");
    expect(forwarded().body).toEqual({
      title: "Write the report",
      description: "Two pages",
      assigned_agent_id: 7,
      priority: "high",
      tags: ["q4"],
    });
  });
});

describe("one Task", () => {
  it("forwards GET and DELETE with no query", async () => {
    await task(playRequest("/api/tasks/42?workspace_id=other"), params("42"));
    await deleteTask(sent("/api/tasks/42", "DELETE"), params("42"));

    expect(forwarded(0).url).toBe(`${BACKEND}/api/v1/tasks/42`);
    expect(forwarded(1).url).toBe(`${BACKEND}/api/v1/tasks/42`);
    expect(forwarded(1).init.method).toBe("DELETE");
  });

  it("PATCH forwards only the editable fields and drops the rest", async () => {
    const body = {
      title: "Renamed",
      description: "More",
      priority: "low",
      assigned_agent_id: 9,
      tags: ["a"],
      note: "Looks good",
      status: "done",
      result: "made up",
      source_type: "mission",
    };

    await editTask(sent("/api/tasks/42", "PATCH", body), params("42"));

    expect(forwarded().init.method).toBe("PATCH");
    expect(forwarded().body).toEqual({
      title: "Renamed",
      description: "More",
      priority: "low",
      assigned_agent_id: 9,
      tags: ["a"],
      note: "Looks good",
    });
  });

  it("PATCH with only a title sends only the title", async () => {
    await editTask(sent("/api/tasks/42", "PATCH", { title: "Renamed", blocked_reason: "x" }), params("42"));

    expect(forwarded().body).toEqual({ title: "Renamed" });
  });

  it("a comment is {note}", async () => {
    await editTask(sent("/api/tasks/42", "PATCH", { note: "Please add sources" }), params("42"));

    expect(forwarded().body).toEqual({ note: "Please add sources" });
  });

  it("a move sends {status, blocked_reason} to /status and nothing else", async () => {
    const body = { status: "blocked", blocked_reason: "Waiting on data", title: "Sneaky" };

    await moveTask(sent("/api/tasks/42/status", "PATCH", body), params("42"));

    expect(forwarded().url).toBe(`${BACKEND}/api/v1/tasks/42/status`);
    expect(forwarded().init.method).toBe("PATCH");
    expect(forwarded().body).toEqual({ status: "blocked", blocked_reason: "Waiting on data" });
  });

  it("passes a refused move back unchanged", async () => {
    fetchMock.mockImplementation(async () => Response.json({ detail: "Use Approve on the ticket" }, { status: 409 }));

    const response = await moveTask(sent("/api/tasks/42/status", "PATCH", { status: "done" }), params("42"));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ detail: "Use Approve on the ticket" });
  });

  it.each(["abc", "0", "-3", "1.5", "42;drop", "12345678901234", "stream"])(
    "refuses the id %s before any call",
    async (id) => {
      const response = await task(playRequest(`/api/tasks/${encodeURIComponent(id)}`), params(id));

      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("Task actions", () => {
  it("approve forwards {note} only", async () => {
    await approve(sent("/api/tasks/42/approve", "POST", { note: "Thanks", status: "done" }), params("42"));

    expect(forwarded().url).toBe(`${BACKEND}/api/v1/tasks/42/approve`);
    expect(forwarded().init.method).toBe("POST");
    expect(forwarded().body).toEqual({ note: "Thanks" });
  });

  it("reject forwards {feedback} only", async () => {
    await reject(sent("/api/tasks/42/reject", "POST", { feedback: "Add sources", note: "x" }), params("42"));

    expect(forwarded().url).toBe(`${BACKEND}/api/v1/tasks/42/reject`);
    expect(forwarded().body).toEqual({ feedback: "Add sources" });
  });

  const bodyless: readonly [string, IdRoute][] = [
    ["run-now", runNow],
    ["cancel", cancel],
  ];

  it.each(bodyless)("%s sends no body", async (suffix, route) => {
    await route(sent(`/api/tasks/42/${suffix}`, "POST", { anything: true }), params("42"));

    expect(forwarded().url).toBe(`${BACKEND}/api/v1/tasks/42/${suffix}`);
    expect(forwarded().init.method).toBe("POST");
    expect(forwarded().init.body).toBeUndefined();
  });

  it("refuses an action not sent as JSON (415) and one from another site (403)", async () => {
    const plain = playRequest("/api/tasks/42/cancel", { method: "POST", headers: { "Content-Type": "text/plain" } });
    const crossSite = playRequest("/api/tasks/42/cancel", { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" } });

    expect((await cancel(plain, params("42"))).status).toBe(415);
    expect((await cancel(crossSite, params("42"))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("approvals", () => {
  it("keeps only status and kind on the list", async () => {
    fetchMock.mockImplementation(async () => Response.json({ grants: [] }));

    await approvals(playRequest("/api/approvals?status=pending&kind=question&workspace_id=other&limit=9"));

    expect(forwarded().url).toBe(`${BACKEND}/api/v1/approval-grants?status=pending&kind=question`);
  });

  const decisions: readonly [string, IdRoute][] = [
    ["grant", grant],
    ["deny", deny],
  ];

  it.each(decisions)("%s forwards to the grant with no body", async (suffix, route) => {
    await route(sent(`/api/approvals/5/${suffix}`, "POST", {}), params("5"));

    expect(forwarded().url).toBe(`${BACKEND}/api/v1/approval-grants/5/${suffix}`);
    expect(forwarded().init.method).toBe("POST");
    expect(forwarded().init.body).toBeUndefined();
  });

  it("answer forwards {answer_text, option} only", async () => {
    await answer(sent("/api/approvals/5/answer", "POST", { answer_text: "Use Q3", option: "B", extra: 1 }), params("5"));

    expect(forwarded().url).toBe(`${BACKEND}/api/v1/approval-grants/5/answer`);
    expect(forwarded().body).toEqual({ answer_text: "Use Q3", option: "B" });
  });

  it("refuses a grant id that isn't a whole number", async () => {
    const response = await grant(sent("/api/approvals/x/grant", "POST", {}), params("x"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
