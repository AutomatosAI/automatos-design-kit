import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { EMPTY, KnowledgeScreen, SEARCH_LABEL, SEARCHING } from "@/components/knowledge/KnowledgeScreen";
import { LIST_LABEL, RESULTS_LABEL } from "@/components/knowledge/DocumentList";
import { PICKER_LABEL, UPLOAD_TITLE } from "@/components/knowledge/UploadPanel";
import { UPLOAD_PROGRESS } from "@/components/knowledge/KnowledgeActivity";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/rules";
import type { UploadReply } from "@/lib/client/upload";

import {
  callsTo,
  deferred,
  documentRow,
  documentsClient,
  fileNamed,
  mockDocumentsFetch,
  mockUploadSender,
} from "./helpers";

// The Knowledge page (P-010): the list, the browser's type and size checks, the upload with
// X-Play-Upload: 1, the processing poll that stops once a document is read, search results
// in place of the list, and Auto only while something happens (and on the empty state).

const NOW = new Date("2026-10-14T12:00:00");

function autoState(): string | null {
  return screen.queryByTestId("auto-placeholder")?.textContent ?? null;
}

function picker(): HTMLInputElement {
  const input = screen.getByLabelText(PICKER_LABEL);
  if (!(input instanceof HTMLInputElement)) throw new Error("no file picker");
  return input;
}

function choose(file: File) {
  fireEvent.change(picker(), { target: { files: [file] } });
}

