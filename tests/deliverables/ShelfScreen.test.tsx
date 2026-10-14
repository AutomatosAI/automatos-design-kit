import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FILTER_GROUP_LABEL, ShelfScreen } from "@/components/deliverables/ShelfScreen";
import { createApiClient } from "@/lib/client/api";
import { SHELF_PAGE_SIZE } from "@/lib/deliverables/shelf";

import { listBody, listCalls, mockShelfFetch, row, type Row, stubObjectUrls } from "./helpers";

// The shelf (mock 04) over a mocked GET /api/deliverables. "Now" is pinned to a local
// date, so the card dates pass in any time zone.

const NOW = new Date(2026, 9, 14, 15, 30);

function at(day: number, hour = 9): string {
  return new Date(2026, 9, day, hour).toISOString();
}

const ROWS: readonly Row[] = [
  row("d-laptop", { title: "Laptop shortlist", artifact_type: "report", created_at: at(14) }),
  row("d-chem", { title: "Chemistry revision plan", artifact_type: "document", created_at: at(13) }),
  row("d-poster", { title: "Bake sale poster", artifact_type: "image", created_at: at(12) }),
  row("d-slides", { title: "Climate debate slides", artifact_type: "slide", created_at: at(4) }),
];

function renderShelf(fetchMock: ReturnType<typeof mockShelfFetch>, refreshMs?: number) {
  const user = userEvent.setup();
  const view = render(<ShelfScreen client={createApiClient(fetchMock)} now={NOW} refreshMs={refreshMs} />);
  return { user, ...view };
}

const answer = (body: unknown) => () => Response.json(body);

function cards() {
  return within(screen.getByRole("list", { name: "Deliverables" })).getAllByRole("link");
}

let restoreUrl: (() => void) | null = null;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  restoreUrl?.();
  restoreUrl = null;
});

