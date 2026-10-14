// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ChatSummary } from "@/lib/client/types";
import {
  conversationTitle,
  filterByTitle,
  groupConversations,
  groupOf,
  lastActive,
  previewLine,
  relativeTime,
} from "@/lib/conversations/list";

// Local dates throughout, so the tests pass in any time zone.
const NOW = new Date(2026, 9, 14, 15, 30); // Wed 14 Oct 2026, 15:30

function chat(id: string, at: Date | null, extra: Partial<ChatSummary> = {}): ChatSummary {
  const iso = at ? at.toISOString() : null;
  return { id, title: `Chat ${id}`, createdAt: iso, updatedAt: iso, lastMessagePreview: null, kind: null, ...extra };
}

describe("groupOf", () => {
  it("is Today for the same calendar day, even just after midnight", () => {
    expect(groupOf(new Date(2026, 9, 14, 0, 1), NOW)).toBe("Today");
    expect(groupOf(new Date(2026, 9, 14, 15, 29), NOW)).toBe("Today");
  });

  it("is This week for the six days before today, Earlier after that", () => {
    expect(groupOf(new Date(2026, 9, 13, 23, 59), NOW)).toBe("This week");
    expect(groupOf(new Date(2026, 9, 8, 9, 0), NOW)).toBe("This week");
    expect(groupOf(new Date(2026, 9, 7, 23, 0), NOW)).toBe("Earlier");
  });

  it("puts a conversation with no date in Earlier, and a clock-skewed future one in Today", () => {
    expect(groupOf(null, NOW)).toBe("Earlier");
    expect(groupOf(new Date(2026, 9, 15, 9, 0), NOW)).toBe("Today");
  });
});

describe("groupConversations", () => {
  it("groups in mock order, keeps the history's order inside a group and drops empty groups", () => {
    const chats = [
      chat("a", new Date(2026, 9, 14, 15, 28)),
      chat("b", new Date(2026, 9, 13, 10, 0)),
      chat("c", new Date(2026, 9, 1, 10, 0)),
      chat("d", new Date(2026, 9, 12, 10, 0)),
      chat("e", new Date(2026, 9, 14, 9, 0)),
    ];
    const groups = groupConversations(chats, NOW);
    expect(groups.map((group) => [group.label, group.chats.map((c) => c.id)])).toEqual([
      ["Today", ["a", "e"]],
      ["This week", ["b", "d"]],
      ["Earlier", ["c"]],
    ]);
    expect(groupConversations([chat("c", new Date(2026, 9, 1, 10, 0))], NOW).map((group) => group.label)).toEqual(["Earlier"]);
    expect(groupConversations([], NOW)).toEqual([]);
  });

  it("dates a conversation by its last activity, falling back to when it began", () => {
    const moved = chat("a", new Date(2026, 8, 1), { updatedAt: new Date(2026, 9, 14, 12, 0).toISOString() });
    expect(groupConversations([moved], NOW)[0]?.label).toBe("Today");
    const old = chat("b", new Date(2026, 8, 1), { updatedAt: null });
    expect(lastActive(old)?.getMonth()).toBe(8);
    expect(lastActive(chat("c", null, { updatedAt: "not a date" }))).toBeNull();
  });
});

describe("relativeTime", () => {
  it("counts minutes and hours today", () => {
    expect(relativeTime(new Date(2026, 9, 14, 15, 29, 40), NOW)).toBe("Just now");
    expect(relativeTime(new Date(2026, 9, 14, 15, 28), NOW)).toBe("2 min");
    expect(relativeTime(new Date(2026, 9, 14, 12, 0), NOW)).toBe("3 h");
  });

  it("says Yesterday, then the weekday, then the date", () => {
    expect(relativeTime(new Date(2026, 9, 13, 22, 0), NOW)).toBe("Yesterday");
    expect(relativeTime(new Date(2026, 9, 12, 9, 0), NOW)).toBe("Mon");
    expect(relativeTime(new Date(2026, 9, 11, 9, 0), NOW)).toBe("Sun");
    expect(relativeTime(new Date(2026, 9, 9, 9, 0), NOW)).toBe("Fri");
    expect(relativeTime(new Date(2026, 9, 7, 9, 0), NOW)).toBe("7 Oct");
    expect(relativeTime(new Date(2025, 11, 24, 9, 0), NOW)).toBe("24 Dec 2025");
  });

  it("is empty when the date is unknown", () => {
    expect(relativeTime(null, NOW)).toBe("");
  });
});

describe("titles, previews and search", () => {
  it("names an untitled conversation and tidies white space", () => {
    expect(conversationTitle(chat("a", NOW, { title: "  " }))).toBe("New chat");
    expect(conversationTitle(chat("a", NOW, { title: "Laptop\n for  uni" }))).toBe("Laptop for uni");
  });

  it("starts the preview with who said it, and has none for an empty conversation", () => {
    expect(previewLine(chat("a", NOW, { lastMessagePreview: "Done! Three laptops make the cut." }))).toBe(
      "Auto: Done! Three laptops make the cut.",
    );
    expect(previewLine(chat("a", NOW, { lastMessagePreview: "  " }))).toBeNull();
    expect(previewLine(chat("a", NOW))).toBeNull();
  });

  it("filters by title, ignoring case and surrounding spaces", () => {
    const chats = [
      chat("a", NOW, { title: "Laptop for uni" }),
      chat("b", NOW, { title: "Revision plan for chemistry", lastMessagePreview: "laptop" }),
    ];
    expect(filterByTitle(chats, "  LAPTOP ").map((c) => c.id)).toEqual(["a"]);
    expect(filterByTitle(chats, "for").map((c) => c.id)).toEqual(["a", "b"]);
    expect(filterByTitle(chats, "")).toBe(chats);
    expect(filterByTitle(chats, "lisbon")).toEqual([]);
  });
});
