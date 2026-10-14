import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONFIRM_DELETE, KEEP } from "@/components/knowledge/DeleteConfirm";
import { DELETE, DocumentScreen, DOWNLOAD, STILL_READING, UNREAD } from "@/components/knowledge/DocumentScreen";

import { callsTo, documentRow, documentsClient, mockDocumentsFetch } from "./helpers";

// A document's page (P-010): its text (Markdown through the safe renderer, other types as
// plain text), Download through Play's route, and Delete, which shows what goes with the
// document before anything is deleted.

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/knowledge/1" }));

const NOW = new Date("2026-10-14T12:00:00");

beforeEach(() => {
  push.mockReset();
});

describe("a document's page", () => {
  it("shows the name, status and type, the Markdown text without raw HTML, and Download", async () => {
    const { fetch } = mockDocumentsFetch({
      documents: { 1: [documentRow(1, { description: "Opening hours", tags: ["venue"] })] },
      content: () => Response.json({ document_id: 1, content: "# Hours\n\n<script>alert(1)</script>\n\nOpen at **nine**." }),
    });
    render(<DocumentScreen id={1} client={documentsClient(fetch)} now={NOW} />);
    expect(await screen.findByRole("heading", { level: 1, name: "notes-1.md" })).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Hours" })).toBeInTheDocument();
    expect(screen.getByText("nine").tagName).toBe("STRONG");
    expect(document.querySelector("main script")).toBeNull();
    expect(screen.getByRole("link", { name: DOWNLOAD })).toHaveAttribute("href", "/api/documents/1/download");
    const side = screen.getByRole("complementary", { name: "Details" });
    expect(within(side).getByText("Opening hours")).toBeInTheDocument();
    expect(within(side).getByText("venue")).toBeInTheDocument();
  });

  it("shows other types as plain text", async () => {
    const { fetch } = mockDocumentsFetch({
      documents: { 2: [documentRow(2, { filename: "rows.csv", file_type: "csv" })] },
      content: () => Response.json({ content: "name,qty\n**tea**,2" }),
    });
    render(<DocumentScreen id={2} client={documentsClient(fetch)} now={NOW} />);
    expect(await screen.findByText(/\*\*tea\*\*,2/)).toBeInTheDocument();
  });

  it("waits for a document still being read, then shows its text", async () => {
    const { fetch } = mockDocumentsFetch({
      documents: { 3: [documentRow(3, { status: "processing" }), documentRow(3)] },
      content: () => Response.json({ content: "All read." }),
    });
    render(<DocumentScreen id={3} client={documentsClient(fetch)} now={NOW} intervalMs={20} />);
    expect(await screen.findByText(STILL_READING)).toBeInTheDocument();
    expect(await screen.findByText("All read.")).toBeInTheDocument();
    expect(callsTo(fetch, "/api/documents/3/content")).toHaveLength(1);
  });

  it("doesn't ask for the text of a document Auto couldn't read", async () => {
    const { fetch } = mockDocumentsFetch({ documents: { 5: [documentRow(5, { status: "failed" })] } });
    render(<DocumentScreen id={5} client={documentsClient(fetch)} now={NOW} />);
    expect(await screen.findByText(UNREAD)).toBeInTheDocument();
    expect(screen.getByText("Couldn't read")).toBeInTheDocument();
    expect(callsTo(fetch, "/api/documents/5/content")).toHaveLength(0);
  });

  it("says when the document is gone", async () => {
    const { fetch } = mockDocumentsFetch();
    render(<DocumentScreen id={4} client={documentsClient(fetch)} now={NOW} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This document isn't in Knowledge any more.");
  });
});

describe("deleting", () => {
  function setUp() {
    const { fetch } = mockDocumentsFetch({
      documents: { 1: [documentRow(1)] },
      content: () => Response.json({ content: "Text." }),
      impact: () => Response.json({ vector_chunks: 12, embeddings: 12, references: 1, storage_freed: "0.00 MB" }),
    });
    render(<DocumentScreen id={1} client={documentsClient(fetch)} now={NOW} />);
    return fetch;
  }

  function deletes(fetch: ReturnType<typeof setUp>) {
    return fetch.mock.calls.filter(([, init]) => init?.method === "DELETE");
  }

  it("shows what goes with the document before anything is deleted", async () => {
    const fetch = setUp();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: DELETE }));
    const panel = screen.getByRole("form", { name: CONFIRM_DELETE });
    expect(
      await within(panel).findByText(
        "Deleting it removes 12 stored passages, 12 search entries, 1 recorded use and frees 0.00 MB. Auto won't be able to use it any more.",
      ),
    ).toBeInTheDocument();
    expect(deletes(fetch)).toHaveLength(0);
    expect(within(panel).getByRole("button", { name: KEEP })).toHaveFocus();

    await user.click(within(panel).getByRole("button", { name: CONFIRM_DELETE }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/knowledge"));
    expect(deletes(fetch)).toHaveLength(1);
    expect(deletes(fetch)[0]?.[0]).toBe("/api/documents/1");
  });

  it("Keep closes it, deletes nothing and puts focus back on Delete", async () => {
    const fetch = setUp();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: DELETE }));
    await user.click(screen.getByRole("button", { name: KEEP }));
    expect(screen.queryByRole("form", { name: CONFIRM_DELETE })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: DELETE })).toHaveFocus();
    expect(deletes(fetch)).toHaveLength(0);
  });
});
