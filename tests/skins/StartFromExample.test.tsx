import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SkinEditor } from "@/components/skins/SkinEditor";
import { SKIN_CSS_TEST_ID } from "@/components/skins/SkinPreviewStrip";
import { memoryAssetStore } from "@/lib/skins/asset-store";
import { DRAFT_KEY } from "@/lib/skins/draft-store";
import { findExample } from "@/lib/skins/examples";

// PRD-004 K-008: the examples in the editor. "Start from <name>" buttons, and the Examples page's
// "Start from this" link (/?start=<slug>), which replaces the draft as one undoable step.

function nameField(): HTMLElement {
  return screen.getByRole("textbox", { name: "Name" });
}

function renderEditor() {
  return render(<SkinEditor assetStore={memoryAssetStore()} />);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("starting from an example", () => {
  it("offers a Start from button for each example", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByTestId(SKIN_CSS_TEST_ID);
    for (const name of ["Ember", "Daylight", "Workshop", "Neon"]) {
      expect(screen.getByRole("button", { name: `Start from ${name}` })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Start from Workshop" }));
    expect(nameField()).toHaveValue("Workshop");
    expect(screen.getByRole("figure", { name: "Dark preview" })).toBeInTheDocument();
    expect(screen.queryByRole("figure", { name: "Light preview" })).not.toBeInTheDocument();
  });

  it("starts from the example a link names, once, and Undo brings the old draft back", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?start=neon");
    renderEditor();
    await waitFor(() => expect(nameField()).toHaveValue("Neon"));
    expect(window.location.search).toBe("");
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "null") as { draft: unknown } | null;
      expect(stored?.draft).toEqual(findExample("neon")?.draft);
    });
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(nameField()).toHaveValue("My skin");
  });

  it("leaves the draft alone when the link names no example", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    window.history.replaceState(null, "", "/?start=nope");
    renderEditor();
    await waitFor(() => expect(window.location.search).toBe(""));
    expect(nameField()).toHaveValue("My skin");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("doesn't have"));
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });
});
