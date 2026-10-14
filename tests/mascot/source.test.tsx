import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutoMascot } from "@/components/mascot/AutoMascot";
import type { MascotSource } from "@/lib/mascot/media";

// PRD-004 K-006: the player takes a skin's own clips (object URLs in the Skin Kit's editor);
// a state the set has no file for shows the placeholder or a still, never a broken element.

afterEach(() => {
  vi.restoreAllMocks();
});

function sourceOf(files: Readonly<Record<string, string>>): MascotSource {
  return {
    poster: (state) => files[`${state}.png`] ?? null,
    video: (state, format) => files[`${state}.${format}`] ?? null,
  };
}

describe("AutoMascot with a skin's own set", () => {
  it("shows the placeholder, and no image or video, for a state the set has no files for", () => {
    const { container } = render(<AutoMascot state="hello" source={sourceOf({})} />);
    expect(screen.getByTestId("auto-placeholder")).toHaveTextContent("hello");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByText("Hi, I'm Auto.")).toBeInTheDocument();
  });

  it("plays the set's clip with its still as the poster", () => {
    const files = { "idle.png": "blob:http://localhost/still", "idle.webm": "blob:http://localhost/clip" };
    const { container } = render(<AutoMascot state="idle" source={sourceOf(files)} />);
    const still = container.querySelector("img");
    expect(still?.getAttribute("src")).toBe(files["idle.png"]);
    if (still) fireEvent.load(still);
    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toBe(files["idle.webm"]);
    expect(video?.getAttribute("poster")).toBe(files["idle.png"]);
    expect(screen.queryByTestId("auto-placeholder")).toBeNull();
  });

  it("stays on the still when the set has the PNG but not this browser's clip", () => {
    const files = { "idle.png": "blob:http://localhost/still", "idle.mp4": "blob:http://localhost/clip" };
    const { container } = render(<AutoMascot state="idle" source={sourceOf(files)} />);
    const still = container.querySelector("img");
    if (still) fireEvent.load(still);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(files["idle.png"]);
    expect(screen.queryByTestId("auto-placeholder")).toBeNull();
  });
});
