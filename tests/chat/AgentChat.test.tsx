import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatScreen } from "@/components/chat/ChatScreen";
import { HELLO_TITLE } from "@/components/chat/FirstOpen";
import { createApiClient } from "@/lib/client/api";
import { HELLO_KEY } from "@/lib/mascot/session";

import { callsTo, FIXTURE_CHAT_ID, fixtureAnswer, mockChatFetch, type Routes } from "./helpers";

// P-008: "Chat with <name>" opens a new chat (/?agent=<id>) that sends agentId with every
// message (chat-stream.md) and says who you're talking to.

const RAE = { id: 7, name: "Researcher Rae", status: "active", configuration: { runtime: "api" } };

const routes: Routes = { "/api/agents/7": () => Response.json(RAE) };

function sentBody(init: RequestInit): Readonly<Record<string, unknown>> {
  return JSON.parse(String(init.body)) as Readonly<Record<string, unknown>>;
}

/** Sends one message and waits until its turn has ended (Stop has gone back to Send). */
async function send(
  user: ReturnType<typeof userEvent.setup>,
  box: HTMLElement,
  text: string,
  chatCalls: () => number,
) {
  const before = chatCalls();
  await user.type(box, `${text}{Enter}`);
  await waitFor(() => expect(chatCalls()).toBe(before + 1));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument());
  await screen.findByRole("button", { name: "Send" });
}

beforeEach(() => {
  window.sessionStorage.setItem(HELLO_KEY, "1");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a chat with another agent", () => {
  it("says who you're talking to", async () => {
    render(<ChatScreen client={createApiClient(mockChatFetch([fixtureAnswer("plain-answer")], routes))} agentId={7} />);
    expect(await screen.findByText("Talking to Researcher Rae")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chat with Researcher Rae" })).toBeInTheDocument();
    expect(screen.queryByText(HELLO_TITLE)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message Researcher Rae" })).toBeInTheDocument();
  });

  it("sends agentId with each message", async () => {
    const fetchMock = mockChatFetch([fixtureAnswer("plain-answer")], routes);
    const user = userEvent.setup();
    render(<ChatScreen client={createApiClient(fetchMock)} agentId={7} />);
    await screen.findByText("Talking to Researcher Rae");
    const box = screen.getByRole("textbox", { name: "Message Researcher Rae" });

    const chatCalls = () => callsTo(fetchMock, "/api/chat").length;
    await send(user, box, "Find three sources", chatCalls);
    await send(user, box, "And a fourth", chatCalls);

    await waitFor(() => expect(callsTo(fetchMock, "/api/chat")).toHaveLength(2));
    const [first, second] = callsTo(fetchMock, "/api/chat").map(sentBody);
    expect(first).toMatchObject({ id: "", agentId: 7 });
    expect(second).toMatchObject({ id: FIXTURE_CHAT_ID, agentId: 7 });
    expect(screen.getByText("Talking to Researcher Rae")).toBeInTheDocument();
  });

  it("says the agent's number when its name can't be loaded", async () => {
    const failing: Routes = { "/api/agents/7": () => Response.json({ detail: "Agent not found" }, { status: 404 }) };
    const fetchMock = mockChatFetch([fixtureAnswer("plain-answer")], failing);
    render(<ChatScreen client={createApiClient(fetchMock)} agentId={7} />);
    await waitFor(() => expect(callsTo(fetchMock, "/api/agents/7")).toHaveLength(1));
    expect(screen.getByText("Talking to agent 7")).toBeInTheDocument();
    await waitFor(() => expect(console.error).toHaveBeenCalled());
  });
});

describe("a chat with Auto", () => {
  it("sends no agentId and has no Talking to line", async () => {
    const fetchMock = mockChatFetch([fixtureAnswer("plain-answer")]);
    const user = userEvent.setup();
    render(<ChatScreen client={createApiClient(fetchMock)} />);
    const chatCalls = () => callsTo(fetchMock, "/api/chat").length;
    await send(user, screen.getByRole("textbox", { name: "Message Auto" }), "hello", chatCalls);

    const [body] = callsTo(fetchMock, "/api/chat").map(sentBody);
    expect(body).not.toHaveProperty("agentId");
    expect(screen.queryByText(/^Talking to/)).not.toBeInTheDocument();
  });
});
