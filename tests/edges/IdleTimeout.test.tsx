import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatScreen } from "@/components/chat/ChatScreen";
import { IDLE_MS, useIdleTimeout } from "@/hooks/useIdleTimeout";
import { NAPPING } from "@/lib/chat/caption";
import { createApiClient } from "@/lib/client/api";
import { HELLO_KEY } from "@/lib/mascot/session";

import { fixtureAnswer, mockChatFetch } from "../chat/helpers";

// Three minutes without input sends Auto to sleep; any input wakes him.

describe("useIdleTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires after 3 minutes without input, and any input after that wakes", () => {
    const onIdle = vi.fn();
    const onActive = vi.fn();
    renderHook(() => useIdleTimeout(onIdle, onActive));
    expect(IDLE_MS).toBe(180_000);

    act(() => {
      vi.advanceTimersByTime(IDLE_MS - 1);
    });
    expect(onIdle).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onIdle).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(window);
    expect(onActive).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "a" });
    expect(onActive).toHaveBeenCalledTimes(1);
  });

  it("input before the timeout starts the 3 minutes again", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(onIdle, vi.fn()));
    act(() => {
      vi.advanceTimersByTime(IDLE_MS - 1000);
    });
    fireEvent.keyDown(window, { key: "a" });
    act(() => {
      vi.advanceTimersByTime(IDLE_MS - 1000);
    });
    expect(onIdle).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});

describe("Auto naps on the chat", () => {
  beforeEach(() => {
    window.sessionStorage.setItem(HELLO_KEY, "1");
  });

  it("goes to sleeping after the idle time and wakes on any input", async () => {
    const user = userEvent.setup();
    render(<ChatScreen client={createApiClient(mockChatFetch([fixtureAnswer("plain-answer")]))} idleMs={60} />);
    await user.type(screen.getByRole("textbox", { name: "Message Auto" }), "hello{Enter}");
    await screen.findByRole("button", { name: "Send" });
    const auto = screen.getByRole("complementary", { name: "Auto" });

    expect(await screen.findByText(NAPPING)).toBeInTheDocument();
    expect(screen.getByTestId("auto-placeholder")).toHaveTextContent("sleeping");

    fireEvent.pointerDown(document.body);
    expect(auto).not.toHaveTextContent(NAPPING);
    expect(screen.getByTestId("auto-placeholder")).not.toHaveTextContent("sleeping");
  });
});
