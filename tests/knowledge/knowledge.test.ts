// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  documentCount,
  impactWords,
  isProcessed,
  isSettled,
  processingIds,
  readsAsMarkdown,
  similarityWords,
  sizeWords,
  statusChip,
  typeWords,
  withUpdates,
} from "@/lib/documents/knowledge";
import { parseDocument, parseSearchAnswer, parseUploadResult } from "@/lib/documents/parse";
import { checkFile, extensionOf, MAX_UPLOAD_BYTES } from "@/lib/documents/rules";
import type { KnowledgeDocument } from "@/lib/documents/types";
import {
  answeredPhase,
  DELETED_WHILE_READING,
  knowledgeCaption,
  knowledgeMascot,
  phaseWords,
  polledPhase,
  sendingPhase,
  type UploadPhase,
  waitingOn,
} from "@/lib/documents/upload";

// The Knowledge page's pure rules (P-010): the browser's file check, status words and
// what stops the poll, the upload's phases, and Auto's state for each.

function doc(id: number, status: string): KnowledgeDocument {
  const parsed = parseDocument({ id, filename: `f${id}.md`, file_type: "markdown", status });
  if (!parsed) throw new Error("fixture didn't parse");
  return parsed;
}

describe("checkFile", () => {
  it("takes the eight types, whatever the case of the extension", () => {
    for (const name of ["a.pdf", "a.docx", "a.txt", "a.md", "a.csv", "a.html", "a.json", "A.XLSX"]) {
      expect({ name, ok: checkFile({ name, size: 10 }).ok }).toEqual({ name, ok: true });
    }
  });

  it("refuses other types, files with no extension and empty files, in plain words", () => {
    for (const name of ["a.exe", "a.doc", "a.markdown", "README", ".md"]) {
      const check = checkFile({ name, size: 10 });
      expect({ name, ok: check.ok }).toEqual({ name, ok: false });
    }
    expect(checkFile({ name: "a.md", size: 0 })).toEqual({ ok: false, reason: "That file is empty, so there's nothing to read." });
  });

  it("allows exactly 50 MB and refuses a byte more", () => {
    expect(checkFile({ name: "a.pdf", size: MAX_UPLOAD_BYTES }).ok).toBe(true);
    expect(checkFile({ name: "a.pdf", size: MAX_UPLOAD_BYTES + 1 })).toEqual({
      ok: false,
      reason: "That file is 51 MB. Auto can read files up to 50 MB.",
    });
  });

  it("reads the extension from the last dot", () => {
    expect(extensionOf("report.final.PDF")).toBe(".pdf");
    expect(extensionOf("noext")).toBe("");
  });
});

describe("statuses", () => {
  it("are words with a glyph tone, never colour alone", () => {
    expect(statusChip("processing")).toEqual({ tone: "running", label: "Reading" });
    expect(statusChip("uploaded")).toEqual({ tone: "queued", label: "Waiting to be read" });
    expect(statusChip("processed")).toEqual({ tone: "done", label: "Ready" });
    expect(statusChip("completed")).toEqual({ tone: "done", label: "Ready" });
    expect(statusChip("duplicate")).toEqual({ tone: "done", label: "Already here" });
    expect(statusChip("failed")).toEqual({ tone: "failed", label: "Couldn't read" });
    expect(statusChip("re_indexing")).toEqual({ tone: "idle", label: "Re indexing" });
  });

  it("stop the poll once processed (or completed, the queue's word), failed or duplicate", () => {
    for (const status of ["processed", "completed", "failed", "duplicate", "something_new"]) {
      expect({ status, settled: isSettled(status) }).toEqual({ status, settled: true });
    }
    for (const status of ["uploaded", "pending", "processing"]) {
      expect({ status, settled: isSettled(status) }).toEqual({ status, settled: false });
    }
    expect(isProcessed("completed")).toBe(true);
  });

  it("lists the ids still being read once each, and lays polled rows over the list", () => {
    const list = [doc(1, "processed"), doc(2, "processing"), doc(3, "uploaded")];
    expect(processingIds(list, [2, 9])).toEqual([2, 3, 9]);
    const updated = withUpdates(list, new Map([[2, doc(2, "processed")]]));
    expect(updated.map((row) => row.status)).toEqual(["processed", "processed", "uploaded"]);
    expect(list[1]?.status).toBe("processing");
  });
});

describe("words", () => {
  it("names types, sizes, matches and counts", () => {
    expect(typeWords("pdf")).toBe("PDF");
    expect(typeWords("spreadsheet")).toBe("Excel");
    expect(typeWords("unknown", "page.html")).toBe("HTML");
    expect(typeWords("unknown")).toBe("File");
    expect(sizeWords(null)).toBe("");
    expect(sizeWords(900)).toBe("900 bytes");
    expect(sizeWords(14 * 1024)).toBe("14 KB");
    expect(sizeWords(2.4 * 1024 * 1024)).toBe("2.4 MB");
    expect(similarityWords(0.823)).toBe("82% match");
    expect(similarityWords(null)).toBeNull();
    expect(documentCount(1)).toBe("1 document");
    expect(readsAsMarkdown("text", "notes.MD")).toBe(true);
    expect(readsAsMarkdown("csv", "rows.csv")).toBe(false);
  });

  it("says what a delete takes with it", () => {
    expect(impactWords({ vectorChunks: 1, embeddings: 0, references: 2, storageFreed: null })).toBe(
      "Deleting it removes 1 stored passage, 0 search entries, 2 recorded uses. Auto won't be able to use it any more.",
    );
  });
});

