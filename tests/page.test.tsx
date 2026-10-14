import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";
import { chatHref, chatParam } from "@/lib/chat/params";

describe("Home page", () => {
  it("renders the chat header and the mascot column", async () => {
    render(await Home({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { level: 1, name: "New chat" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Auto" })).toHaveTextContent("Ready when you are");
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
});
