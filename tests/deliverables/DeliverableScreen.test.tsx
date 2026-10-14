import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DOWNLOAD_FILE } from "@/components/deliverables/DeliverableContent";
import { DeliverableScreen, NOT_ON_SHELF, OPEN_FAILED } from "@/components/deliverables/DeliverableScreen";
import { ABOUT, ASK_AUTO } from "@/components/deliverables/DetailPanel";
import { createApiClient } from "@/lib/client/api";

import { detailBody, mockDetailFetch, row, type Row, stubObjectUrls } from "./helpers";

// A Deliverable's page (mock 05) over a mocked GET /api/deliverables/{id}. "Now" is
// pinned to a local date, so the dates pass in any time zone.

const NOW = new Date(2026, 9, 14, 16, 0);
const MADE = new Date(2026, 9, 14, 15, 42).toISOString();
const RAW_PNG = "/api/workspaces/3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10/files/raw?path=outputs%2Fposter.png";
const RAW_XLSX = "/api/workspaces/3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10/files/raw?path=outputs%2Fbudget.xlsx";
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

const TABLE = ["# The short answer", "", "| Laptop | Price |", "|---|---|", "| Vivobook S 14 | £679 |"].join("\n");

function report(fields: Row = {}): Row {
  return row("d-laptop", {
    title: "Laptop shortlist",
    artifact_type: "report",
    agent_name: "Researcher",
    file_name: "laptop-shortlist.md",
    file_type: "md",
    created_at: MADE,
    content: TABLE,
    ...fields,
  });
}

function renderDetail(fetchMock: ReturnType<typeof mockDetailFetch>, id = "d-laptop") {
  const user = userEvent.setup();
  const view = render(<DeliverableScreen id={id} client={createApiClient(fetchMock)} now={NOW} />);
  return { user, ...view };
}

const answer = (body: unknown, status = 200) => () => Response.json(body, { status });

let restoreUrl: (() => void) | null = null;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  restoreUrl?.();
  restoreUrl = null;
});

