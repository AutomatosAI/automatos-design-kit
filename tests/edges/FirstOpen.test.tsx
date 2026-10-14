import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatScreen } from "@/components/chat/ChatScreen";
import { EXAMPLES } from "@/components/chat/FirstOpen";
import { createApiClient } from "@/lib/client/api";
import { claimFirstOpen, HELLO_KEY } from "@/lib/mascot/session";

import { fixtureAnswer, mockChatFetch } from "../chat/helpers";

// Mock 06: the empty chat. The mascot files are never there, so Auto is the
// placeholder, which names the state on screen.

function renderEmptyChat() {
  const user = userEvent.setup();
  render(<ChatScreen client={createApiClient(mockChatFetch([fixtureAnswer("plain-answer")]))} />);
  return { user, box: screen.getByRole("textbox", { name: "Message Auto" }) };
}

function hero() {
  return within(screen.getByRole("region", { name: "Say hello" }));
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("first open", () => {
  it("says hello in words, with the message box focused and three examples", () => {
    const { box } = renderEmptyChat();
    expect(hero().getByRole("heading", { level: 2, name: "Hi, I'm Auto." })).toBeInTheDocument();
    expect(hero().getByText("Your Automatos, the fun way")).toBeInTheDocument();
    expect(box).toHaveFocus();
    const examples = within(screen.getByRole("list", { name: "Examples to try" })).getAllByRole("button");
    expect(examples.map((chip) => chip.textContent)).toEqual([...EXAMPLES]);
    expect(EXAMPLES).toHaveLength(3);
  });

  it("an example fills the message box and leaves it focused, without sending", async () => {
    const { user } = renderEmptyChat();
    await user.click(screen.getByRole("button", { name: "Budget a weekend in Lisbon" }));
    const box = screen.getByRole("textbox", { name: "Message Auto" });
    expect(box).toHaveValue("Budget a weekend in Lisbon");
    expect(box).toHaveFocus();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(screen.queryByRole("list", { name: "Conversation" })).not.toBeInTheDocument();
  });

  it("plays hello on the first open in a browser session, and not again", () => {
    renderEmptyChat();
    expect(hero().getByTestId("auto-placeholder")).toHaveTextContent("hello");
    expect(window.sessionStorage.getItem(HELLO_KEY)).not.toBeNull();
  });

  it("doesn't play hello when this session has already seen it", () => {
    window.sessionStorage.setItem(HELLO_KEY, "1");
    renderEmptyChat();
    expect(hero().getByTestId("auto-placeholder")).not.toHaveTextContent("hello");
  });
});

describe("claimFirstOpen", () => {
  it("is true once per session", () => {
    expect(claimFirstOpen()).toBe(true);
    expect(claimFirstOpen()).toBe(false);
  });

  it("plays once per page load when sessionStorage is blocked, and says why in the console", () => {
    const warned = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const blocked = (): Storage => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    expect(claimFirstOpen(blocked)).toBe(true);
    expect(claimFirstOpen(blocked)).toBe(false);
    expect(warned).toHaveBeenCalledWith(expect.stringContaining("[mascot]"), expect.anything());
  });
});
