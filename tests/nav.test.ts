import { describe, expect, it } from "vitest";
import { NAV_ITEMS, PHONE_TABS, isActive, phoneChrome } from "@/components/shell/nav";

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

describe("NAV_ITEMS", () => {
  it("lists Chat, Conversations, Deliverables and Look, in that order", () => {
    expect(NAV_ITEMS.map((item) => [item.label, item.href])).toEqual([
      ["Chat", "/"],
      ["Conversations", "/conversations"],
      ["Deliverables", "/deliverables"],
      ["Look", "/looks"],
    ]);
  });
});

describe("phoneChrome", () => {
  it("shows the top bar on the chat", () => {
    expect(phoneChrome("/")).toEqual({ topBar: true, tabBar: false });
  });

  it("shows the tab bar on the two lists", () => {
    expect(phoneChrome("/conversations")).toEqual({ topBar: false, tabBar: true });
    expect(phoneChrome("/deliverables")).toEqual({ topBar: false, tabBar: true });
  });

  it("shows the tab bar on the Looks page, which has a tab of its own", () => {
    expect(phoneChrome("/looks")).toEqual({ topBar: false, tabBar: true });
    expect(PHONE_TABS.map((tab) => tab.href)).toEqual(["/conversations", "/deliverables", "/looks"]);
  });

  it("shows neither on a detail page or an unknown route", () => {
    expect(phoneChrome("/deliverables/abc")).toEqual({ topBar: false, tabBar: false });
    expect(phoneChrome("/nope")).toEqual({ topBar: false, tabBar: false });
  });
});
