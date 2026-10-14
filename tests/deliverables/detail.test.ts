import { describe, expect, it } from "vitest";

import { parseDeliverable, type Deliverable } from "@/lib/client/types";
import {
  ASK_TITLE_CHARS,
  askAboutText,
  contentView,
  detailDate,
  detailTitle,
  fenced,
  madeBy,
  madeLine,
  unsupportedMessage,
} from "@/lib/deliverables/detail";
import { rawFilePath } from "@/lib/deliverables/file";

const WS = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const RAW = `/api/workspaces/${WS}/files/raw?path=outputs%2Fa%20b.pdf`;

function deliverable(fields: Record<string, unknown>): Deliverable {
  const parsed = parseDeliverable({ id: "d1", title: "Plan", ...fields });
  if (!parsed) throw new Error("not a Deliverable");
  return parsed;
}

describe("rawFilePath", () => {
  it("rebuilds a workspace raw-file path, encoding the file path again", () => {
    expect(rawFilePath(RAW)).toBe(`/api/workspaces/${WS}/files/raw?path=outputs%2Fa%20b.pdf`);
  });

  it("refuses anything that isn't the raw route on the backend", () => {
    expect(rawFilePath(null)).toBeNull();
    expect(rawFilePath(`/api/workspaces/${WS}/files/content?path=notes.md`)).toBeNull();
    expect(rawFilePath(`/api/workspaces/${WS}/files/raw`)).toBeNull();
    expect(rawFilePath("https://evil.example/api/workspaces/w/files/raw?path=x")).toBeNull();
    expect(rawFilePath("//evil.example/api/workspaces/w/files/raw?path=x")).toBeNull();
    expect(rawFilePath(`/api/workspaces/${WS}/files/raw/../../../admin?path=x`)).toBeNull();
    expect(rawFilePath("/api/workspaces/a.b/files/raw?path=x")).toBeNull();
  });
});

describe("contentView", () => {
  it("reads markdown and plain text as markdown", () => {
    expect(contentView(deliverable({ file_type: "md", content: "# Hi" }))).toEqual({
      kind: "text",
      markdown: "# Hi",
      truncated: false,
    });
    expect(contentView(deliverable({ file_type: null, artifact_type: "blog_post", content: "Hello" }))).toMatchObject({
      kind: "text",
      markdown: "Hello",
    });
  });

  it("wraps any other text file in a code block, and says when it was cut", () => {
    expect(contentView(deliverable({ file_type: "csv", content: "a,b", content_truncated: true }))).toEqual({
      kind: "text",
      markdown: "```csv\na,b\n```",
      truncated: true,
    });
  });

  it("shows an image from its file, and never a binary file's bytes as text", () => {
    expect(contentView(deliverable({ artifact_type: "image", preview_url: RAW }))).toEqual({ kind: "image" });
    expect(contentView(deliverable({ file_type: "pdf", preview_url: RAW, content: "%PDF-1.7 �" }))).toEqual({
      kind: "unavailable",
      reason: "unsupported",
      download: true,
    });
  });

  it("can't preview an image or file it has no raw file for", () => {
    expect(contentView(deliverable({ artifact_type: "image", preview_url: null }))).toEqual({
      kind: "unavailable",
      reason: "unsupported",
      download: false,
    });
    expect(contentView(deliverable({ artifact_type: "video" }))).toMatchObject({ reason: "unsupported", download: false });
  });

  it("says when Automatos couldn't read a text file, and when it is empty", () => {
    expect(contentView(deliverable({ file_type: "md", content: null, content_error: "File not found" }))).toMatchObject({
      kind: "unavailable",
      reason: "unreadable",
    });
    expect(contentView(deliverable({ file_type: "md", content: "  \n" }))).toEqual({ kind: "empty" });
  });
});

describe("fenced", () => {
  it("uses a fence longer than any backtick run inside, so the content can't close it", () => {
    expect(fenced("a ```` b", "md")).toBe("`````md\na ```` b\n`````");
  });

  it("drops a file type that isn't a plain language name", () => {
    expect(fenced("x", "c++ <b>")).toBe("```\nx\n```");
  });
});

describe("the page's words", () => {
  const now = new Date(2026, 9, 14, 16, 0);

  it("dates it with the day and the time", () => {
    expect(detailDate(new Date(2026, 9, 14, 15, 42).toISOString(), now)).toBe("Today, 15:42");
    expect(detailDate(new Date(2026, 9, 4, 9, 5).toISOString(), now)).toBe("4 Oct, 09:05");
    expect(detailDate(null, now)).toBe("");
    expect(detailDate("not a date", now)).toBe("");
  });

  it("credits the agent with Auto, or Auto alone", () => {
    expect(madeLine("Researcher")).toBe("Made by Auto with Researcher");
    expect(madeLine(null)).toBe("Made by Auto");
    expect(madeLine("auto")).toBe("Made by Auto");
    expect(madeBy("Researcher")).toBe("Researcher");
    expect(madeBy("  ")).toBe("Auto");
  });

  it("asks Auto about it by title, and names an untitled one", () => {
    expect(askAboutText("Laptop shortlist")).toBe('About my Deliverable "Laptop shortlist": ');
    const long = askAboutText("x".repeat(ASK_TITLE_CHARS + 10));
    expect(long).toBe(`About my Deliverable "${"x".repeat(ASK_TITLE_CHARS - 1)}…": `);
    expect(detailTitle({ title: "  " })).toBe("Your Deliverable");
  });

  it("says which type can't be previewed", () => {
    expect(unsupportedMessage("spreadsheet")).toBe("Play can't preview this spreadsheet here.");
    expect(unsupportedMessage("slide")).toBe("Play can't preview this slide deck here.");
  });
});
