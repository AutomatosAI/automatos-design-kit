// One Deliverable's page (mock 05) as pure data: how its content shows, the date and
// "Made by" lines, and the words "Ask Auto about this" puts in a new chat.

import { UNTITLED } from "@/lib/chat/deliverables";
import type { Deliverable } from "@/lib/client/types";

import { rawFilePath } from "./file";
import { kindOf, shelfDate } from "./shelf";

/** File types read as markdown; any other text file shows verbatim in a code block. */
const MARKDOWN_TYPES: ReadonlySet<string> = new Set(["", "md", "markdown", "mdx", "txt", "text"]);
/**
 * Files the core serves as bytes (_BINARY_EXTENSIONS in services/deliverable_service.py).
 * Their inline content is the bytes read as UTF-8, so it is never shown as text.
 */
const BINARY_TYPES: ReadonlySet<string> = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "tif", "tiff",
  "pdf", "docx", "xlsx", "pptx", "zip", "tar", "gz",
  "mp4", "mp3", "wav", "ogg", "webm", "mov", "mkv",
]);
const CODE_LANGUAGE = /^[a-z0-9]{1,16}$/;
const MIN_FENCE = 3;
/** Nouns for "Play can't preview this …" where the type word doesn't read as one. */
const KIND_NOUNS: Readonly<Record<string, string>> = { slide: "slide deck" };
/** The longest title "Ask Auto about this" quotes. */
export const ASK_TITLE_CHARS = 120;

export type ContentView =
  /** Markdown (or a text file wrapped as a code block) for components/chat/Markdown. */
  | { readonly kind: "text"; readonly markdown: string; readonly truncated: boolean }
  | { readonly kind: "empty" }
  | { readonly kind: "image" }
  /** Nothing to show here. download: whether its file can be downloaded instead. */
  | { readonly kind: "unavailable"; readonly reason: "unsupported" | "unreadable"; readonly download: boolean };

/** Whether the Deliverable has a file Play can hand over (the file route's rule). */
export function hasFile(deliverable: Pick<Deliverable, "previewUrl">): boolean {
  return rawFilePath(deliverable.previewUrl) !== null;
}

function fileTypeOf(deliverable: Pick<Deliverable, "fileType">): string {
  return (deliverable.fileType ?? "").trim().toLowerCase().replace(/^\./, "");
}

/** The text in a code fence longer than any run of backticks inside it, so it can't close early. */
export function fenced(text: string, language: string): string {
  // reduce, not Math.max(...runs): a 1 MB file can hold more runs than a call takes arguments.
  const longest = (text.match(/`+/g) ?? []).reduce((most, run) => Math.max(most, run.length), 0);
  const fence = "`".repeat(Math.max(MIN_FENCE, longest + 1));
  const info = CODE_LANGUAGE.test(language) ? language : "";
  return `${fence}${info}\n${text}\n${fence}`;
}

export function contentView(deliverable: Deliverable): ContentView {
  const download = hasFile(deliverable);
  if (kindOf(deliverable) === "image") {
    return download ? { kind: "image" } : { kind: "unavailable", reason: "unsupported", download };
  }
  const fileType = fileTypeOf(deliverable);
  const { content } = deliverable;
  if (content !== null && !BINARY_TYPES.has(fileType)) {
    if (!content.trim()) return { kind: "empty" };
    const markdown = MARKDOWN_TYPES.has(fileType) ? content : fenced(content, fileType);
    return { kind: "text", markdown, truncated: deliverable.contentTruncated };
  }
  const unreadable = content === null && deliverable.contentError !== null && !BINARY_TYPES.has(fileType);
  return { kind: "unavailable", reason: unreadable ? "unreadable" : "unsupported", download };
}

/** "Play can't preview this spreadsheet here." */
export function unsupportedMessage(kind: string): string {
  const noun = Object.hasOwn(KIND_NOUNS, kind) ? (KIND_NOUNS[kind] ?? kind) : kind;
  return `Play can't preview this ${noun} here.`;
}

export function detailTitle(deliverable: Pick<Deliverable, "title">): string {
  return deliverable.title.trim() || UNTITLED;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/** "Today, 15:42", "Mon, 09:05", "4 Oct, 18:30"; "" when the date is missing or unreadable. */
export function detailDate(createdAt: string | null, now: Date): string {
  const day = shelfDate(createdAt, now);
  if (!day || !createdAt) return "";
  const date = new Date(createdAt);
  return `${day}, ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

function agentOf(agentName: string | null): string | null {
  const agent = agentName?.trim();
  return agent && agent.toLowerCase() !== "auto" ? agent : null;
}

/** The "Made by" value in the side panel: the agent, else Auto. */
export function madeBy(agentName: string | null): string {
  return agentOf(agentName) ?? "Auto";
}

/** The line under the title: "Made by Auto with Researcher", or "Made by Auto". */
export function madeLine(agentName: string | null): string {
  const agent = agentOf(agentName);
  return agent ? `Made by Auto with ${agent}` : "Made by Auto";
}

/** What "Ask Auto about this" puts in the new chat's message box; a very long title is cut, not the words around it. */
export function askAboutText(title: string): string {
  const chars = Array.from(title);
  const shown = chars.length > ASK_TITLE_CHARS ? `${chars.slice(0, ASK_TITLE_CHARS - 1).join("").trimEnd()}…` : title;
  return `About my Deliverable "${shown}": `;
}
