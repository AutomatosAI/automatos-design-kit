// The Deliverables shelf (mock 04) as pure data: the filter chips, type labels,
// the card date, paging merges and the count line.

import type { Deliverable } from "@/lib/client/types";
import { DEFAULT_KIND } from "@/lib/chat/deliverables";
import { groupOf, relativeTime } from "@/lib/conversations/list";
import { POLL_INTERVALS } from "@/lib/poll/intervals";

/** One page of the shelf (the core's default). */
export const SHELF_PAGE_SIZE = 24;
/** How often the open shelf checks for new Deliverables: a list, so POLL_INTERVALS.LIST. */
export const SHELF_REFRESH_MS = POLL_INTERVALS.LIST;

export type ShelfFilter = {
  readonly label: string;
  /** The list's artifact_type; null for All. */
  readonly artifactType: string | null;
};

export const ALL_FILTER: ShelfFilter = { label: "All", artifactType: null };

export const SHELF_FILTERS: readonly ShelfFilter[] = [
  ALL_FILTER,
  { label: "Reports", artifactType: "report" },
  { label: "Documents", artifactType: "document" },
  { label: "Images", artifactType: "image" },
  { label: "Spreadsheets", artifactType: "spreadsheet" },
  { label: "Slides", artifactType: "slide" },
];

/** Badge words that aren't the type with a capital (mock 04 says "Slides"). */
const KIND_LABELS: Readonly<Record<string, string>> = { slide: "Slides" };

export function kindOf(deliverable: Pick<Deliverable, "artifactType">): string {
  const kind = deliverable.artifactType?.trim().toLowerCase();
  return kind ? kind : DEFAULT_KIND;
}

/** "Report", "Slides", "Spreadsheet". */
export function typeLabel(kind: string): string {
  if (Object.hasOwn(KIND_LABELS, kind)) return KIND_LABELS[kind] ?? kind;
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** "Today", "Yesterday", "Mon", "4 Oct"; "" when the date is missing or unreadable. */
export function shelfDate(createdAt: string | null, now: Date): string {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return groupOf(date, now) === "Today" ? "Today" : relativeTime(date, now);
}

/** A later page after the loaded ones; anything already loaded is dropped (new rows shift offsets). */
export function appendPage(loaded: readonly Deliverable[], page: readonly Deliverable[]): readonly Deliverable[] {
  const known = new Set(loaded.map((item) => item.id));
  return [...loaded, ...page.filter((item) => !known.has(item.id))];
}

/** The first page again: rows not loaded yet go on top, newest first. */
export function prependNew(loaded: readonly Deliverable[], firstPage: readonly Deliverable[]): readonly Deliverable[] {
  const known = new Set(loaded.map((item) => item.id));
  const fresh = firstPage.filter((item) => !known.has(item.id));
  return fresh.length === 0 ? loaded : [...fresh, ...loaded];
}

/** "1 Deliverable", "15 Deliverables". */
export function countLine(total: number): string {
  return `${total} ${total === 1 ? "Deliverable" : "Deliverables"}`;
}

/** What Auto says over the shelf while he idles. */
export function shelfCaption(total: number | null): string {
  if (total === null) return "Fetching your shelf";
  if (total === 0) return "Your shelf is waiting";
  if (total === 1) return "Your first Deliverable!";
  return `${total} on the shelf. Nice collection!`;
}

export function emptyMessage(filter: ShelfFilter): string {
  if (filter.artifactType === null) {
    return "Nothing on your shelf yet. Ask Auto for a report or a document and it lands here.";
  }
  return `No ${filter.label.toLowerCase()} yet. Ask Auto for one and it lands here.`;
}
