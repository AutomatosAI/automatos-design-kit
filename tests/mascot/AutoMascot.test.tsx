import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutoMascot } from "@/components/mascot/AutoMascot";

// The files in public/auto/ are never in CI: these tests fire the media events by hand.

const SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");

function preferReducedMotion(matches: boolean): void {
  const matchMedia = vi.fn((media: string) => ({
    matches,
    media,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: matchMedia });
}

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: userAgent });
}

function stillOf(container: HTMLElement): HTMLImageElement {
  const image = container.querySelector("img");
  if (!image) throw new Error("no still");
  return image;
}

function videoOf(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector("video");
  if (!video) throw new Error("no video");
  return video;
}

/** Puts the clip on screen at a time (in seconds) of its 5 s, then fires timeupdate. */
function playTo(video: HTMLVideoElement, seconds: number): void {
  Object.defineProperty(video, "duration", { configurable: true, value: 5 });
  Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: seconds });
  fireEvent.timeUpdate(video);
}

const ring = () => screen.getByTestId("auto-stage").getAttribute("data-ring");
const glow = () => screen.getByTestId("auto-stage").getAttribute("data-glow");

const silenceWarnings = () => vi.spyOn(console, "warn").mockImplementation(() => undefined);

afterEach(() => {
  if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
  else Reflect.deleteProperty(window, "matchMedia");
  Reflect.deleteProperty(window.navigator, "userAgent");
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("AutoMascot without the files", () => {
  it("shows the placeholder and the caption while the still loads", () => {
    const { container } = render(<AutoMascot state="searching" />);
    expect(screen.getByTestId("auto-placeholder")).toHaveTextContent("searching");
    expect(screen.getByText("Searching the web")).toBeInTheDocument();
    expect(stillOf(container).getAttribute("src")).toBe("/auto/searching.png");
    expect(container.querySelector("video")).toBeNull();
  });

  it("tells the page glow what he is showing (app/globals.css reads data-glow)", () => {
    for (const [state, expected] of [["searching", "busy"], ["celebrate", "bright"], ["oops", "snag"], ["sleeping", "off"], ["idle", "calm"]] as const) {
      const { unmount } = render(<AutoMascot state={state} />);
      expect({ state, glow: glow() }).toEqual({ state, glow: expected });
      unmount();
    }
  });

  it("falls back to the placeholder when the PNG is missing, without errors", () => {
    const warn = silenceWarnings();
    const error = vi.spyOn(console, "error");
    const { container, rerender } = render(<AutoMascot state="idle" />);
    fireEvent.error(stillOf(container));
    rerender(<AutoMascot state="working" />);
    expect(screen.getByTestId("auto-placeholder")).toHaveTextContent("working");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByText("Working on it")).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("ends a one-shot on a timer, since no clip plays", () => {
    vi.useFakeTimers();
    silenceWarnings();
    const onClipEnded = vi.fn();
    const { container } = render(<AutoMascot state="celebrate" onClipEnded={onClipEnded} />);
    fireEvent.error(stillOf(container));
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(onClipEnded).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClipEnded).toHaveBeenCalledWith("celebrate");
  });
});

describe("AutoMascot with the files", () => {
  it("plays the .webm with the PNG as poster outside Safari", () => {
    const { container } = render(<AutoMascot state="idle" />);
    fireEvent.load(stillOf(container));
    const video = videoOf(container);
    expect(video.getAttribute("src")).toBe("/auto/idle.webm");
    expect(video.getAttribute("poster")).toBe("/auto/idle.png");
    expect(video.loop).toBe(false);
    expect(screen.queryByTestId("auto-placeholder")).toBeNull();
  });

  it("plays the .mp4 in Safari", () => {
    setUserAgent(SAFARI);
    const { container } = render(<AutoMascot state="thinking" />);
    fireEvent.load(stillOf(container));
    expect(videoOf(container).getAttribute("src")).toBe("/auto/thinking.mp4");
  });

  it("queues a new state and swaps it at the clip boundary", () => {
    const { container, rerender } = render(<AutoMascot state="idle" />);
    fireEvent.load(stillOf(container));
    rerender(<AutoMascot state="working" />);
    expect(screen.getByText("Working on it")).toBeInTheDocument();
    expect(videoOf(container).getAttribute("src")).toBe("/auto/idle.webm");
    expect(ring()).toBe("mint");

    playTo(videoOf(container), 2.5);
    expect(videoOf(container).getAttribute("src")).toBe("/auto/idle.webm");

    playTo(videoOf(container), 4.95);
    expect(videoOf(container).getAttribute("src")).toBe("/auto/working.webm");
    expect(ring()).toBe("bronze");
  });

  it("swaps on ended when timeupdate missed the boundary", () => {
    const { container, rerender } = render(<AutoMascot state="thinking" />);
    fireEvent.load(stillOf(container));
    rerender(<AutoMascot state="searching" />);
    fireEvent.ended(videoOf(container));
    expect(videoOf(container).getAttribute("src")).toBe("/auto/searching.webm");
  });

  it("swaps oops at once", () => {
    const { container, rerender } = render(<AutoMascot state="working" />);
    fireEvent.load(stillOf(container));
    rerender(<AutoMascot state="oops" />);
    expect(videoOf(container).getAttribute("src")).toBe("/auto/oops.webm");
    expect(ring()).toBe("coral");
  });

  it("plays a loop again at the boundary when nothing is queued", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { container } = render(<AutoMascot state="reading" />);
    fireEvent.load(stillOf(container));
    const video = videoOf(container);
    playTo(video, 4.97);
    expect(video.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(1);
    expect(videoOf(container)).toBe(video);
  });

  it("reports a one-shot's end once, then swaps to the next state at once", () => {
    const onClipEnded = vi.fn();
    const { container, rerender } = render(<AutoMascot state="celebrate" onClipEnded={onClipEnded} />);
    fireEvent.load(stillOf(container));
    playTo(videoOf(container), 4.96);
    fireEvent.ended(videoOf(container));
    expect(onClipEnded).toHaveBeenCalledTimes(1);
    expect(onClipEnded).toHaveBeenCalledWith("celebrate");

    rerender(<AutoMascot state="idle" onClipEnded={onClipEnded} />);
    expect(videoOf(container).getAttribute("src")).toBe("/auto/idle.webm");
  });

  it("falls back to the still when a clip won't play", () => {
    const warn = silenceWarnings();
    const { container } = render(<AutoMascot state="idle" />);
    fireEvent.load(stillOf(container));
    fireEvent.error(videoOf(container));
    expect(container.querySelector("video")).toBeNull();
    expect(stillOf(container).getAttribute("src")).toBe("/auto/idle.png");
    expect(screen.queryByTestId("auto-placeholder")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("AutoMascot with reduced motion", () => {
  it("shows the PNG only and swaps it at once", () => {
    preferReducedMotion(true);
    const { container, rerender } = render(<AutoMascot state="idle" />);
    fireEvent.load(stillOf(container));
    expect(container.querySelector("video")).toBeNull();
    rerender(<AutoMascot state="searching" />);
    expect(stillOf(container).getAttribute("src")).toBe("/auto/searching.png");
    expect(ring()).toBe("bronze");
  });
});

describe("AutoMascot captions", () => {
  it("takes a caption and a detail line from the page", () => {
    render(<AutoMascot state="celebrate" caption="Your report is ready" detail="Laptop shortlist" />);
    expect(screen.getByText("Your report is ready")).toBeInTheDocument();
    expect(screen.getByText("Laptop shortlist")).toBeInTheDocument();
  });
});
