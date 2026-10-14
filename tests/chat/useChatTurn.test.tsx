import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CANCEL_FAILED, STREAM_BROKE, useChatTurn } from "@/hooks/useChatTurn";
import { createApiClient, type Fetch } from "@/lib/client/api";

import type { FixtureName } from "../stream/helpers";
import {
  callsTo,
  type ChatAnswer,
  FIXTURE_CHAT_ID,
  fixtureAnswer,
  hangingAnswer,
  lastReply,
  mockChatFetch,
  WORKSPACE,
} from "./helpers";

// The hook driven end to end through createApiClient and a mocked fetch: the
// fixtures stream in random chunks, and the mascot reducer gets every event.

function renderTurn(fetchMock: ReturnType<typeof mockChatFetch>) {
  const client = createApiClient(fetchMock);
  return renderHook(() => useChatTurn({ client }));
}

async function sendFixture(name: FixtureName) {
  const fetchMock = mockChatFetch([fixtureAnswer(name)]);
  const view = renderTurn(fetchMock);
  await act(async () => {
    await view.result.current.send("hello");
  });
  return { ...view, fetchMock };
}

function bodyOf(init: RequestInit): unknown {
  return JSON.parse(String(init.body));
}

const HANGING = hangingAnswer([`d:{"type":"chat-id","chatId":"chat-9"}`, `0:"Working on it"`]);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useChatTurn with the fixtures", () => {
  it("plain answer: the user's message, Auto's text, the chat-id, idle", async () => {
    const { result } = await sendFixture("plain-answer");
    const [you, reply] = result.current.messages;
    expect(you).toMatchObject({ role: "user", text: "hello" });
    expect(reply).toMatchObject({
      role: "assistant",
      text: "Hi! I'm Auto, your Automatos. What shall we make today? A report, a café menu — anything 🎉",
      tools: [],
      receipts: [],
      errors: [],
      status: "done",
    });
    expect(result.current.chatId).toBe(FIXTURE_CHAT_ID);
    expect(result.current.streaming).toBe(false);
    expect(result.current.mascot.mascot).toBe("idle");
    expect(result.current.mascot.turnActive).toBe(false);
  });

  it("web search: a finished tool line, the receipts once, then celebrate", async () => {
    const { result } = await sendFixture("web-search");
    const reply = lastReply(result.current.messages);
    expect(reply.tools).toEqual([
      {
        toolCallId: "call_ws_01",
        toolName: "platform_web_search",
        input: { query: "electric bikes 2026" },
        status: "done",
        success: true,
        durationMs: 2140,
        summary: "3 results",
        error: null,
      },
    ]);
    expect(reply.text).toBe("I found three good options. The **Volt One** leads on range, and the Cargo Pro on price.");
    expect(reply.receipts).toHaveLength(1);
    expect(reply.receipts[0]).toMatchObject({ action: "platform_web_search", status: "done" });
    expect(reply.status).toBe("done");
    expect(result.current.mascot.mascot).toBe("celebrate");
  });

  it("error turn: the error in words, a failed reply, oops", async () => {
    const { result } = await sendFixture("error-turn");
    const reply = lastReply(result.current.messages);
    expect(reply.errors).toEqual(["Auto's model is not available: the provider returned 503."]);
    expect(reply.status).toBe("failed");
    expect(reply.reasoning).toBe("The user wants a summary.");
    expect(result.current.streaming).toBe(false);
    expect(result.current.mascot.mascot).toBe("oops");
  });

  it("ask: a waiting tool line and receipt, listening", async () => {
    const { result } = await sendFixture("ask-waiting");
    const reply = lastReply(result.current.messages);
    expect(reply.tools[0]).toMatchObject({ toolName: "platform_update_agent", status: "waiting", success: false });
    expect(reply.tools[0]?.summary).toContain("Nothing changes until the owner clicks.");
    expect(reply.receipts.map((receipt) => receipt.status)).toEqual(["waiting"]);
    expect(reply.text).toBe("I've raised a card to rename Scout. Nothing changes until you click it.");
    expect(result.current.mascot.mascot).toBe("listening");
  });

  it("reasoning and narration: narration leaves the answer, progress joins the activity", async () => {
    const { result } = await sendFixture("reasoning-narration");
    const reply = lastReply(result.current.messages);
    expect(reply.text).toBe("Onboarding has three steps:\n\n1. Create the workspace\n2. Add an agent\n3. Start a Mission");
    expect(reply.activity).toEqual([
      { kind: "narration", text: "Let me look through your documents first." },
      { kind: "progress", text: "Searching 12 documents" },
    ]);
    expect(reply.reasoning).toBe("They want the onboarding steps. I should check their documents.Found the checklist.");
    expect(reply.tools[0]).toMatchObject({ toolName: "platform_search_documents", status: "done", durationMs: 860 });
    expect(result.current.mascot.mascot).toBe("celebrate");
  });
});