describe("the list", () => {
  it("shows each document's name, type, size and status, with no Auto on it", async () => {
    const { fetch } = mockDocumentsFetch({
      list: () => Response.json([documentRow(1), documentRow(2, { filename: "plan.pdf", file_type: "pdf", status: "failed", file_size: 3 * 1024 * 1024 })]),
    });
    render(<KnowledgeScreen client={documentsClient(fetch)} now={NOW} />);
    const list = await screen.findByRole("list", { name: LIST_LABEL });
    const rows = within(list).getAllByRole("link");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("href", "/knowledge/1");
    expect(within(rows[0] as HTMLElement).getByText("notes-1.md")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("Markdown")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("2 KB")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("Ready")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("PDF")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("3.0 MB")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Couldn't read")).toBeInTheDocument();
    expect(screen.getByText("2 documents")).toBeInTheDocument();
    expect(autoState()).toBeNull();
  });

  it("puts Auto on the empty state: give me something to read", async () => {
    const { fetch } = mockDocumentsFetch();
    render(<KnowledgeScreen client={documentsClient(fetch)} now={NOW} />);
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(autoState()).toBe("idle");
  });
});

describe("uploading", () => {
  it("refuses a type Auto can't read, in plain words, and sends nothing", async () => {
    const { fetch } = mockDocumentsFetch();
    const sender = mockUploadSender(() => ({ status: 200, body: null }));
    render(<KnowledgeScreen client={documentsClient(fetch, sender)} now={NOW} />);
    await screen.findByText(EMPTY);
    choose(fileNamed("setup.exe"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Auto can read PDF, Word \(\.docx\), text, Markdown/);
    expect(sender).not.toHaveBeenCalled();
  });

  it("refuses a file over 50 MB before sending it", async () => {
    const { fetch } = mockDocumentsFetch();
    const sender = mockUploadSender(() => ({ status: 200, body: null }));
    render(<KnowledgeScreen client={documentsClient(fetch, sender)} now={NOW} />);
    await screen.findByText(EMPTY);
    choose(fileNamed("big.pdf", MAX_UPLOAD_BYTES + 1));
    expect(await screen.findByRole("alert")).toHaveTextContent("That file is 51 MB. Auto can read files up to 50 MB.");
    expect(sender).not.toHaveBeenCalled();
  });

  it("sends the file with X-Play-Upload: 1 and no Content-Type, shows progress, then the result", async () => {
    const { fetch } = mockDocumentsFetch({ list: () => Response.json([]) });
    const answer = deferred<UploadReply>();
    const sender = mockUploadSender((request) => {
      request.onProgress?.({ loaded: 5, total: 10 });
      return answer.promise;
    });
    render(<KnowledgeScreen client={documentsClient(fetch, sender)} now={NOW} />);
    await screen.findByText(EMPTY);
    const file = fileNamed("notes.md");
    choose(file);

    await waitFor(() => expect(sender).toHaveBeenCalledTimes(1));
    const request = sender.mock.calls[0]?.[0];
    expect(request?.url).toBe("/api/documents/upload");
    expect(request?.headers["X-Play-Upload"]).toBe("1");
    expect(Object.keys(request?.headers ?? {}).map((name) => name.toLowerCase())).not.toContain("content-type");
    const sent = request?.body.get("file");
    expect(sent).toBeInstanceOf(File);
    expect(sent instanceof File ? sent.name : null).toBe(file.name);
    expect(await screen.findByRole("progressbar", { name: UPLOAD_PROGRESS })).toHaveAttribute("aria-valuenow", "50");
    expect(autoState()).toBe("reading");

    await act(async () => {
      answer.resolve({ status: 200, body: { document_id: 9, filename: "notes.md", status: "processed", message: "ok" } });
    });
    expect(await screen.findByText("notes.md is read. Auto can use it now.")).toBeInTheDocument();
    expect(autoState()).toBe("celebrate");
    expect(screen.getByRole("link", { name: "Open it" })).toHaveAttribute("href", "/knowledge/9");
    // The list is read again, so the new document shows.
    await waitFor(() => expect(callsTo(fetch, "/api/documents")).toHaveLength(2));
  });

  it("says a duplicate is already there, and a failed read in the core's words with Auto's oops", async () => {
    const { fetch } = mockDocumentsFetch();
    const replies: UploadReply[] = [
      { status: 200, body: { document_id: 3, filename: "a.txt", status: "duplicate", message: "Document already exists" } },
      { status: 200, body: { document_id: 4, filename: "b.txt", status: "failed", message: "Uploaded, but processing failed: no embedder" } },
    ];
    const sender = mockUploadSender(() => replies.shift() ?? { status: 500, body: null });
    render(<KnowledgeScreen client={documentsClient(fetch, sender)} now={NOW} />);
    await screen.findByText(EMPTY);
    choose(fileNamed("a.txt"));
    expect(await screen.findByText("Auto already has a.txt, so nothing changed.")).toBeInTheDocument();
    choose(fileNamed("b.txt"));
    expect(await screen.findByRole("alert")).toHaveTextContent("b.txt: Uploaded, but processing failed: no embedder");
    expect(autoState()).toBe("oops");
  });

  it("shows the proxy's refusal in words", async () => {
    const { fetch } = mockDocumentsFetch();
    const sender = mockUploadSender(() => ({ status: 413, body: { error: "That file is over 50 MB, the most Automatos takes" } }));
    render(<KnowledgeScreen client={documentsClient(fetch, sender)} now={NOW} />);
    await screen.findByText(EMPTY);
    choose(fileNamed("c.csv"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "c.csv: Play couldn't upload it. That file is over 50 MB, the most Automatos takes",
    );
  });

  it("takes a dropped file the same way", async () => {
    const { fetch } = mockDocumentsFetch();
    const sender = mockUploadSender(() => ({ status: 200, body: { document_id: 5, filename: "d.json", status: "processed", message: "" } }));
    render(<KnowledgeScreen client={documentsClient(fetch, sender)} now={NOW} />);
    await screen.findByText(EMPTY);
    const zone = screen.getByRole("region", { name: UPLOAD_TITLE });
    fireEvent.drop(zone, { dataTransfer: { files: [fileNamed("d.json", undefined, "{}")] } });
    expect(await screen.findByText("d.json is read. Auto can use it now.")).toBeInTheDocument();
  });
});

describe("the processing poll", () => {
  it("asks GET /api/documents/<id> until the document is processed, then stops", async () => {
    const { fetch, asked } = mockDocumentsFetch({
      list: () => Response.json([documentRow(5, { status: "processing" })]),
      documents: {
        5: [documentRow(5, { status: "processing" }), documentRow(5, { status: "processed" })],
      },
    });
    render(<KnowledgeScreen client={documentsClient(fetch)} now={NOW} intervalMs={20} />);
    const list = await screen.findByRole("list", { name: LIST_LABEL });
    expect(within(list).getByText("Reading")).toBeInTheDocument();
    expect(await within(list).findByText("Ready")).toBeInTheDocument();
    const settled = asked.get(5) ?? 0;
    expect(settled).toBe(2);
    await new Promise((wait) => setTimeout(wait, 120));
    expect(asked.get(5)).toBe(settled);
  });

  it("follows an upload the backend answered as still processing, and counts 'completed' as read", async () => {
    const { fetch } = mockDocumentsFetch({
      documents: { 6: [documentRow(6, { filename: "e.md", status: "completed" })] },
    });
    const sender = mockUploadSender(() => ({ status: 200, body: { document_id: 6, filename: "e.md", status: "processing", message: "" } }));
    render(<KnowledgeScreen client={documentsClient(fetch, sender)} now={NOW} intervalMs={20} />);
    await screen.findByText(EMPTY);
    choose(fileNamed("e.md"));
    expect(await screen.findByText("e.md is read. Auto can use it now.")).toBeInTheDocument();
    expect(fetch.mock.calls.some(([input]) => /reprocess/.test(input))).toBe(false);
  });
});

describe("search", () => {
  it("runs on Enter, shows Auto searching, then puts the results in place of the list until cleared", async () => {
    const answer = deferred<Response>();
    const { fetch } = mockDocumentsFetch({
      list: () => Response.json([documentRow(1)]),
      search: () => answer.promise,
    });
    const user = userEvent.setup();
    render(<KnowledgeScreen client={documentsClient(fetch)} now={NOW} />);
    await screen.findByRole("list", { name: LIST_LABEL });

    await user.type(screen.getByRole("searchbox", { name: SEARCH_LABEL }), "salt loft{Enter}");
    expect(await screen.findByText(SEARCHING)).toBeInTheDocument();
    expect(autoState()).toBe("searching");
    const sent = callsTo(fetch, "/api/documents/search")[0]?.[1];
    expect(JSON.parse(String(sent?.body))).toEqual({ query: "salt loft" });

    await act(async () => {
      answer.resolve(
        Response.json({
          query: "salt loft",
          results: [
            {
              document_id: 1,
              excerpt: "<b>The Salt Loft</b> opens at nine.",
              similarity: 0.82,
              source: { filename: "notes-1.md", file_type: "markdown" },
            },
          ],
        }),
      );
    });
    const results = await screen.findByRole("list", { name: RESULTS_LABEL });
    expect(screen.queryByRole("list", { name: LIST_LABEL })).not.toBeInTheDocument();
    // The excerpt is text: its markup shows as characters, never as elements.
    expect(within(results).getByText("<b>The Salt Loft</b> opens at nine.")).toBeInTheDocument();
    expect(within(results).getByText("82% match")).toBeInTheDocument();
    expect(within(results).getByRole("link", { name: "notes-1.md" })).toHaveAttribute("href", "/knowledge/1");
    expect(screen.getByText("1 match for “salt loft”")).toBeInTheDocument();
    expect(autoState()).toBeNull();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByRole("list", { name: LIST_LABEL })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: SEARCH_LABEL })).toHaveValue("");
  });

  it("says when nothing matches", async () => {
    const { fetch } = mockDocumentsFetch({
      list: () => Response.json([documentRow(1)]),
      search: () => Response.json({ query: "zebra", results: [] }),
    });
    const user = userEvent.setup();
    render(<KnowledgeScreen client={documentsClient(fetch)} now={NOW} />);
    await screen.findByRole("list", { name: LIST_LABEL });
    await user.type(screen.getByRole("searchbox", { name: SEARCH_LABEL }), "zebra");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Nothing in your documents matches “zebra”.")).toBeInTheDocument();
  });
});
