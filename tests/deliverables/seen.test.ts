import { afterEach, describe, expect, it, vi } from "vitest";

import { parseDeliverable, type Deliverable } from "@/lib/client/types";
import {
  freshDeliverables,
  markSeen,
  parseSeen,
  readSeen,
  SEEN_CAP,
  SEEN_KEY,
  type SeenRecord,
  writeSeen,
} from "@/lib/deliverables/seen";

function item(id: string, createdAt: string | null): Deliverable {
  const parsed = parseDeliverable({ id, title: id, created_at: createdAt });
  if (!parsed) throw new Error("bad test row");
  return parsed;
}

const OLD = item("old", "2026-10-10T09:00:00+00:00");
const NEW = item("new", "2026-10-14T09:00:00+00:00");

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("seen Deliverables", () => {
  it("counts nothing as new on the first visit", () => {
    expect(freshDeliverables(null, [NEW, OLD])).toEqual([]);
  });

  it("counts an unseen Deliverable newer than the newest seen", () => {
    const record: SeenRecord = { ids: ["old"], newest: OLD.createdAt };
    expect(freshDeliverables(record, [NEW, OLD])).toEqual([NEW]);
  });

  it("doesn't count an unseen Deliverable older than the newest seen, or one without a date", () => {
    const record: SeenRecord = { ids: ["new"], newest: NEW.createdAt };
    expect(freshDeliverables(record, [OLD, item("undated", null)])).toEqual([]);
  });

  it("doesn't count one already seen", () => {
    const record: SeenRecord = { ids: ["new", "old"], newest: OLD.createdAt };
    expect(freshDeliverables(record, [NEW])).toEqual([]);
  });

  it("remembers ids and the newest date without changing the old record", () => {
    const record: SeenRecord = { ids: ["old"], newest: OLD.createdAt };
    const after = markSeen(record, [NEW, OLD]);
    expect(after).toEqual({ ids: ["old", "new"], newest: NEW.createdAt });
    expect(record).toEqual({ ids: ["old"], newest: OLD.createdAt });
    expect(markSeen(after, [OLD])).toBe(after);
  });

  it("keeps only the newest ids past the cap", () => {
    const many = Array.from({ length: SEEN_CAP + 5 }, (_, index) => item(`d-${index}`, null));
    const after = markSeen(null, many);
    expect(after.ids).toHaveLength(SEEN_CAP);
    expect(after.ids[0]).toBe("d-5");
    expect(after.newest).toBeNull();
  });

  it("reads back what it wrote, and ignores junk", () => {
    writeSeen({ ids: ["a"], newest: NEW.createdAt });
    expect(window.localStorage.getItem(SEEN_KEY)).not.toBeNull();
    expect(readSeen()).toEqual({ ids: ["a"], newest: NEW.createdAt });
    expect(parseSeen(JSON.stringify({ ids: ["a", 3], newest: 7 }))).toEqual({ ids: ["a"], newest: null });
    expect(parseSeen(JSON.stringify({ nope: true }))).toBeNull();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(parseSeen("{not json")).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("carries on, with a warning, when localStorage is blocked", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(readSeen()).toBeNull();
    expect(() => writeSeen({ ids: [], newest: null })).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
