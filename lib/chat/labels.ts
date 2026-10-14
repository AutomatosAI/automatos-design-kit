// Tool lines and receipts in words (mocks 01 and 02): "Searching the web: '…'" while a
// tool runs, "Searched the web · 3 results · 2.1 s" when it is done. Tool names stay in
// lib/mascot/tools.ts: a label comes from the tool's activity, or from its name made
// readable, so a tool the backend adds tomorrow still gets a sensible line.

import { toolActivity, type ToolActivity } from "@/lib/mascot/tools";
import type { JsonObject, Receipt } from "@/lib/stream/types";

import type { ToolLine, ToolStatus } from "./types";

/** running and waiting are bronze, done mint, failed coral, skipped and stopped muted. */
export type LineTone = "running" | "done" | "failed" | "waiting" | "muted";

export type ToolLineLabel = {
  /** A text mark before the words; null while running (the line shows a spinner). */
  readonly mark: string | null;
  readonly text: string;
  readonly tone: LineTone;
};

export type ReceiptLabel = {
  readonly mark: string;
  readonly text: string;
  readonly tone: LineTone;
  /** A tag after the words: "Done" on a write that went through. */
  readonly badge: string | null;
  /** Why it was refused or skipped, on its own line. */
  readonly reason: string | null;
};

export const MARK_DONE = "✓";
export const MARK_FAILED = "✕";
export const MARK_WAITING = "…";
export const MARK_MUTED = "–";
const SEP = " · ";
const DETAIL_KEYS = ["query", "q", "url", "title", "name", "filename", "path"] as const;
const DETAIL_CHARS = 80;
const PLATFORM_PREFIX = /^platform_/;
const LOOKED_UP = "looked up";

type Phrases = { readonly running: string; readonly done: string; readonly failed: string };

function readable(toolName: string): string {
  return toolName.replace(PLATFORM_PREFIX, "").replace(/_+/g, " ").trim() || "a tool";
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function phrases(activity: ToolActivity, toolName: string): Phrases {
  if (activity === "searching") {
    return { running: "Searching the web", done: "Searched the web", failed: "The web search didn't work" };
  }
  if (activity === "reading") {
    return {
      running: "Looking through your files",
      done: "Looked through your files",
      failed: "Couldn't look through your files",
    };
  }
  const name = readable(toolName);
  return { running: `Using ${name}`, done: `Used ${name}`, failed: `${capitalise(name)} didn't work` };
}

function clip(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 1).trimEnd()}…`;
}

/** What the call is about, from its input: the search query, the page, the title. */
export function toolDetail(input: JsonObject): string | null {
  for (const key of DETAIL_KEYS) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return clip(value, DETAIL_CHARS);
  }
  return null;
}

/** "2.1 s" from 2140 ms. */
export function formatDuration(ms: number | null): string | null {
  if (ms === null || ms < 0) return null;
  return `${(ms / 1000).toFixed(1)} s`;
}

function joined(parts: readonly (string | null)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(SEP);
}

const TONES: Readonly<Record<ToolStatus, LineTone>> = {
  running: "running",
  done: "done",
  failed: "failed",
  waiting: "waiting",
  skipped: "muted",
  stopped: "muted",
};

const MARKS: Readonly<Record<ToolStatus, string | null>> = {
  running: null,
  done: MARK_DONE,
  failed: MARK_FAILED,
  waiting: MARK_WAITING,
  skipped: MARK_MUTED,
  stopped: MARK_MUTED,
};

function toolText(tool: ToolLine, said: Phrases): string {
  const detail = toolDetail(tool.input);
  const seconds = formatDuration(tool.durationMs);
  switch (tool.status) {
    case "running":
      return detail ? `${said.running}: '${detail}'` : said.running;
    case "done":
      return joined([said.done, tool.summary, seconds]);
    case "failed":
      return joined([said.failed, tool.error ?? tool.summary]);
    case "waiting":
      return joined(["Waiting for you", tool.summary]);
    case "skipped":
      return joined([`Skipped: ${said.running.toLowerCase()}`, tool.summary]);
    case "stopped":
      return `Stopped: ${said.running.toLowerCase()}`;
  }
}

/** "The web search didn't work.": a failed call in a sentence, for the snag box. */
export function failedToolSentence(tool: ToolLine): string {
  return `${phrases(toolActivity(tool.toolName), tool.toolName).failed}.`;
}

export function toolLineLabel(tool: ToolLine): ToolLineLabel {
  const said = phrases(toolActivity(tool.toolName), tool.toolName);
  return { mark: MARKS[tool.status], text: toolText(tool, said), tone: TONES[tool.status] };
}

/** "Searched the web: bikes", "Document made: Laptop shortlist", "Read your documents". */
function receiptText(receipt: Receipt): string {
  const activity = toolActivity(receipt.action);
  const lookup = receipt.kind === "read" && receipt.effect === LOOKED_UP;
  const said = lookup && activity !== "working" ? phrases(activity, receipt.action).done : capitalise(receipt.effect.trim());
  const what = said || capitalise(readable(receipt.action));
  const subject = receipt.subject.trim();
  const repeats = !subject || what.toLowerCase().includes(subject.toLowerCase());
  return repeats ? what : `${what}: ${subject}`;
}

function receiptBadge(receipt: Receipt): string | null {
  if (receipt.status === "waiting") return "Waiting for you";
  if (receipt.status === "refused") return "Not done";
  if (receipt.status === "skipped") return "Skipped";
  return receipt.kind === "write" ? "Done" : null;
}

const RECEIPT_LOOK: Readonly<Record<Receipt["status"], { readonly mark: string; readonly tone: LineTone }>> = {
  done: { mark: MARK_DONE, tone: "done" },
  refused: { mark: MARK_FAILED, tone: "failed" },
  skipped: { mark: MARK_MUTED, tone: "muted" },
  waiting: { mark: MARK_WAITING, tone: "waiting" },
};

export function receiptLabel(receipt: Receipt): ReceiptLabel {
  const look = RECEIPT_LOOK[receipt.status];
  return {
    ...look,
    text: receiptText(receipt),
    badge: receiptBadge(receipt),
    reason: receipt.status === "refused" || receipt.status === "skipped" ? receipt.reason : null,
  };
}
