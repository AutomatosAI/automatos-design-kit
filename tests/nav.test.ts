import { describe, expect, it } from "vitest";

import { NAV_ITEMS, isActive } from "@/components/shell/nav";

describe("the kit's nav (PRD-004)", () => {
  it("is Editor · Preview · Style sheet · Examples, in that order", () => {
    expect(NAV_ITEMS.map((item) => [item.label, item.href])).toEqual([
      ["Editor", "/"],
      ["Preview", "/preview"],
      ["Style sheet", "/style"],
      ["Examples", "/examples"],
    ]);
  });

  it("gives each page a tab word short enough for the phone bar", () => {
    expect(NAV_ITEMS.map((item) => item.tabLabel)).toEqual(["Editor", "Preview", "Style", "Examples"]);
    expect(new Set(NAV_ITEMS.map((item) => item.id)).size).toBe(NAV_ITEMS.length);
  });
});

describe("isActive", () => {
  it("matches the editor only on the root", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/preview")).toBe(false);
  });

  it("matches a page and its children, not lookalikes", () => {
    expect(isActive("/style", "/style")).toBe(true);
    expect(isActive("/style", "/style/colours")).toBe(true);
    expect(isActive("/style", "/styles")).toBe(false);
    expect(isActive("/examples", "/preview")).toBe(false);
  });
});
