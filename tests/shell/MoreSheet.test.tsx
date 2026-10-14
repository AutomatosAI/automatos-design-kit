import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/shell/AppShell";

// P-001: the phone's More sheet. A modal dialog with the pages that have no tab, and Look.

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/missions") }));

function moreButton() {
  return within(screen.getByRole("navigation", { name: "Tabs" })).getByRole("button", { name: "More" });
}

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(moreButton());
  return screen.getByRole("dialog", { name: "More" });
}

describe("the More sheet", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/missions");
  });

  it("is closed until More is pressed", () => {
    render(<AppShell>page</AppShell>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(moreButton()).toHaveAttribute("aria-expanded", "false");
    expect(moreButton()).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("opens as a modal dialog listing the remaining ready pages and Look", async () => {
    const user = userEvent.setup();
    render(<AppShell>page</AppShell>);
    const sheet = await openSheet(user);
    expect(sheet).toHaveAttribute("aria-modal", "true");
    expect(moreButton()).toHaveAttribute("aria-expanded", "true");
    expect(moreButton()).toHaveAttribute("aria-controls", sheet.id);
    const links = within(sheet).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Agents", "/agents"],
      ["Knowledge", "/knowledge"],
      ["Look", "/looks"],
    ]);
    for (const name of ["Board", "Playbooks", "Analytics", "Missions", "Shelf", "Chats"]) {
      expect(within(sheet).queryByRole("link", { name })).not.toBeInTheDocument();
    }
  });

  it("moves focus into the sheet, onto the first page", async () => {
    const user = userEvent.setup();
    render(<AppShell>page</AppShell>);
    const sheet = await openSheet(user);
    expect(within(sheet).getByRole("link", { name: "Agents" })).toHaveFocus();
  });

  it("closes on Escape and returns focus to More", async () => {
    const user = userEvent.setup();
    render(<AppShell>page</AppShell>);
    await openSheet(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(moreButton()).toHaveFocus();
    expect(moreButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes from its Close button and returns focus to More", async () => {
    const user = userEvent.setup();
    render(<AppShell>page</AppShell>);
    const sheet = await openSheet(user);
    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(moreButton()).toHaveFocus();
  });

  it("keeps Tab and Shift+Tab inside the sheet", async () => {
    const user = userEvent.setup();
    render(<AppShell>page</AppShell>);
    const sheet = await openSheet(user);
    const close = within(sheet).getByRole("button", { name: "Close" });
    const look = within(sheet).getByRole("link", { name: "Look" });
    await user.tab();
    expect(within(sheet).getByRole("link", { name: "Knowledge" })).toHaveFocus();
    await user.tab();
    expect(look).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(look).toHaveFocus();
    for (let step = 0; step < 6; step += 1) {
      await user.tab();
      expect(sheet).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("marks the current page inside the sheet and More in the tab bar", async () => {
    vi.mocked(usePathname).mockReturnValue("/knowledge");
    const user = userEvent.setup();
    render(<AppShell>page</AppShell>);
    expect(moreButton()).toHaveAttribute("data-current", "true");
    const sheet = await openSheet(user);
    expect(within(sheet).getByRole("link", { name: "Knowledge" })).toHaveAttribute("aria-current", "page");
    expect(within(sheet).getByRole("link", { name: "Agents" })).not.toHaveAttribute("aria-current");
  });

  it("closes when the page changes underneath it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AppShell>page</AppShell>);
    await openSheet(user);
    vi.mocked(usePathname).mockReturnValue("/agents");
    rerender(<AppShell>agents</AppShell>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
