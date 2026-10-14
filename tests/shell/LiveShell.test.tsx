import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LiveShell } from "@/components/shell/LiveShell";
import { RECENT_LIMIT } from "@/hooks/useRecentChats";
import { createApiClient } from "@/lib/client/api";
import { announceChatsChanged } from "@/lib/client/chat-events";

import { mockChatFetch } from "../chat/helpers";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/conversations") }));

function summary(n: number) {
  return { id: `c-${n}`, title: `Conversation ${n}`, createdAt: null, updatedAt: null, lastMessagePreview: null, kind: null };
}

function recentList() {
  return within(screen.getByRole("region", { name: "Recent" }));
}

function renderShell(fetchMock: ReturnType<typeof mockChatFetch>) {
  render(
    <LiveShell client={createApiClient(fetchMock)}>
      <p>page</p>
    </LiveShell>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the sidebar's Recent list", () => {
  it("shows the latest 4 conversations, each opening in the chat", async () => {
    // The route is asked for 4; a backend that sends more still shows only 4.
    const fetchMock = mockChatFetch([], {
      "/api/chat/history": () => Response.json([1, 2, 3, 4, 5].map(summary)),
    });
    renderShell(fetchMock);
    await screen.findByRole("region", { name: "Recent" });
    const links = recentList().getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Conversation 1",
      "Conversation 2",
      "Conversation 3",
      "Conversation 4",
    ]);
    expect(links[0]).toHaveAttribute("href", "/?chat=c-1");
    expect(fetchMock).toHaveBeenCalledWith(`/api/chat/history?limit=${RECENT_LIMIT}`, expect.anything());
    expect(RECENT_LIMIT).toBe(4);
  });

  it("reloads when the chat says the list changed", async () => {
    let calls = 0;
    const fetchMock = mockChatFetch([], {
      "/api/chat/history": () => {
        calls += 1;
        return Response.json(calls === 1 ? [summary(1)] : [summary(9), summary(1)]);
      },
    });
    renderShell(fetchMock);
    await screen.findByRole("link", { name: "Conversation 1" });
    act(() => announceChatsChanged());
    await waitFor(() => expect(recentList().getAllByRole("link")).toHaveLength(2));
    expect(recentList().getAllByRole("link")[0]).toHaveTextContent("Conversation 9");
  });

  it("stays empty, and logs why, when the history can't be loaded", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = mockChatFetch([], {
      "/api/chat/history": () => Response.json({ error: "down" }, { status: 502 }),
    });
    renderShell(fetchMock);
    await waitFor(() => expect(logged).toHaveBeenCalledWith(expect.stringContaining("[sidebar]"), expect.anything()));
    expect(screen.queryByRole("region", { name: "Recent" })).not.toBeInTheDocument();
  });
});
