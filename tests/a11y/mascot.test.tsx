import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutoMascot } from "@/components/mascot/AutoMascot";
import { captionFor } from "@/lib/mascot/media";

// US-014: a screen reader skips Auto's picture and hears his caption when it changes.
// The mascot files are never in CI, so Auto is the placeholder here.

afterEach(() => {
  vi.restoreAllMocks();
});

function liveRegionOf(text: string): HTMLElement {
  const region = screen.getByText(text).closest("[aria-live]");
  if (!(region instanceof HTMLElement)) throw new Error(`"${text}" isn't in a live region`);
  return region;
}

describe("Auto for screen readers", () => {
  it("hides the picture and puts the caption in a polite live region", () => {
    render(<AutoMascot state="thinking" />);
    expect(screen.getByTestId("auto-stage")).toHaveAttribute("aria-hidden", "true");
    const region = liveRegionOf(captionFor("thinking"));
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).not.toContainElement(screen.getByTestId("auto-stage"));
  });

  it("announces a new caption from the same region, detail included", () => {
    const { rerender } = render(<AutoMascot state="thinking" />);
    const region = liveRegionOf(captionFor("thinking"));
    rerender(<AutoMascot state="searching" detail="laptops under £600" />);
    expect(region).toBeInTheDocument();
    expect(region).toHaveTextContent(captionFor("searching"));
    expect(region).toHaveTextContent("laptops under £600");
  });

  it("keeps the placeholder's state name out of the accessibility tree", () => {
    render(<AutoMascot state="oops" />);
    expect(screen.getByTestId("auto-placeholder").closest("[aria-hidden='true']")).not.toBeNull();
  });
});