describe("parsing", () => {
  it("drops rows without a whole-number id and fills safe defaults", () => {
    expect(parseDocument({ id: "7" })).toBeNull();
    expect(parseDocument({ id: 7 })).toMatchObject({ id: 7, filename: "", fileType: "unknown", status: "unknown", tags: [] });
    expect(parseDocument({ id: 7, kept_pct: 40, partial: true })).toMatchObject({ keptPercent: 40, partial: true });
  });

  it("reads search results and the upload's answer", () => {
    const answer = parseSearchAnswer(
      { results: [{ document_id: 3, excerpt: "x", similarity: 0.5, source: { filename: "a.md", file_type: "markdown" } }, { excerpt: "no id" }] },
      "q",
    );
    expect(answer).toEqual({
      query: "q",
      results: [{ documentId: 3, excerpt: "x", similarity: 0.5, filename: "a.md", fileType: "markdown" }],
    });
    expect(parseUploadResult({ filename: "a" })).toBeNull();
    expect(parseUploadResult({ document_id: 4, filename: "a.md", status: "duplicate", message: "m" })).toEqual({
      documentId: 4,
      filename: "a.md",
      status: "duplicate",
      message: "m",
    });
  });
});

describe("the upload's phases", () => {
  const answer = (status: string, message = "") => answeredPhase("a.md", { documentId: 5, filename: "a.md", status, message });

  it("moves from sending to reading once every byte is there", () => {
    expect(sendingPhase("a.md", { loaded: 3, total: 10 })).toEqual({ kind: "sending", fileName: "a.md", progress: { loaded: 3, total: 10 } });
    expect(sendingPhase("a.md", { loaded: 10, total: 10 })).toEqual({ kind: "reading", fileName: "a.md" });
    expect(phaseWords(sendingPhase("a.md", { loaded: 3, total: 10 }))).toBe("Sending a.md: 30%");
  });

  it("turns the answer into done, failed or a document to follow", () => {
    expect(answer("processed")).toMatchObject({ kind: "done", outcome: "processed" });
    expect(answer("duplicate")).toMatchObject({ kind: "done", outcome: "duplicate" });
    expect(answer("failed", "Uploaded, but processing failed: x")).toMatchObject({
      kind: "failed",
      message: "Uploaded, but processing failed: x",
    });
    expect(answer("failed")).toMatchObject({ kind: "failed", message: "Auto couldn't read it." });
    const following = answer("processing");
    expect(following).toEqual({ kind: "processing", fileName: "a.md", documentId: 5 });
    expect(waitingOn(following)).toEqual([5]);
    expect(polledPhase(following, doc(5, "processing"))).toBe(following);
    expect(polledPhase(following, doc(5, "completed"))).toMatchObject({ kind: "done", outcome: "processed" });
    expect(polledPhase(following, doc(5, "failed"))).toMatchObject({ kind: "failed" });
    expect(polledPhase(following, "gone")).toMatchObject({ kind: "failed", message: DELETED_WHILE_READING });
  });
});

describe("Auto on the Knowledge page", () => {
  const idle: UploadPhase = { kind: "idle" };
  const reading: UploadPhase = { kind: "reading", fileName: "a.md" };
  const read: UploadPhase = { kind: "done", fileName: "a.md", documentId: 1, outcome: "processed" };
  const failed: UploadPhase = { kind: "failed", fileName: "a.md", message: "no" };

  it("is away while nothing happens, reads, searches, celebrates once and says oops", () => {
    expect(knowledgeMascot({ upload: idle, searching: false, celebrated: false })).toBeNull();
    expect(knowledgeMascot({ upload: { kind: "refused", fileName: "a", reason: "r" }, searching: false, celebrated: false })).toBeNull();
    expect(knowledgeMascot({ upload: reading, searching: false, celebrated: false })).toBe("reading");
    expect(knowledgeMascot({ upload: idle, searching: true, celebrated: false })).toBe("searching");
    expect(knowledgeMascot({ upload: read, searching: false, celebrated: false })).toBe("celebrate");
    expect(knowledgeMascot({ upload: read, searching: false, celebrated: true })).toBe("idle");
    expect(knowledgeMascot({ upload: failed, searching: true, celebrated: false })).toBe("oops");
  });

  it("says what he is doing", () => {
    const activity = { upload: reading, searching: false, celebrated: false };
    expect(knowledgeCaption(activity, "reading")).toBe("Reading a.md");
    expect(knowledgeCaption({ ...activity, upload: idle, searching: true }, "searching")).toBe("Searching your documents");
  });
});