describe("DeliverableScreen", () => {
  it("shows the title, type badge, date and Made by, with the back link and no mascot", async () => {
    renderDetail(mockDetailFetch(answer(detailBody(report()))));
    expect(screen.getByRole("status")).toHaveTextContent("Opening this Deliverable");

    const title = await screen.findByRole("heading", { level: 1, name: "Laptop shortlist" });
    const header = title.parentElement;
    if (!header) throw new Error("no header");
    expect(header).toHaveTextContent("Report");
    expect(header).toHaveTextContent("Today, 15:42");
    expect(header).toHaveTextContent("Made by Auto with Researcher");
    expect(screen.getByRole("link", { name: /Shelf/ })).toHaveAttribute("href", "/deliverables");
    expect(screen.queryByTestId("auto-stage")).toBeNull();
    expect(screen.queryByTestId("auto-placeholder")).toBeNull();
  });

  it("asks for the content and renders a markdown table", async () => {
    const fetchMock = mockDetailFetch(answer(detailBody(report())));
    renderDetail(fetchMock);

    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Price" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "£679" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "The short answer" })).toBeInTheDocument();
    const detailCall = fetchMock.mock.calls.find(([input]) => input.startsWith("/api/deliverables/d-laptop"));
    expect(detailCall?.[0]).toBe("/api/deliverables/d-laptop?include_content=true");
  });

  it("never renders a <script> or other raw HTML from the content", async () => {
    const content = ["Before", "", "<script>window.hacked = true</script>", "", '<img src="x" onerror="alert(1)">', "", "After"].join("\n");
    const { container } = renderDetail(mockDetailFetch(answer(detailBody(report({ content })))));

    await screen.findByText("After");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container).not.toHaveTextContent("window.hacked");
    expect((window as unknown as Record<string, unknown>).hacked).toBeUndefined();
  });

  it("shows a text file verbatim in a code block", async () => {
    const content = "def total(rows):\n    return sum(rows)";
    const { container } = renderDetail(
      mockDetailFetch(answer(detailBody(report({ artifact_type: "code", file_type: "py", content })))),
    );

    await screen.findByRole("heading", { level: 1, name: "Laptop shortlist" });
    expect(container.querySelector("pre code")).toHaveTextContent("def total(rows): return sum(rows)");
  });

  it("shows an image Deliverable full width in an <img>, from its file", async () => {
    const createObjectURL = vi.fn(() => "blob:poster");
    const revokeObjectURL = vi.fn();
    restoreUrl = stubObjectUrls(createObjectURL, revokeObjectURL);
    const poster = row("d-poster", {
      title: "Bake sale poster",
      artifact_type: "image",
      file_type: "png",
      preview_url: RAW_PNG,
      content: null,
    });
    const fetchMock = mockDetailFetch(answer(detailBody(poster)), () =>
      new Response(PNG_BYTES, { headers: { "content-type": "image/png" } }),
    );
    const { unmount } = renderDetail(fetchMock, "d-poster");

    const image = await screen.findByRole("img", { name: "Bake sale poster" });
    expect(image).toHaveAttribute("src", "blob:poster");
    expect(fetchMock.mock.calls.some(([input]) => input === "/api/deliverables/d-poster/file")).toBe(true);
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:poster");
  });

  it("says when the picture doesn't load", async () => {
    const poster = row("d-poster", { artifact_type: "image", preview_url: RAW_PNG, content: null });
    renderDetail(mockDetailFetch(answer(detailBody(poster)), answer({ detail: "gone" }, 500)), "d-poster");

    expect(await screen.findByRole("alert")).toHaveTextContent("The picture didn't load.");
  });

  it("links other types to their file when they have one", async () => {
    const sheet = row("d-budget", {
      title: "Club budget",
      artifact_type: "spreadsheet",
      file_name: "budget.xlsx",
      file_type: "xlsx",
      preview_url: RAW_XLSX,
      content: "PK\u0003\u0004��",
    });
    renderDetail(mockDetailFetch(answer(detailBody(sheet))), "d-budget");

    expect(await screen.findByText("Play can't preview this spreadsheet here.")).toBeInTheDocument();
    const download = screen.getByRole("link", { name: DOWNLOAD_FILE });
    expect(download).toHaveAttribute("href", "/api/deliverables/d-budget/file");
    expect(download).toHaveAttribute("download", "budget.xlsx");
    expect(screen.queryByText(/PK/)).toBeNull();
  });

  it("says the type can't be previewed when it has no file", async () => {
    const slides = row("d-slides", { artifact_type: "slide", file_type: "pptx", preview_url: null, content: null });
    renderDetail(mockDetailFetch(answer(detailBody(slides))), "d-slides");

    expect(await screen.findByText("Play can't preview this slide deck here.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: DOWNLOAD_FILE })).toBeNull();
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
  });

  it("has the side panel: Ask Auto about this, About this Deliverable, and Sources when present", async () => {
    const extra = { sources: ["https://www.which.co.uk/reviews/laptops", { url: "https://rtings.com/x" }, { title: "Asus spec sheet" }] };
    renderDetail(mockDetailFetch(answer(detailBody(report({ extra, preview_url: RAW_PNG })))));

    const panel = await screen.findByRole("complementary", { name: ABOUT });
    const ask = within(panel).getByRole("link", { name: ASK_AUTO });
    expect(ask).toHaveAttribute("href", `/?draft=${encodeURIComponent('About my Deliverable "Laptop shortlist": ')}`);
    expect(within(panel).getByRole("link", { name: "Download" })).toHaveAttribute("href", "/api/deliverables/d-laptop/file");
    expect(within(panel).getByText("Made by").nextElementSibling).toHaveTextContent("Researcher");
    expect(within(panel).getByText("Type").nextElementSibling).toHaveTextContent("Report");
    expect(within(panel).getByText("Made").nextElementSibling).toHaveTextContent("Today, 15:42");
    expect(within(panel).getByRole("heading", { name: "Sources · 3" })).toBeInTheDocument();
    const sources = within(panel).getAllByRole("listitem").map((item) => item.textContent);
    expect(sources).toEqual(["which.co.uk", "rtings.com", "Asus spec sheet"]);
  });

  it("leaves Sources out when there are none, and says Made by Auto without an agent", async () => {
    renderDetail(mockDetailFetch(answer(detailBody(report({ agent_name: null })))));

    const panel = await screen.findByRole("complementary", { name: ABOUT });
    expect(within(panel).queryByRole("heading", { name: /Sources/ })).toBeNull();
    expect(within(panel).getByText("Made by").nextElementSibling).toHaveTextContent("Auto");
    expect(screen.getByText("Made by Auto")).toBeInTheDocument();
  });

  it("says a missing Deliverable isn't on the shelf", async () => {
    renderDetail(mockDetailFetch(answer({ detail: "Deliverable not found" }, 404)), "d-gone");

    expect(await screen.findByText(NOT_ON_SHELF)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("shows an error with Try again when it can't be opened, and Try again loads it", async () => {
    let calls = 0;
    const fetchMock = mockDetailFetch(() => {
      calls += 1;
      if (calls > 1) return Response.json(detailBody(report()));
      return Response.json({ error: "Automatos isn't running at http://localhost:8000" }, { status: 502 });
    });
    const { user } = renderDetail(fetchMock);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(OPEN_FAILED);
    expect(alert).toHaveTextContent("Automatos isn't running");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Laptop shortlist" })).toBeInTheDocument();
    await waitFor(() => expect(calls).toBe(2));
  });
});
