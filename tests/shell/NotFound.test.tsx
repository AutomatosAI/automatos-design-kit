import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "@/app/not-found";
import { LOST_LINE, LOST_LINK, LOST_TITLE } from "@/components/shell/LostScreen";

// Mock 09: any address the kit doesn't have.

describe("the 404 page", () => {
  it("says the page wandered off, shows Auto lost, and links back to the editor", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: LOST_TITLE })).toBeInTheDocument();
    expect(LOST_TITLE).toBe("This page wandered off");
    expect(screen.getByText(LOST_LINE)).toBeInTheDocument();
    expect(screen.getByTestId("auto-placeholder")).toHaveTextContent("lost");
    expect(screen.getByTestId("auto-stage")).toHaveAttribute("data-ring", "dusk");
    expect(screen.getByRole("link", { name: LOST_LINK })).toHaveAttribute("href", "/");
  });
});
