import { describe, expect, it } from "vitest";
import {
  MORE_ITEMS,
  NAV_GROUPS,
  NAV_ITEMS,
  PHONE_TABS,
  isActive,
  isMoreActive,
  phoneChrome,
  visibleGroups,
  type NavGroup,
} from "@/components/shell/nav";

describe("isActive", () => {
  it("matches the chat only on the root", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/conversations")).toBe(false);
  });

  it("matches a section and its children, not lookalikes", () => {
    expect(isActive("/deliverables", "/deliverables")).toBe(true);
    expect(isActive("/deliverables", "/deliverables/abc")).toBe(true);
    expect(isActive("/deliverables", "/deliverables-old")).toBe(false);
  });
});

describe("NAV_GROUPS", () => {
  it("groups every page as PRD-003 lays it out, in order", () => {
    expect(NAV_GROUPS.map((group) => [group.label, group.items.map((item) => [item.label, item.href])])).toEqual([
      ["Talk", [["Chat", "/"], ["Conversations", "/conversations"]]],
      ["Work", [["Missions", "/missions"], ["Board", "/board"], ["Playbooks", "/playbooks"]]],
      ["Crew", [["Agents", "/agents"]]],
      ["Library", [["Deliverables", "/deliverables"], ["Knowledge", "/knowledge"]]],
      ["Insights", [["Analytics", "/analytics"]]],
      [null, [["Look", "/looks"]]],
    ]);
  });

  it("marks Board, Playbooks and Analytics not ready in this wave, and nothing else", () => {
    const hidden = NAV_GROUPS.flatMap((group) => group.items)
      .filter((item) => !item.ready)
      .map((item) => item.label);
    expect(hidden).toEqual(["Board", "Playbooks", "Analytics"]);
  });
});

describe("visibleGroups", () => {
  it("keeps only ready items and drops a group left empty (Insights)", () => {
    expect(visibleGroups().map((group) => [group.label, group.items.map((item) => item.label)])).toEqual([
      ["Talk", ["Chat", "Conversations"]],
      ["Work", ["Missions"]],
      ["Crew", ["Agents"]],
      ["Library", ["Deliverables", "Knowledge"]],
      [null, ["Look"]],
    ]);
  });

  it("shows an item as soon as its flag is set, without changing the groups it was given", () => {
    const allReady: readonly NavGroup[] = NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item, ready: true })),
    }));
    expect(visibleGroups(allReady).flatMap((group) => group.items).map((item) => item.label)).toEqual([
      "Chat", "Conversations", "Missions", "Board", "Playbooks", "Agents", "Deliverables", "Knowledge", "Analytics", "Look",
    ]);
    expect(NAV_GROUPS.find((group) => group.id === "work")?.items.map((item) => item.ready)).toEqual([true, false, false]);
  });
});

describe("NAV_ITEMS", () => {
  it("lists the ready pages in sidebar order", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "Chat", "Conversations", "Missions", "Agents", "Deliverables", "Knowledge", "Look",
    ]);
  });
});

describe("phone tabs and the More sheet", () => {
  it("has the tabs Chats, Missions and Shelf (More is the fourth, a button)", () => {
    expect(PHONE_TABS.map((tab) => [tab.label, tab.href])).toEqual([
      ["Chats", "/conversations"],
      ["Missions", "/missions"],
      ["Shelf", "/deliverables"],
    ]);
  });

  it("puts the remaining ready pages and Look in More", () => {
    expect(MORE_ITEMS.map((item) => [item.label, item.href])).toEqual([
      ["Agents", "/agents"],
      ["Knowledge", "/knowledge"],
      ["Look", "/looks"],
    ]);
  });

  it("reads More as current on its pages and their details", () => {
    expect(isMoreActive("/agents")).toBe(true);
    expect(isMoreActive("/looks/style")).toBe(true);
    expect(isMoreActive("/missions")).toBe(false);
    expect(isMoreActive("/")).toBe(false);
  });
});

describe("phoneChrome", () => {
  it("shows the top bar on the chat", () => {
    expect(phoneChrome("/")).toEqual({ topBar: true, tabBar: false });
  });

  it("shows the tab bar on every list page and the Looks page", () => {
    for (const path of ["/conversations", "/deliverables", "/missions", "/agents", "/knowledge", "/looks"]) {
      expect({ path, chrome: phoneChrome(path) }).toEqual({ path, chrome: { topBar: false, tabBar: true } });
    }
  });

  it("is ready for wave 4's lists before their nav items show", () => {
    for (const path of ["/board", "/playbooks", "/analytics"]) {
      expect({ path, chrome: phoneChrome(path) }).toEqual({ path, chrome: { topBar: false, tabBar: true } });
    }
  });

  it("shows neither on a detail page or an unknown route", () => {
    for (const path of ["/deliverables/abc", "/missions/m-1", "/agents/7", "/knowledge/doc-1", "/looks/style", "/nope"]) {
      expect({ path, chrome: phoneChrome(path) }).toEqual({ path, chrome: { topBar: false, tabBar: false } });
    }
  });
});
