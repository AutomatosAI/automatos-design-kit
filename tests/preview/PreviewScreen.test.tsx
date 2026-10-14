import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PreviewPage from "@/app/preview/page";
import { GALLERY_CSS_TEST_ID } from "@/components/preview/content";
import { PreviewScreen } from "@/components/preview/PreviewScreen";
import type { StorageSource } from "@/lib/looks/storage";
import { DRAFT_KEY, writeStoredDraft } from "@/lib/skins/draft-store";
import { setShape, setTones, setToken, startDraft, type SkinDraft } from "@/lib/skins/model";

import { blockedStorage, memoryStorage } from "../looks/helpers";

// PRD-004 K-005: the preview gallery. The base and tone switches set Studio's classes on the
// frame (and the attributes the skin CSS is scoped to), "Compare with Studio" adds Studio as it
// ships beside the skin, and the gallery is coloured by the editor's draft.

type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

/** A storage source holding `draft` as the editor would have kept it. */
function storedDraft(draft: SkinDraft): StorageSource {
  const storage = memoryStorage();
  const source: StorageSource = () => storage;
  expect(writeStoredDraft(source, draft)).toBe(true);
  return source;
}

async function galleryCss(): Promise<string> {
  return (await screen.findByTestId(GALLERY_CSS_TEST_ID)).textContent ?? "";
}

function skinFrame(): HTMLElement {
  return screen.getByRole("figure", { name: "Your skin" });
}

async function press(user: User, group: "Base" | "Tone", label: string): Promise<void> {
  await user.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name: label }));
}