describe("useChatTurn requests", () => {
  it("sends the request body with the workspace, then the chat-id on the next message", async () => {
    const fetchMock = mockChatFetch([fixtureAnswer("plain-answer")]);
    const { result } = renderTurn(fetchMock);
    await act(async () => {
      await result.current.send("  hello  ");
    });
    await act(async () => {
      await result.current.send("and again");
    });

    const [first, second] = callsTo(fetchMock, "/api/chat");
    if (!first || !second) throw new Error("expected two turns");
    expect(bodyOf(first)).toEqual({
      id: "",
      message: { role: "user", parts: [{ type: "text", text: "hello" }] },
      selectedVisibilityType: "private",
    });
    expect(bodyOf(second)).toMatchObject({ id: FIXTURE_CHAT_ID, message: { parts: [{ text: "and again" }] } });
    expect(new Headers(first.headers).get("X-Workspace-ID")).toBe(WORKSPACE.id);
    expect(new Headers(first.headers).get("Authorization")).toBeNull();
    expect(first.method).toBe("POST");
    expect(result.current.messages).toHaveLength(4);
  });

  it("sends nothing for an empty message", async () => {
    const fetchMock = mockChatFetch([fixtureAnswer("plain-answer")]);
    const { result } = renderTurn(fetchMock);
    let sent = true;
    await act(async () => {
      sent = await result.current.send("   ");
    });
    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("runs one turn at a time", async () => {
    const fetchMock = mockChatFetch([HANGING]);
    const { result } = renderTurn(fetchMock);
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.send("first");
    });
    await waitFor(() => expect(lastReply(result.current.messages).text).toBe("Working on it"));
    expect(result.current.streaming).toBe(true);

    let second = true;
    await act(async () => {
      second = await result.current.send("second");
    });
    expect(second).toBe(false);
    expect(callsTo(fetchMock, "/api/chat")).toHaveLength(1);
    expect(result.current.messages).toHaveLength(2);

    await act(async () => {
      await result.current.stop();
      await pending;
    });
  });
});

