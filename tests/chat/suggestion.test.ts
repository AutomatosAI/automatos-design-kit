// @vitest-environment node
import { describe, expect, it } from "vitest";

import { complexityWords, contextMessages, CONTEXT_MESSAGES_KEPT, suggestedMission } from "@/lib/chat/suggestion";
import { autoMessage, userMessage } from "@/lib/chat/turn";
import type { AutoMessage, ChatMessage } from "@/lib/chat/types";

// The request a chat suggestion starts (missions.md, "From a chat suggestion to a Mission").

const GOAL = "Research three electric bike makers and write a comparison report";

function reply(id: string, text: string, suggests = false): AutoMessage {
  return {
    ...autoMessage(id),
    text,
    status: "done",
    missionSuggestion: suggests ? { goal: GOAL, complexity: "organ" } : null,
  };
}

/** n exchanges: you-1, auto-1, you-2, auto-2, … */
function conversation(exchanges: number): readonly ChatMessage[] {
  return Array.from({ length: exchanges }, (_, index) => [
    userMessage(`you-${index + 1}`, `question ${index + 1}`),
    reply(`auto-${index + 1}`, `answer ${index + 1}`),
  ]).flat();
}

describe("complexityWords", () => {
  it("puts organ and organism in Studio's words", () => {
    expect(complexityWords("organ")).toBe("Multi-step");
    expect(complexityWords("organism")).toBe("Complex, several agents");
  });

  it("keeps an unknown value as sent, and none as null", () => {
    expect(complexityWords("cell")).toBe("cell");
    expect(complexityWords("constructor")).toBe("constructor");
    expect(complexityWords(null)).toBeNull();
    expect(complexityWords("")).toBeNull();
  });
});

describe("contextMessages", () => {
  it("keeps the newest five as {role, content}, oldest first", () => {
    const messages = conversation(4);
    expect(CONTEXT_MESSAGES_KEPT).toBe(5);
    expect(contextMessages(messages, "auto-4")).toEqual([
      { role: "assistant", content: "answer 2" },
      { role: "user", content: "question 3" },
      { role: "assistant", content: "answer 3" },
      { role: "user", content: "question 4" },
      { role: "assistant", content: "answer 4" },
    ]);
  });

  it("stops at the suggesting reply, so later messages are not its context", () => {
    expect(contextMessages(conversation(3), "auto-1")).toEqual([
      { role: "user", content: "question 1" },
      { role: "assistant", content: "answer 1" },
    ]);
  });

  it("leaves out messages with no text", () => {
    const messages = [userMessage("you-1", "  hello  "), reply("auto-1", "")];
    expect(contextMessages(messages, "auto-1")).toEqual([{ role: "user", content: "hello" }]);
  });
});

describe("suggestedMission", () => {
  const messages = [userMessage("you-1", GOAL), reply("auto-1", "I can run that as a Mission.", true)];

  it("is the documented body: the goal, source chat, the chat id and the last messages", () => {
    expect(suggestedMission(messages, "auto-1", "chat-9")).toEqual({
      goal: GOAL,
      config: {
        source: "chat",
        chat_id: "chat-9",
        context_messages: [
          { role: "user", content: GOAL },
          { role: "assistant", content: "I can run that as a Mission." },
        ],
      },
    });
  });

  it("leaves chat_id out when the chat has no id yet", () => {
    const request = suggestedMission(messages, "auto-1", "");
    expect(request?.config).not.toHaveProperty("chat_id");
    expect(request?.config).toHaveProperty("source", "chat");
  });

  it("is null for a reply without a suggestion, a user message or an unknown id", () => {
    const plain = [...messages, reply("auto-2", "no suggestion here")];
    expect(suggestedMission(plain, "auto-2", "chat-9")).toBeNull();
    expect(suggestedMission(plain, "you-1", "chat-9")).toBeNull();
    expect(suggestedMission(plain, "missing", "chat-9")).toBeNull();
  });

  it("never changes the messages it reads", () => {
    const frozen = Object.freeze(messages.map((message) => Object.freeze({ ...message })));
    expect(() => suggestedMission(frozen, "auto-1", "chat-9")).not.toThrow();
  });
});
