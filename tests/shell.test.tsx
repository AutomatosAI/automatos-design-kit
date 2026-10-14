import { render, screen, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/shell/AppShell";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/") }));

const PAGES = [
  ["Editor", "/"],
  ["Preview", "/preview"],
  ["Style sheet", "/style"],
  ["Examples", "/examples"],
] as const;

function mainNav() {
  return within(screen.getByRole("navigation", { name: "Main" }));
}

function tabs() {
  return within(screen.getByRole("navigation", { name: "Tabs" }));
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("names the kit and links its four pages, in order", () => {
    render(<AppShell>page</AppShell>);
    expect(screen.getByRole("link", { name: "Automatos Skin Kit" })).toHaveAttribute("href", "/");
    const links = mainNav().getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(PAGES.map((page) => [...page]));
  });

  it("carries none of the retired pages", () => {
    render(<AppShell>page</AppShell>);
    for (const name of ["Chat", "Conversations", "Missions", "Agents", "Deliverables", "Knowledge", "New chat"]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("gives phones a tab bar with the same four pages", () => {
    render(<AppShell>page</AppShell>);
    expect(tabs().getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(PAGES.map(([, href]) => href));
    expect(tabs().getByRole("link", { name: "Style" })).toHaveAttribute("href", "/style");
  });

  it("marks the current page in the sidebar and the tab bar, and renders the children", () => {
    vi.mocked(usePathname).mockReturnValue("/style");
    render(<AppShell>page body</AppShell>);
    expect(mainNav().getByRole("link", { name: "Style sheet" })).toHaveAttribute("aria-current", "page");
    expect(mainNav().getByRole("link", { name: "Editor" })).not.toHaveAttribute("aria-current");
    expect(tabs().getByRole("link", { name: "Style" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  it("marks only the editor on the root", () => {
    render(<AppShell>page</AppShell>);
    const current = mainNav()
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["Editor"]);
  });
});
