import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatScreen } from "@/components/chat/ChatScreen";
import { snagLines, SNAG_TITLE } from "@/lib/chat/snag";
import { autoMessage } from "@/lib/chat/turn";
import type { AutoMessage, ToolLine } from "@/lib/chat/types";
import { createApiClient } from "@/lib/client/api";
import { HELLO_KEY } from "@/lib/mascot/session";

import { callsTo, type ChatAnswer, fixtureAnswer, hangingAnswer, mockChatFetch } from "../chat/helpers";

// Mock 08: a turn that ends on an e: line, or with a failed tool, shows the snag box
// with the error in words and Try again, and Auto shows oops.

const CHAT = `d:{"type":"chat-id","chatId":"chat-9"}`;
const FAILED_SEARCH = [
  CHAT,
  `d:{"type": "tool-start", "data": {"toolCallId": "c1", "toolName": "platform_web_search", "input": {"query": "Lisbon weather"}}}`,
  `d:{"type": "tool-end", "data": {"toolCallId": "c1", "toolName": "platform_web_search", "success": false, "error": "timeout", "durationMs": 10000}}`,
  `d:{"type":"finish","finishReason":"stop"}`,
];

function renderChat(answers: readonly ChatAnswer[]) {
  const fetchMock = mockChatFetch(answers);
  const user = userEvent.setup();
  render(<ChatScreen client={createApiClient(fetchMock)} />);
  return { fetchMock, user, box: screen.getByRole("textbox", { name: "Message Auto" }) };
}

beforeEach(() => {
  window.sessionStorage.setItem(HELLO_KEY, "1");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the snag box", () => {
  it("an e: line shows the error in words, Try again, and Auto's oops", async () => {
    const { user, box } = renderChat([fixtureAnswer("error-turn")]);
    await user.type(box, "sum up my notes{Enter}");
    const snag = await screen.findByRole("region", { name: SNAG_TITLE });
    expect(within(snag).getByRole("heading", { name: SNAG_TITLE })).toBeInTheDocument();
    expect(snag).toHaveTextContent("Auto's model is not available: the provider returned 503.");
    expect(within(snag).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Auto" })).toHaveTextContent("Something went wrong");
    expect(screen.getByTestId("auto-placeholder")).toHaveTextContent("oops");
  });

  it("Try again sends the same message again", async () => {
    const { user, box, fetchMock } = renderChat([fixtureAnswer("error-turn"), fixtureAnswer("plain-answer")]);
    await user.type(box, "sum up my notes{Enter}");
    const snag = await screen.findByRole("region", { name: SNAG_TITLE });
    await user.click(within(snag).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(callsTo(fetchMock, "/api/chat")).toHaveLength(2));
    const resent = JSON.parse(String(callsTo(fetchMock, "/api/chat")[1]?.body)) as {
      message: { parts: { text: string }[] };
    };
    expect(resent.message.parts[0]?.text).toBe("sum up my notes");
    expect(await screen.findByText(/What shall we make today\?/)).toBeInTheDocument();
    await screen.findByRole("button", { name: "Send" });
    // Only the newest reply offers Try again.
    expect(screen.queryAllByRole("button", { name: "Try again" })).toHaveLength(0);
  });

  it("a failed tool shows the box once the turn is over", async () => {
    const { user, box } = renderChat([{ ...hangingAnswer(FAILED_SEARCH), hang: false }]);
    await user.type(box, "Lisbon weather next weekend?{Enter}");
    const snag = await screen.findByRole("region", { name: SNAG_TITLE });
    expect(snag).toHaveTextContent("The web search didn't work.");
    expect(screen.getByRole("list", { name: "Tools Auto used" })).toHaveTextContent("The web search didn't work");
  });
});

function tool(status: ToolLine["status"]): ToolLine {
  return {
    toolCallId: `t-${status}`,
    toolName: "platform_web_search",
    input: {},
    status,
    success: status === "done",
    durationMs: null,
    summary: null,
    error: null,
  };
}

describe("snagLines", () => {
  const reply: AutoMessage = { ...autoMessage("r1"), status: "done" };

  it("is empty for a good reply, while Auto is still answering, and for an answer you stopped", () => {
    expect(snagLines({ ...reply, tools: [tool("done")] })).toEqual([]);
    expect(snagLines({ ...reply, status: "stopped", tools: [tool("failed")] })).toEqual([]);
    expect(snagLines({ ...reply, status: "streaming", errors: ["x"], tools: [tool("failed")] })).toEqual([]);
  });

  it("prefers the errors in words, else one sentence per kind of failed tool", () => {
    expect(snagLines({ ...reply, status: "failed", errors: ["The model is down."] })).toEqual(["The model is down."]);
    expect(snagLines({ ...reply, tools: [tool("failed"), { ...tool("failed"), toolCallId: "t2" }] })).toEqual([
      "The web search didn't work.",
    ]);
  });
});