describe("useChatTurn stop()", () => {
  it("cancels the turn on the backend and aborts the fetch", async () => {
    const fetchMock = mockChatFetch([HANGING]);
    const { result } = renderTurn(fetchMock);
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.send("write me a long report");
    });
    await waitFor(() => expect(result.current.chatId).toBe("chat-9"));
    await waitFor(() => expect(lastReply(result.current.messages).text).toBe("Working on it"));
    expect(result.current.mascot.turnActive).toBe(true);

    await act(async () => {
      await result.current.stop();
      await pending;
    });

    const [cancel] = callsTo(fetchMock, "/api/chat/chat-9/cancel");
    expect(cancel?.method).toBe("POST");
    expect(callsTo(fetchMock, "/api/chat")[0]?.signal?.aborted).toBe(true);
    const reply = lastReply(result.current.messages);
    expect(reply).toMatchObject({ text: "Working on it", status: "stopped", errors: [] });
    expect(result.current.streaming).toBe(false);
    expect(result.current.mascot.mascot).toBe("idle");
    expect(result.current.mascot.turnActive).toBe(false);
  });

  it("still aborts when the cancel call fails, and says so", async () => {
    const base = mockChatFetch([HANGING]);
    const fetchMock = vi.fn<Fetch>(async (input, init) => {
      if (input.endsWith("/cancel")) return Response.json({ detail: "boom" }, { status: 500 });
      return base(input, init);
    });
    const { result } = renderHook(() => useChatTurn({ client: createApiClient(fetchMock) }));
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.send("hello");
    });
    await waitFor(() => expect(lastReply(result.current.messages).text).toBe("Working on it"));

    await act(async () => {
      await result.current.stop();
      await pending;
    });

    const reply = lastReply(result.current.messages);
    expect(reply.status).toBe("stopped");
    expect(reply.notices).toEqual([CANCEL_FAILED]);
    expect(console.error).toHaveBeenCalled();
  });

  it("before the chat-id arrives there is nothing to cancel: it only aborts", async () => {
    const fetchMock = mockChatFetch([hangingAnswer([`0:"Hi"`])]);
    const { result } = renderTurn(fetchMock);
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.send("hello");
    });
    await waitFor(() => expect(lastReply(result.current.messages).text).toBe("Hi"));

    await act(async () => {
      await result.current.stop();
      await pending;
    });

    expect(fetchMock.mock.calls.some(([input]) => input.endsWith("/cancel"))).toBe(false);
    expect(callsTo(fetchMock, "/api/chat")[0]?.signal?.aborted).toBe(true);
    expect(lastReply(result.current.messages).status).toBe("stopped");
  });

  it("a send right after stop waits for the cancel, so it can't cancel the new turn", async () => {
    const base = mockChatFetch([HANGING, fixtureAnswer("plain-answer")]);
    const release = { cancel: (): void => undefined };
    const fetchMock = vi.fn<Fetch>(async (input, init) => {
      if (input.endsWith("/cancel")) {
        await new Promise<void>((resolve) => {
          release.cancel = () => resolve();
        });
      }
      return base(input, init);
    });
    const { result } = renderTurn(fetchMock);
    let first: Promise<boolean> = Promise.resolve(false);
    act(() => {
      first = result.current.send("first");
    });
    await waitFor(() => expect(lastReply(result.current.messages).text).toBe("Working on it"));

    let stopping: Promise<void> = Promise.resolve();
    await act(async () => {
      stopping = result.current.stop();
      await first;
    });
    await waitFor(() => expect(callsTo(fetchMock, "/api/chat/chat-9/cancel")).toHaveLength(1));
    let second: Promise<boolean> = Promise.resolve(false);
    act(() => {
      second = result.current.send("second");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(callsTo(fetchMock, "/api/chat")).toHaveLength(1);

    await act(async () => {
      release.cancel();
      await stopping;
      await second;
    });
    expect(callsTo(fetchMock, "/api/chat")).toHaveLength(2);
    expect(lastReply(result.current.messages).status).toBe("done");
  });

  it("does nothing when no turn is running", async () => {
    const fetchMock = mockChatFetch([fixtureAnswer("plain-answer")]);
    const { result } = renderTurn(fetchMock);
    await act(async () => {
      await result.current.stop();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useChatTurn failures", () => {
  it("Automatos not running: the proxy's message, and Auto sleeps", async () => {
    const down: ChatAnswer = {
      kind: "status",
      status: 502,
      body: { error: "Automatos isn't running at http://localhost:8000" },
    };
    const { result } = renderTurn(mockChatFetch([down]));
    await act(async () => {
      await result.current.send("hello");
    });
    const reply = lastReply(result.current.messages);
    expect(reply.errors).toEqual(["Automatos isn't running at http://localhost:8000"]);
    expect(reply.status).toBe("failed");
    expect(result.current.streaming).toBe(false);
    expect(result.current.mascot.mascot).toBe("sleeping");
    expect(result.current.mascot.backendDown).toBe(true);
  });

  it("a stream that breaks mid-answer keeps the text, says so, and shows oops", async () => {
    const broken: ChatAnswer = { ...HANGING, hang: false, failWith: new Error("socket hang up") };
    const { result } = renderTurn(mockChatFetch([broken]));
    await act(async () => {
      await result.current.send("hello");
    });
    const reply = lastReply(result.current.messages);
    expect(reply.text).toBe("Working on it");
    expect(reply.errors).toEqual([STREAM_BROKE]);
    expect(reply.status).toBe("failed");
    expect(result.current.mascot.mascot).toBe("oops");
    expect(result.current.mascot.turnActive).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("a body that ends without finish still ends the turn", async () => {
    const cut: ChatAnswer = { ...HANGING, hang: false };
    const { result } = renderTurn(mockChatFetch([cut]));
    await act(async () => {
      await result.current.send("hello");
    });
    expect(lastReply(result.current.messages).status).toBe("done");
    expect(result.current.mascot.turnActive).toBe(false);
  });
});
