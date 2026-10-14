// @vitest-environment node
import { describe, expect, it } from "vitest";

import { fromStoredMessages, SAVED_ERROR } from "@/lib/chat/stored";
import type { AutoMessage } from "@/lib/chat/types";
import { parseStoredMessages } from "@/lib/client/types";

// Saved messages as GET /api/chat/{id}/messages returns them (api/chat.py get_chat_messages),
// the assistant's parts as reply_parts writes them (consumers/chatbot/narration.py).
const DELIVERABLE_ID = "9b2f4c1e-7a3d-4e5f-8a90-1b2c3d4e5f60";

const SAVED = [
  { id: "m1", role: "user", parts: [{ type: "text", text: "Find me a laptop under £700" }], source: null, createdAt: "2026-10-14T09:00:00Z" },
  {
    id: "m2",
    role: "assistant",
    parts: [
      {
        type: "receipts",
        receipts: [
          { action: "Searched the web", kind: "search", status: "done", subject: "laptops", effect: "read" },
          { action: "Saved", kind: "document", status: "done", subject: "Laptop shortlist", effect: "write", link: `/deliverables/${DELIVERABLE_ID}` },
          { action: "no status, so dropped" },
        ],
      },
      { type: "reasoning", reasoning: "They want value." },
      { type: "narration", narration: "Let me look." },
      { type: "text", text: "Done! The **ASUS** is my pick." },
    ],
    source: null,
    createdAt: "2026-10-14T09:00:05Z",
  },
  { id: "m3", role: "user", parts: [{ type: "file", url: "x" }], source: null, createdAt: null },
  { id: "m4", role: "system", parts: [{ type: "text", text: "hidden" }], source: null, createdAt: null },
  {
    id: "m5",
    role: "assistant",
    parts: [{ type: "text", text: "⚠️ Auto couldn't reach the model. Try again." }],
    source: { origin: "turn_error", label: "Error", code: "model_unavailable" },
    createdAt: null,
  },
];

function reply(id: string): AutoMessage {
  const found = fromStoredMessages(parseStoredMessages(SAVED)).find((message) => message.id === id);
  if (!found || found.role !== "assistant") throw new Error(`no reply ${id}`);
  return found;
}

describe("fromStoredMessages", () => {
  it("keeps user and assistant messages in order, and skips other roles and text-less user messages", () => {
    const messages = fromStoredMessages(parseStoredMessages(SAVED));
    expect(messages.map((message) => [message.id, message.role])).toEqual([
      ["m1", "user"],
      ["m2", "assistant"],
      ["m5", "assistant"],
    ]);
    expect(messages[0]).toEqual({ id: "m1", role: "user", text: "Find me a laptop under £700" });
  });

  it("splits a saved reply into answer, reasoning, narration, receipts and its Deliverables", () => {
    const saved = reply("m2");
    expect(saved).toMatchObject({
      text: "Done! The **ASUS** is my pick.",
      reasoning: "They want value.",
      activity: [{ kind: "narration", text: "Let me look." }],
      status: "done",
      errors: [],
      tools: [],
    });
    expect(saved.receipts.map((receipt) => receipt.action)).toEqual(["Searched the web", "Saved"]);
    expect(saved.deliverables).toEqual([{ id: DELIVERABLE_ID, title: "Laptop shortlist", kind: "document" }]);
  });

  it("shows a saved turn error as an error line, without the warning sign", () => {
    expect(reply("m5")).toMatchObject({
      text: "",
      errors: ["Auto couldn't reach the model. Try again."],
      status: "failed",
    });
  });

  it("gives a saved turn error with no words the fallback sentence", () => {
    const [only] = fromStoredMessages(
      parseStoredMessages([{ id: "e", role: "assistant", parts: [], source: { origin: "turn_error" } }]),
    );
    expect(only).toMatchObject({ errors: [SAVED_ERROR], status: "failed" });
  });

  it("ignores parts of the wrong shape", () => {
    const [only] = fromStoredMessages(
      parseStoredMessages([
        { id: "x", role: "assistant", parts: [{ type: "text", text: 42 }, { type: "receipts", receipts: "no" }, "junk"], source: "old" },
      ]),
    );
    expect(only).toMatchObject({ text: "", receipts: [], status: "done" });
  });
});
