import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatScreen } from "@/components/chat/ChatScreen";
import { createApiClient } from "@/lib/client/api";

import { callsTo, fixtureAnswer, mockChatFetch, type Routes } from "./helpers";

// Opening a saved conversation: the chat loads GET /api/chat/{id}/messages, shows it,
// and the next message continues it (the request carries its id).

const CHAT_ID = "2d7e9b40-1c3a-4f5e-8b6d-9a0c1e2f3a4b";
const MESSAGES_PATH = `/api/chat/${CHAT_ID}/messages`;

const SAVED = [
  { id: "m1", role: "user", parts: [{ type: "text", text: "Find me a laptop under £700" }], source: null, createdAt: null },
  {
    id: "m2",
    role: "assistant",
    parts: [{ type: "receipts", receipts: [] }, { type: "text", text: "Done! Three laptops make the cut." }],
    source: null,
    createdAt: null,
  },
];

function renderStored(routes: Routes) {
  const fetchMock = mockChatFetch([fixtureAnswer("plain-answer")], routes);
  const user = userEvent.setup();
  render(<ChatScreen client={createApiClient(fetchMock)} chatId={CHAT_ID} />);
  return { fetchMock, user };
}

function conversation() {
  return within(screen.getByRole("list", { name: "Conversation" }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("opening a saved conversation", () => {
  it("loads its messages into the chat, titled by its first message", async () => {
    renderStored({ [MESSAGES_PATH]: () => Response.json(SAVED) });
    expect(screen.getByRole("status")).toHaveTextContent("Opening this conversation");
    await screen.findByRole("list", { name: "Conversation" });
    expect(conversation().getByText("Find me a laptop under £700")).toBeInTheDocument();
    expect(conversation().getByText("Done! Three laptops make the cut.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Find me a laptop under £700" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("sends the conversation's id with the next message", async () => {
    const { fetchMock, user } = renderStored({ [MESSAGES_PATH]: () => Response.json(SAVED) });
    const box = await screen.findByRole("textbox", { name: "Message Auto" });
    await user.type(box, "Which has the best battery?{Enter}");

    await waitFor(() => expect(callsTo(fetchMock, "/api/chat")).toHaveLength(1));
    const [request] = callsTo(fetchMock, "/api/chat");
    expect(JSON.parse(String(request?.body))).toMatchObject({
      id: CHAT_ID,
      message: { role: "user", parts: [{ type: "text", text: "Which has the best battery?" }] },
    });
    expect(await conversation().findByText(/What shall we make today\?/)).toBeInTheDocument();
    expect(conversation().getByText("Find me a laptop under £700")).toBeInTheDocument();
    await screen.findByRole("button", { name: "Send" });
  });

  it("says when it can't open the conversation, and Try again loads it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let calls = 0;
    const { user } = renderStored({
      [MESSAGES_PATH]: () => {
        calls += 1;
        return calls === 1 ? Response.json({ detail: "Chat not found" }, { status: 404 }) : Response.json(SAVED);
      },
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Play couldn't open this conversation. Chat not found");
    expect(within(alert).getByRole("link", { name: "Start a new chat" })).toHaveAttribute("href", "/");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    await screen.findByRole("list", { name: "Conversation" });
    expect(conversation().getByText("Find me a laptop under £700")).toBeInTheDocument();
  });
});
