import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ShelfScreen } from "@/components/deliverables/ShelfScreen";
import { createApiClient } from "@/lib/client/api";
import { parseSeen, SEEN_KEY } from "@/lib/deliverables/seen";
import { SHELF_PAGE_SIZE } from "@/lib/deliverables/shelf";

import { listBody, listCalls, mockShelfFetch, row, type Row } from "./helpers";

// The shelf's Load more, and Auto celebrating a Deliverable this browser hasn't seen.

const NOW = new Date(2026, 9, 14, 15, 30);
const TOTAL = 30;

/** Rows newest first: d-0 is the newest. */
const ALL_ROWS: readonly Row[] = Array.from({ length: TOTAL }, (_, index) =>
  row(`d-${index}`, { title: `Deliverable number ${index}`, created_at: new Date(2026, 9, 14, 9, 0, -index).toISOString() }),
);

function pageOf(params: URLSearchParams): Response {
  const offset = Number(params.get("offset") ?? "0");
  const limit = Number(params.get("limit") ?? String(SHELF_PAGE_SIZE));
  return Response.json(listBody(ALL_ROWS.slice(offset, offset + limit), TOTAL, offset));
}

function renderShelf(fetchMock: ReturnType<typeof mockShelfFetch>, refreshMs?: number) {
  const user = userEvent.setup();
  const view = render(<ShelfScreen client={createApiClient(fetchMock)} now={NOW} refreshMs={refreshMs} />);
  return { user, ...view };
}

function cardCount(): number {
  return within(screen.getByRole("list", { name: "Deliverables" })).getAllByRole("link").length;
}

function seenRecord(ids: readonly string[], newest: string): void {
  window.localStorage.setItem(SEEN_KEY, JSON.stringify({ ids, newest }));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("ShelfScreen Load more", () => {
  it("sends the next offset and adds the page under the first", async () => {
    const fetchMock = mockShelfFetch(pageOf);
    const { user } = renderShelf(fetchMock);
    await screen.findByRole("heading", { name: "Deliverable number 0" });
    expect(cardCount()).toBe(SHELF_PAGE_SIZE);

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByRole("heading", { name: "Deliverable number 29" });

    const calls = listCalls(fetchMock);
    expect(calls.map((params) => params.get("offset"))).toEqual(["0", String(SHELF_PAGE_SIZE)]);
    expect(calls[1]?.get("source_type_exclude")).toBe("heartbeat");
    expect(cardCount()).toBe(TOTAL);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("keeps the list and says so when Load more fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = mockShelfFetch((params) =>
      params.get("offset") === "0" ? pageOf(params) : Response.json({ success: false, error: "timeout" }),
    );
    const { user } = renderShelf(fetchMock);
    await screen.findByRole("heading", { name: "Deliverable number 0" });

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Play couldn't load more Deliverables.");
    expect(cardCount()).toBe(SHELF_PAGE_SIZE);
    expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled();
  });

  it("sends the filter with the next offset", async () => {
    const fetchMock = mockShelfFetch(pageOf);
    const { user } = renderShelf(fetchMock);
    await screen.findByRole("heading", { name: "Deliverable number 0" });
    await user.click(screen.getByRole("button", { name: "Documents" }));
    await screen.findByRole("heading", { name: "Deliverable number 0" });

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByRole("heading", { name: "Deliverable number 29" });
    const last = listCalls(fetchMock).at(-1);
    expect(last?.get("artifact_type")).toBe("document");
    expect(last?.get("offset")).toBe(String(SHELF_PAGE_SIZE));
  });
});

describe("ShelfScreen celebrates new Deliverables", () => {
  const OLD = row("d-old", { title: "Old notes", created_at: "2026-10-10T09:00:00+00:00" });
  const NEW = row("d-new", { title: "Laptop shortlist", artifact_type: "report", created_at: "2026-10-14T09:00:00+00:00" });

  it("only remembers on the first visit", async () => {
    renderShelf(mockShelfFetch(() => Response.json(listBody([NEW, OLD]))));
    await screen.findByRole("heading", { name: "Laptop shortlist" });

    expect(screen.getByText("2 on the shelf. Nice collection!")).toBeInTheDocument();
    expect(screen.queryByText("Your report is ready")).toBeNull();
    const saved = parseSeen(window.localStorage.getItem(SEEN_KEY));
    expect(saved?.ids).toEqual(["d-new", "d-old"]);
    expect(saved?.newest).toBe("2026-10-14T09:00:00+00:00");
  });

  it("plays celebrate for a Deliverable not seen before, once", async () => {
    seenRecord(["d-old"], "2026-10-10T09:00:00+00:00");
    const fetchMock = mockShelfFetch(() => Response.json(listBody([NEW, OLD])));
    const first = renderShelf(fetchMock);
    expect(await screen.findByText("Your report is ready")).toBeInTheDocument();
    expect(parseSeen(window.localStorage.getItem(SEEN_KEY))?.ids).toContain("d-new");
    first.unmount();

    renderShelf(fetchMock);
    await screen.findByRole("heading", { name: "Laptop shortlist" });
    expect(screen.queryByText("Your report is ready")).toBeNull();
  });

  it("celebrates one that appears while the shelf is open", async () => {
    let rows: readonly Row[] = [OLD];
    const fetchMock = mockShelfFetch(() => Response.json(listBody(rows)));
    renderShelf(fetchMock, 40);
    await screen.findByRole("heading", { name: "Old notes" });
    expect(screen.queryByText("Your report is ready")).toBeNull();

    rows = [NEW, OLD];
    expect(await screen.findByRole("heading", { name: "Laptop shortlist" })).toBeInTheDocument();
    expect(await screen.findByText("Your report is ready")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("2 Deliverables")).toBeInTheDocument());
    const [newest] = within(screen.getByRole("list", { name: "Deliverables" })).getAllByRole("link");
    expect(newest).toHaveTextContent("Newest");
    expect(newest).toHaveTextContent("Laptop shortlist");
  });

  it("doesn't celebrate older Deliverables met for the first time under a filter", async () => {
    seenRecord(["d-new"], "2026-10-14T09:00:00+00:00");
    const fetchMock = mockShelfFetch((params) => Response.json(listBody(params.has("artifact_type") ? [OLD] : [NEW])));
    const { user } = renderShelf(fetchMock);
    await screen.findByRole("heading", { name: "Laptop shortlist" });
    await user.click(screen.getByRole("button", { name: "Documents" }));
    await screen.findByRole("heading", { name: "Old notes" });
    expect(screen.queryByText(/is ready/)).toBeNull();
  });
});
