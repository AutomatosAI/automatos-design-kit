import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConversationsScreen, NO_CONVERSATIONS } from "@/components/conversations/ConversationsScreen";
import { CONVERSATION_LIMIT } from "@/hooks/useConversations";
import { createApiClient } from "@/lib/client/api";

import { mockChatFetch, type Routes } from "../chat/helpers";

// The Conversations page over a mocked GET /api/chat/history (shape: api/chat.py
// get_chat_history). "Now" is pinned to a local date, so it passes in any time zone.

const NOW = new Date(2026, 9, 14, 15, 30);

function at(day: number, hour: number, minute = 0): string {
  return new Date(2026, 9, day, hour, minute).toISOString();
}

const HISTORY = [
  { id: "c-laptop", title: "Laptop for uni", createdAt: at(14, 9), updatedAt: at(14, 15, 28), visibility: "private", lastMessagePreview: "Done! Three laptops make the cut.", kind: null },
  { id: "c-chem", title: "Revision plan for chemistry", createdAt: at(13, 9), updatedAt: at(13, 18), visibility: "private", lastMessagePreview: "Week 1 covers bonding and moles.", kind: null },
  { id: "c-bake", title: "Instagram captions for the bake sale", createdAt: at(12, 9), updatedAt: at(12, 10), visibility: "private", lastMessagePreview: null, kind: null },
  { id: "c-cafe", title: "Cover letter for the café job", createdAt: at(9, 9), updatedAt: at(1, 10), visibility: "private", lastMessagePreview: "I tightened the opening line.", kind: null },
];

function renderList(routes: Routes) {
  const fetchMock = mockChatFetch([], routes);
  const user = userEvent.setup();
  render(<ConversationsScreen client={createApiClient(fetchMock)} now={NOW} />);
  return { fetchMock, user };
}

const historyRoute = (body: unknown = HISTORY, status = 200): Routes => ({
  "/api/chat/history": () => Response.json(body, { status }),
});

function group(name: string) {
  return within(screen.getByRole("region", { name }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConversationsScreen", () => {
  it("groups the history into Today, This week and Earlier", async () => {
    const { fetchMock } = renderList(historyRoute());
    expect(screen.getByRole("status")).toHaveTextContent("Loading your conversations");
    await screen.findByRole("region", { name: "Today" });

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Today",
      "This week",
      "Earlier",
    ]);
    expect(group("Today").getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/?chat=c-laptop"]);
    expect(group("This week").getAllByRole("link")).toHaveLength(2);
    expect(group("Earlier").getByRole("link")).toHaveAccessibleName(/Cover letter for the café job/);
    expect(fetchMock).toHaveBeenCalledWith(`/api/chat/history?limit=${CONVERSATION_LIMIT}`, expect.anything());
  });

  it("shows each conversation's title, relative time and last line", async () => {
    renderList(historyRoute());
    const laptop = await screen.findByRole("link", { name: /Laptop for uni/ });
    expect(laptop).toHaveTextContent("2 min");
    expect(laptop).toHaveTextContent("Auto: Done! Three laptops make the cut.");
    expect(group("This week").getByRole("link", { name: /Revision plan/ })).toHaveTextContent("Yesterday");
    const bake = group("This week").getByRole("link", { name: /bake sale/ });
    expect(bake).toHaveTextContent("Mon");
    expect(bake).not.toHaveTextContent("Auto:");
    expect(group("Earlier").getByRole("link")).toHaveTextContent("1 Oct");
  });

  it("filters by title as you type, and says when nothing matches", async () => {
    const { user } = renderList(historyRoute());
    await screen.findByRole("link", { name: /Laptop for uni/ });
    const search = screen.getByRole("searchbox", { name: "Search conversations" });

    await user.type(search, "LAPTOP");
    expect(screen.getAllByRole("link", { name: /for/ })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Laptop for uni/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "This week" })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "lisbon");
    expect(screen.queryByRole("link", { name: /Laptop/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No conversation titles match “lisbon”/)).toBeInTheDocument();

    await user.clear(search);
    expect(screen.getAllByRole("region")).toHaveLength(3);
  });

  it("has a New chat button that starts one", async () => {
    renderList(historyRoute());
    expect(screen.getByRole("link", { name: "New chat" })).toHaveAttribute("href", "/");
    await screen.findByRole("region", { name: "Today" });
  });

  it("says so when there are no conversations yet", async () => {
    renderList(historyRoute([]));
    expect(await screen.findByText(NO_CONVERSATIONS)).toBeInTheDocument();
  });

  it("shows a friendly error with Try again when the history fails, then loads on retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let calls = 0;
    const { user } = renderList({
      "/api/chat/history": () => {
        calls += 1;
        return calls === 1
          ? Response.json({ error: "Automatos isn't running at http://localhost:8000" }, { status: 502 })
          : Response.json(HISTORY);
      },
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Play couldn't load your conversations. Automatos isn't running");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Laptop for uni/ })).toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
  });
});
