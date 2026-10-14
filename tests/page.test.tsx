import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";
import { chatHref, chatParam, draftHref, draftParam, MAX_DRAFT_CHARS } from "@/lib/chat/params";

describe("Home page", () => {
  it("renders the chat header and the mascot column", async () => {
    render(await Home({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { level: 1, name: "New chat" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Auto" })).toHaveTextContent("Ready when you are");
  });
});

describe("Home page with a draft", () => {
  it("starts a new chat with the draft waiting in the message box (Ask Auto about this)", async () => {
    const draft = 'About my Deliverable "Laptop shortlist": ';
    render(await Home({ searchParams: Promise.resolve({ draft }) }));
    expect(screen.getByRole("heading", { level: 1, name: "New chat" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message Auto" })).toHaveValue(draft);
  });
});

describe("the chat address", () => {
  it("opens ?chat=<id>, and treats a missing, repeated or malformed id as a new chat", () => {
    expect(chatParam({ chat: "2d7e9b40-1c3a-4f5e-8b6d-9a0c1e2f3a4b" })).toBe("2d7e9b40-1c3a-4f5e-8b6d-9a0c1e2f3a4b");
    expect(chatParam({})).toBeUndefined();
    expect(chatParam({ chat: ["a", "b"] })).toBeUndefined();
    expect(chatParam({ chat: "../admin" })).toBeUndefined();
    expect(chatParam({ chat: "" })).toBeUndefined();
  });

  it("builds the link the list and the sidebar use", () => {
    expect(chatHref("c-1")).toBe("/?chat=c-1");
  });

  it("carries a draft for a new chat, cut to length and never with a conversation", () => {
    const text = 'About my Deliverable "Q3 & Q4 report": ';
    const href = draftHref(text);
    expect(href).toBe(`/?draft=${encodeURIComponent(text)}`);
    expect(draftParam(Object.fromEntries(new URLSearchParams(href.slice(2))))).toBe(text);
    expect(draftParam({ draft: "x".repeat(MAX_DRAFT_CHARS + 50) })).toHaveLength(MAX_DRAFT_CHARS);
    expect(draftParam({ draft: "hi", chat: "c-1" })).toBeUndefined();
    expect(draftParam({ draft: "  " })).toBeUndefined();
    expect(draftParam({ draft: ["a", "b"] })).toBeUndefined();
  });

  it("never cuts an emoji in half or chokes on a broken one", () => {
    expect(() => draftHref("\ud83d")).not.toThrow();
    const cut = draftHref("🙂".repeat(MAX_DRAFT_CHARS + 1));
    expect(decodeURIComponent(cut.slice("/?draft=".length))).toBe("🙂".repeat(MAX_DRAFT_CHARS));
  });
});