describe("the preview gallery", () => {
  it("starts on Studio, Light, with the skin's frame and its stylesheet", async () => {
    render(<PreviewPage />);
    const css = await galleryCss();
    expect(screen.getByRole("heading", { level: 1, name: "Preview" })).toBeInTheDocument();
    expect(css).toContain('[data-skin-preview~="kit-base-studio"]');
    expect(css).toContain('[data-skin-preview~="kit-draft"]');
    const frame = skinFrame();
    expect(frame).toHaveClass("studio");
    expect(frame).not.toHaveClass("dark");
    expect(frame).toHaveAttribute("data-skin-preview", "kit-base-studio kit-draft");
    expect(frame).toHaveAttribute("data-skin-tone", "light");
    expect(within(screen.getByRole("group", { name: "Base" })).getByRole("button", { name: "Studio" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByRole("figure")).toHaveLength(1);
  });

  it("sets Studio's classes and the palette when the base and tone switches change", async () => {
    const user = userEvent.setup();
    render(<PreviewScreen />);
    await galleryCss();

    await press(user, "Base", "Classic");
    expect(skinFrame()).not.toHaveClass("studio");
    expect(skinFrame()).toHaveAttribute("data-skin-preview", "kit-base-classic kit-draft");
    const classic = await galleryCss();
    expect(classic).toContain('[data-skin-preview~="kit-base-classic"]');
    expect(classic).not.toContain("kit-base-studio");

    await press(user, "Tone", "Dark");
    expect(skinFrame()).toHaveClass("dark");
    expect(skinFrame()).toHaveAttribute("data-skin-tone", "dark");
    expect(within(screen.getByRole("group", { name: "Tone" })).getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await press(user, "Base", "Studio");
    await press(user, "Tone", "Light");
    expect(skinFrame()).toHaveClass("studio");
    expect(skinFrame()).not.toHaveClass("dark");
  });

  it("compares the skin with Studio as it ships, side by side", async () => {
    const user = userEvent.setup();
    render(<PreviewScreen />);
    await galleryCss();
    await user.click(screen.getByRole("button", { name: "Compare with Studio" }));
    expect(screen.getByRole("button", { name: "Compare with Studio" })).toHaveAttribute("aria-pressed", "true");
    const shipped = screen.getByRole("figure", { name: "Studio as it ships" });
    expect(shipped).toHaveAttribute("data-skin-preview", "kit-base-studio");
    expect(shipped).toHaveClass("studio");
    expect(skinFrame()).toHaveAttribute("data-skin-preview", "kit-base-studio kit-draft");

    await press(user, "Base", "Classic");
    await press(user, "Tone", "Dark");
    const classic = screen.getByRole("figure", { name: "Classic as it ships" });
    expect(classic).toHaveAttribute("data-skin-preview", "kit-base-classic");
    expect(classic).toHaveClass("dark");
    expect(classic).not.toHaveClass("studio");

    await user.click(screen.getByRole("button", { name: "Compare with Studio" }));
    expect(screen.getAllByRole("figure")).toHaveLength(1);
  });

  it("shows the editor's draft: its base, its colours and its radius", async () => {
    const draft = setShape(setToken(startDraft("classic"), "light", "primary", "#336699"), { radius: 16, glow: 12 });
    render(<PreviewScreen storage={storedDraft(draft)} />);
    const css = await galleryCss();
    expect(css).toContain("--primary: 210 50% 40%;");
    expect(css).toContain("--radius: 16px;");
    expect(css).toContain("--skin-glow: 12px;");
    expect(skinFrame()).not.toHaveClass("studio");
    expect(skinFrame()).toHaveAttribute("data-skin-preview", "kit-base-classic kit-draft");
  });

  it("starts on the skin's own tone and says when a tone shows the base's colours", async () => {
    const user = userEvent.setup();
    render(<PreviewScreen storage={storedDraft(setTones(startDraft("studio"), ["dark"]))} />);
    await galleryCss();
    expect(skinFrame()).toHaveClass("dark");
    expect(screen.queryByText(/has no/)).not.toBeInTheDocument();

    await press(user, "Tone", "Light");
    expect(screen.getByText("Your skin has no Light colours, so Light shows Studio's own.")).toBeInTheDocument();
    await press(user, "Base", "Classic");
    expect(screen.getByText("Your skin is built on Studio. This shows its colours over Classic.")).toBeInTheDocument();
  });

  it("reads the draft again when the editor changes it in another tab", async () => {
    const storage = memoryStorage();
    const source: StorageSource = () => storage;
    render(<PreviewScreen storage={source} />);
    expect(await galleryCss()).not.toContain("--primary: 210 50% 40%;");

    writeStoredDraft(source, setToken(startDraft("studio"), "light", "primary", "#336699"));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: DRAFT_KEY }));
    });
    expect(await galleryCss()).toContain("--primary: 210 50% 40%;");
  });

  it("still shows Studio when this browser's storage is blocked", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<PreviewScreen storage={blockedStorage} />);
    expect(await galleryCss()).toContain('[data-skin-preview~="kit-base-studio"]');
    expect(skinFrame()).toHaveClass("studio");
  });

  it("draws every part of the gallery in Studio's words", async () => {
    render(<PreviewScreen />);
    await galleryCss();
    const frame = within(skinFrame());
    for (const label of ["Chat ledger", "Cards", "Table", "Buttons", "Fields", "Modal and toasts", "Charts"]) {
      expect(frame.getByText(label)).toBeInTheDocument();
    }
    expect(frame.getByText("Chat").closest("[data-current]")).toHaveAttribute("data-current", "page");
    expect(frame.getByText("Auto")).toBeInTheDocument();
    expect(frame.getByRole("list", { name: "Activity" })).toBeInTheDocument();
    expect(frame.getByRole("list", { name: "What I did" })).toBeInTheDocument();
    expect(frame.getByText("Deliverable · Markdown · 2 pages")).toBeInTheDocument();
    expect(frame.getByText("Message Auto")).toBeInTheDocument();
    expect(frame.getByRole("table")).toBeInTheDocument();
    for (const label of ["Run Playbook", "Duplicate", "Edit", "Delete", "More"]) {
      expect(frame.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(frame.getByText("Delete this Playbook?")).toBeInTheDocument();
    expect(frame.getByText("Mission started")).toBeInTheDocument();
    expect(frame.getByRole("img", { name: "Bar chart of Deliverables by kind" })).toBeInTheDocument();
    expect(frame.getByRole("img", { name: "Line chart of Missions done and failed" })).toBeInTheDocument();
    expect(frame.queryByRole("button")).not.toBeInTheDocument();
  });
});
