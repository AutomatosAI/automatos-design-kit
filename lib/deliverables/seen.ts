// Which Deliverables this browser has already shown on the shelf, so a new one makes
// Auto celebrate once. A Deliverable is new when its id hasn't been seen and it is
// newer than the newest one seen: old rows met for the first time (a filter, Load
// more) don't count. The first visit only remembers, it doesn't celebrate.
// Kept in localStorage, which may be missing or blocked: then the shelf remembers
// for as long as it is open.

import type { Deliverable } from "@/lib/client/types";

export type SeenRecord = {
  readonly ids: readonly string[];
  /** created_at of the newest Deliverable seen (the backend's own clock and format). */
  readonly newest: string | null;
};

export const SEEN_KEY = "automatos-play:seen-deliverables";
/** The most ids kept; the newest ones win. */
export const SEEN_CAP = 500;

function time(iso: string | null): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseSeen(raw: string | null): SeenRecord | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("ids" in value) || !Array.isArray(value.ids)) return null;
    const ids = value.ids.filter((id): id is string => typeof id === "string");
    const newest = "newest" in value && typeof value.newest === "string" ? value.newest : null;
    return { ids, newest };
  } catch (error) {
    console.warn("[shelf] the seen Deliverables record was unreadable, starting again", error);
    return null;
  }
}

export function readSeen(): SeenRecord | null {
  try {
    return parseSeen(window.localStorage.getItem(SEEN_KEY));
  } catch (error) {
    console.warn("[shelf] can't read localStorage; new Deliverables are remembered only while the shelf is open", error);
    return null;
  }
}

export function writeSeen(record: SeenRecord): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn("[shelf] can't save the seen Deliverables to localStorage", error);
  }
}

/** The loaded Deliverables that count as new (none on the first visit). */
export function freshDeliverables(record: SeenRecord | null, items: readonly Deliverable[]): readonly Deliverable[] {
  const newest = time(record?.newest ?? null);
  if (!record || newest === null) return [];
  const seen = new Set(record.ids);
  return items.filter((item) => {
    const created = time(item.createdAt);
    return !seen.has(item.id) && created !== null && created > newest;
  });
}

/** The record with these Deliverables remembered. Returns the same record when nothing changes. */
export function markSeen(record: SeenRecord | null, items: readonly Deliverable[]): SeenRecord {
  const ids = record?.ids ?? [];
  const known = new Set(ids);
  const added = items.map((item) => item.id).filter((id) => !known.has(id));
  const newest = items.reduce<string | null>((best, item) => {
    const created = time(item.createdAt);
    const top = time(best);
    return created !== null && (top === null || created > top) ? item.createdAt : best;
  }, record?.newest ?? null);
  if (record && added.length === 0 && newest === record.newest) return record;
  return { ids: [...ids, ...added].slice(-SEEN_CAP), newest };
}
