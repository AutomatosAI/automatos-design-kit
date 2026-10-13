import { describe, expect, it } from "vitest";
import { isActive, phoneChrome } from "@/components/shell/nav";

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

describe("phoneChrome", () => {
  it("shows the top bar on the chat", () => {
    expect(phoneChrome("/")).toEqual({ topBar: true, tabBar: false });
  });

  it("shows the tab bar on the two lists", () => {
    expect(phoneChrome("/conversations")).toEqual({ topBar: false, tabBar: true });
    expect(phoneChrome("/deliverables")).toEqual({ topBar: false, tabBar: true });
  });

  it("shows neither on a detail page or an unknown route", () => {
    expect(phoneChrome("/deliverables/abc")).toEqual({ topBar: false, tabBar: false });
    expect(phoneChrome("/nope")).toEqual({ topBar: false, tabBar: false });
  });
});
