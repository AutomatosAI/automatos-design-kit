import { render, screen, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/AppShell";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/") }));

function mainNav() {
  return within(screen.getByRole("navigation", { name: "Main" }));
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("renders the four nav items by role and name", () => {
    render(<AppShell>page</AppShell>);
    const nav = mainNav();
    expect(nav.getByRole("link", { name: "Chat" })).toHaveAttribute("href", "/");
    expect(nav.getByRole("link", { name: "Conversations" })).toHaveAttribute("href", "/conversations");
    expect(nav.getByRole("link", { name: "Deliverables" })).toHaveAttribute("href", "/deliverables");
    expect(nav.getByRole("link", { name: "Look" })).toHaveAttribute("href", "/looks");
  });

  it("marks Look as the current page on the Looks page and gives phones its tab", () => {
    vi.mocked(usePathname).mockReturnValue("/looks");
    render(<AppShell>page</AppShell>);
    expect(mainNav().getByRole("link", { name: "Look" })).toHaveAttribute("aria-current", "page");
    const tabs = within(screen.getByRole("navigation", { name: "Tabs" }));
    expect(tabs.getByRole("link", { name: "Look" })).toHaveAttribute("aria-current", "page");
  });

  it("marks the current page and renders the children", () => {
    vi.mocked(usePathname).mockReturnValue("/deliverables/abc");
    render(<AppShell>page body</AppShell>);
    const nav = mainNav();
    expect(nav.getByRole("link", { name: "Deliverables" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Chat" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  it("shows the wordmark, New chat, counts, the Recent list and the connection pill", () => {
    render(
      <AppShell
        counts={{ conversations: 23, deliverables: 14 }}
        recent={[{ id: "c1", title: "Laptop for uni" }]}
        connection="connected"
        host="localhost"
      >
        page
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "New chat" })).toHaveAttribute("href", "/");
    expect(mainNav().getByRole("link", { name: /^Conversations\s+23$/ })).toBeInTheDocument();
    const recent = within(screen.getByRole("region", { name: "Recent" }));
    expect(recent.getByRole("link", { name: "Laptop for uni" })).toHaveAttribute("href", "/?chat=c1");
    expect(screen.getByRole("status")).toHaveTextContent("Connected · localhost");
  });

  it("hides the Recent list when there are no chats", () => {
    render(<AppShell>page</AppShell>);
    expect(screen.queryByRole("region", { name: "Recent" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Checking…");
  });

  it("gives the chat the phone top bar (Chats · title · Shelf)", () => {
    render(<AppShell title="Laptop for uni">page</AppShell>);
    const bar = within(screen.getByRole("banner"));
    expect(bar.getByRole("link", { name: "Chats" })).toHaveAttribute("href", "/conversations");
    expect(bar.getByText("Laptop for uni")).toBeInTheDocument();
    expect(bar.getByRole("link", { name: "Shelf" })).toHaveAttribute("href", "/deliverables");
    expect(screen.queryByRole("navigation", { name: "Tabs" })).not.toBeInTheDocument();
  });

  it("gives the lists the phone tab bar (Chats / Shelf)", () => {
    vi.mocked(usePathname).mockReturnValue("/deliverables");
    render(<AppShell>page</AppShell>);
    const tabs = within(screen.getByRole("navigation", { name: "Tabs" }));
    expect(tabs.getByRole("link", { name: "Shelf" })).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("link", { name: "Chats" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });
});
