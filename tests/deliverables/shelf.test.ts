// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseDeliverable, type Deliverable } from "@/lib/client/types";
import {
  appendPage,
  countLine,
  emptyMessage,
  kindOf,
  prependNew,
  SHELF_FILTERS,
  shelfCaption,
  shelfDate,
  typeLabel,
} from "@/lib/deliverables/shelf";

const NOW = new Date(2026, 9, 14, 15, 30);

function item(id: string): Deliverable {
  const parsed = parseDeliverable({ id, title: id });
  if (!parsed) throw new Error("bad test row");
  return parsed;
}

describe("shelf helpers", () => {
  it("maps the chips to the core's artifact_type values", () => {
    expect(SHELF_FILTERS.map((filter) => [filter.label, filter.artifactType])).toEqual([
      ["All", null],
      ["Reports", "report"],
      ["Documents", "document"],
      ["Images", "image"],
      ["Spreadsheets", "spreadsheet"],
      ["Slides", "slide"],
    ]);
  });

  it("labels types as the mock does", () => {
    expect(typeLabel("report")).toBe("Report");
    expect(typeLabel("slide")).toBe("Slides");
    expect(typeLabel("spreadsheet")).toBe("Spreadsheet");
    expect(typeLabel("constructor")).toBe("Constructor");
  });

  it("falls back to document for a missing type", () => {
    expect(kindOf({ artifactType: null })).toBe("document");
    expect(kindOf({ artifactType: " Image " })).toBe("image");
  });

  it("dates cards Today, Yesterday, by weekday, then by day and month", () => {
    expect(shelfDate(new Date(2026, 9, 14, 8).toISOString(), NOW)).toBe("Today");
    expect(shelfDate(new Date(2026, 9, 13, 8).toISOString(), NOW)).toBe("Yesterday");
    expect(shelfDate(new Date(2026, 9, 12, 8).toISOString(), NOW)).toBe("Mon");
    expect(shelfDate(new Date(2026, 9, 4, 8).toISOString(), NOW)).toBe("4 Oct");
    expect(shelfDate(null, NOW)).toBe("");
    expect(shelfDate("not a date", NOW)).toBe("");
  });

  it("appends a page without repeating rows already loaded", () => {
    const loaded = [item("a"), item("b")];
    expect(appendPage(loaded, [item("b"), item("c")]).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(loaded.map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("puts new first-page rows on top and keeps the same list when nothing is new", () => {
    const loaded = [item("b"), item("c")];
    expect(prependNew(loaded, [item("a"), item("b")]).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(prependNew(loaded, [item("b"), item("c")])).toBe(loaded);
  });

  it("words the count, the caption and the empty states", () => {
    expect(countLine(1)).toBe("1 Deliverable");
    expect(countLine(15)).toBe("15 Deliverables");
    expect(shelfCaption(null)).toBe("Fetching your shelf");
    expect(shelfCaption(0)).toBe("Your shelf is waiting");
    expect(shelfCaption(15)).toBe("15 on the shelf. Nice collection!");
    expect(emptyMessage(SHELF_FILTERS[0])).toMatch(/^Nothing on your shelf yet/);
    expect(emptyMessage(SHELF_FILTERS[3])).toBe("No images yet. Ask Auto for one and it lands here.");
  });
});