describe("ShelfScreen", () => {
  it("shows each Deliverable's title, type badge and date, newest first, with heartbeats hidden", async () => {
    const fetchMock = mockShelfFetch(answer(listBody(ROWS, 4)));
    renderShelf(fetchMock);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your shelf");
    await screen.findByRole("heading", { name: "Laptop shortlist" });

    expect(screen.getByRole("heading", { level: 1, name: "Your shelf" })).toBeInTheDocument();
    expect(screen.getByText("4 Deliverables")).toBeInTheDocument();
    const [laptop, chem, poster, slides] = cards();
    expect(laptop).toHaveAttribute("href", "/deliverables/d-laptop");
    expect(laptop).toHaveTextContent("Newest");
    expect(laptop).toHaveTextContent("Report");
    expect(laptop).toHaveTextContent("Today");
    expect(chem).toHaveTextContent("Yesterday");
    expect(chem).not.toHaveTextContent("Newest");
    expect(poster).toHaveTextContent("Image");
    expect(poster).toHaveTextContent("Mon");
    expect(slides).toHaveTextContent("Slides");
    expect(slides).toHaveTextContent("4 Oct");

    const [params] = listCalls(fetchMock);
    expect(params?.get("source_type_exclude")).toBe("heartbeat");
    expect(params?.get("offset")).toBe("0");
    expect(params?.get("limit")).toBe(String(SHELF_PAGE_SIZE));
    expect(params?.has("artifact_type")).toBe(false);
  });

  it("shows the type colour when a Deliverable has no thumbnail, and the picture when it has one", async () => {
    const createObjectURL = vi.fn(() => "blob:play/thumb-laptop");
    const revokeObjectURL = vi.fn();
    restoreUrl = stubObjectUrls(createObjectURL, revokeObjectURL);
    const png = () => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "Content-Type": "image/png" } });
    const fetchMock = mockShelfFetch(answer(listBody(ROWS.slice(0, 2))), (id) =>
      id === "d-laptop" ? png() : Response.json({ detail: "Preview not found" }, { status: 404 }),
    );
    const { container, unmount } = renderShelf(fetchMock);

    await waitFor(() => expect(container.querySelector("img[src='blob:play/thumb-laptop']")).not.toBeNull());
    const thumbs = screen.getAllByTestId("shelf-thumb");
    expect(thumbs[0]).toHaveAttribute("data-kind", "report");
    expect(thumbs[1]).toHaveAttribute("data-kind", "document");
    expect(thumbs[1]?.querySelector("img")).toBeNull();
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:play/thumb-laptop");
  });

  it("sets artifact_type from the filter chips, and All clears it", async () => {
    const fetchMock = mockShelfFetch((params) =>
      Response.json(listBody(params.get("artifact_type") === "report" ? ROWS.slice(0, 1) : ROWS)),
    );
    const { user } = renderShelf(fetchMock);
    await screen.findByRole("heading", { name: "Bake sale poster" });
    const chips = within(screen.getByRole("group", { name: FILTER_GROUP_LABEL }));
    expect(chips.getAllByRole("button").map((chip) => chip.textContent)).toEqual([
      "All",
      "Reports",
      "Documents",
      "Images",
      "Spreadsheets",
      "Slides",
    ]);
    expect(chips.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");

    await user.click(chips.getByRole("button", { name: "Reports" }));
    await screen.findByRole("heading", { name: "Laptop shortlist" });
    expect(screen.queryByRole("heading", { name: "Bake sale poster" })).toBeNull();
    expect(chips.getByRole("button", { name: "Reports" })).toHaveAttribute("aria-pressed", "true");
    expect(listCalls(fetchMock).at(-1)?.get("artifact_type")).toBe("report");
    expect(listCalls(fetchMock).at(-1)?.get("offset")).toBe("0");

    await user.click(chips.getByRole("button", { name: "Slides" }));
    await waitFor(() => expect(listCalls(fetchMock).at(-1)?.get("artifact_type")).toBe("slide"));
    await user.click(chips.getByRole("button", { name: "Spreadsheets" }));
    await waitFor(() => expect(listCalls(fetchMock).at(-1)?.get("artifact_type")).toBe("spreadsheet"));

    await user.click(chips.getByRole("button", { name: "All" }));
    await screen.findByRole("heading", { name: "Bake sale poster" });
    expect(listCalls(fetchMock).at(-1)?.has("artifact_type")).toBe(false);
    expect(listCalls(fetchMock).at(-1)?.get("source_type_exclude")).toBe("heartbeat");
  });

  it("shows an error state with Try again when the list says success: false, never the empty state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let failing = true;
    const fetchMock = mockShelfFetch(() =>
      Response.json(
        failing ? { success: false, error: "relation v_workspace_outputs does not exist", deliverables: [] } : listBody(ROWS),
      ),
    );
    const { user } = renderShelf(fetchMock);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Play couldn't load your shelf.");
    expect(alert).not.toHaveTextContent("v_workspace_outputs");
    expect(screen.queryByText(/Nothing on your shelf yet/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Start a chat" })).toBeNull();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[shelf]"), expect.stringContaining("v_workspace_outputs"));

    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Laptop shortlist" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(listCalls(fetchMock)).toHaveLength(2);
  });

  it("says Automatos isn't running when the proxy answers 502", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = mockShelfFetch(() =>
      Response.json({ error: "Automatos isn't running at http://localhost:8000" }, { status: 502 }),
    );
    renderShelf(fetchMock);
    expect(await screen.findByRole("alert")).toHaveTextContent("Automatos isn't running at http://localhost:8000");
    expect(screen.getByText("Automatos isn't running", { selector: "span" })).toBeInTheDocument();
  });

  it("shows a friendly empty state when there are no Deliverables", async () => {
    renderShelf(mockShelfFetch(answer(listBody([]))));
    expect(await screen.findByText(/Nothing on your shelf yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a chat" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("names the type in the empty state of a filter", async () => {
    const fetchMock = mockShelfFetch((params) => Response.json(listBody(params.has("artifact_type") ? [] : ROWS)));
    const { user } = renderShelf(fetchMock);
    await screen.findByRole("heading", { name: "Laptop shortlist" });
    await user.click(screen.getByRole("button", { name: "Spreadsheets" }));
    expect(await screen.findByText(/No spreadsheets yet/)).toBeInTheDocument();
  });
});
