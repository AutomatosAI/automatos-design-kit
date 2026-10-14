import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LooksPage from "@/app/looks/page";
import LookStylePage from "@/app/looks/style/page";
import { LookProvider, useLook } from "@/components/looks/LookProvider";
import { ACCENTS, GROUNDS, LIGHTS } from "@/lib/looks/catalogue";
import { lookToCssVars } from "@/lib/looks/css";
import { AURORA, DAYLIGHT, EMBER } from "@/lib/looks/presets";
import { rootBlock } from "@/lib/looks/style";
import type { Look } from "@/lib/looks/types";

import { clearRoot, rootVars } from "./helpers";

// PRD-002 L-007: the live style page. Every value comes from the active Look and redraws when
// it changes; here a test button changes it through LookProvider, as the Looks page does.

const ACCURACY = 0.05;

function Pick({ look }: { readonly look: Look }) {
  const { setLook } = useLook();
  return (
    <button type="button" onClick={() => setLook(look)}>
      {`Pick ${look.name}`}
    </button>
  );
}

function renderStyle() {
  return render(
    <LookProvider>
      <Pick look={DAYLIGHT} />
      <Pick look={AURORA} />
      <LookStylePage />
    </LookProvider>,
  );
}

async function ready(look: Look = EMBER): Promise<void> {
  await waitFor(() => expect(rootVars()).toEqual(lookToCssVars(look)));
}

/** The ratio shown in the contrast table's row for a pair, e.g. "text / bg". */
function ratioFor(label: string): number {
  const row = screen.getByRole("rowheader", { name: label }).closest("tr");
  if (!row) throw new Error(`no row for ${label}`);
  const text = within(row).getByText(/^\d+\.\d{2}:1$/).textContent ?? "";
  return Number.parseFloat(text);
}

function verdictFor(label: string): string {
  const row = screen.getByRole("rowheader", { name: label }).closest("tr");
  if (!row) throw new Error(`no row for ${label}`);
  return within(row).getByText(/AA (pass|fail)/).textContent ?? "";
}

/** The swatch for a Look variable, e.g. "--ground-bg". */
function swatch(name: string) {
  const item = screen.getByText(name).closest("li");
  if (!item) throw new Error(`no swatch ${name}`);
  return within(item);
}

function swatchValue(name: string): string {
  const item = screen.getByText(name).closest("li");
  return item?.children[2]?.textContent ?? "";
}

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");

function preferReducedMotion(): void {
  const matchMedia = vi.fn((media: string) => ({
    matches: true,
    media,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: matchMedia });
}

beforeEach(() => {
  window.localStorage.clear();
  clearRoot();
});

afterEach(() => {
  if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
  else Reflect.deleteProperty(window, "matchMedia");
  window.localStorage.clear();
  clearRoot();
  vi.restoreAllMocks();
});

describe("the style page under Ember", () => {
  it("shows the live contrast ratios with an AA verdict in words", async () => {
    renderStyle();
    await ready();
    expect(screen.getByRole("heading", { level: 1, name: "Style sheet" })).toBeInTheDocument();
    expect(Math.abs(ratioFor("text / bg") - 16.36)).toBeLessThanOrEqual(ACCURACY);
    expect(Math.abs(ratioFor("text-2 / bg") - 8.54)).toBeLessThanOrEqual(ACCURACY);
    expect(Math.abs(ratioFor("ink / molten") - 6.74)).toBeLessThanOrEqual(ACCURACY);
    expect(ratioFor("text / surface")).toBeGreaterThan(4.5);
    expect(verdictFor("text / bg")).toBe("✓ AA pass");
    expect(verdictFor("accent text / bg")).toBe("✓ AA pass");
  });

  it("shows a swatch for every colour with its name, value and role", async () => {
    renderStyle();
    await ready();
    const colour = within(screen.getByRole("region", { name: "Colour" }));
    expect(colour.getAllByRole("listitem")).toHaveLength(21);
    expect(swatchValue("--ground-bg")).toBe(GROUNDS.graphite.bg);
    expect(swatch("--ground-bg").getByText("page")).toBeInTheDocument();
    expect(swatchValue("--accent")).toBe(ACCENTS.molten.hex);
    expect(swatchValue("--accent-text")).toBe(ACCENTS.molten.hex);
    expect(swatch("--accent-text").queryByText(/for reading on/)).toBeNull();
  });

  it("shows the type, spacing, radii, components and Auto's 12 states", async () => {
    renderStyle();
    await ready();
    const type = within(screen.getByRole("region", { name: "Type" }));
    expect(type.getByText("Hero 72px")).toBeInTheDocument();
    expect(type.getByText("The fun way.")).toBeInTheDocument();
    expect(type.getByText("Searching.")).toBeInTheDocument();
    expect(type.getByText("Laptop shortlist")).toBeInTheDocument();
    expect(type.getByText("Mono 13")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Spacing · 4px base" })).getAllByRole("listitem")).toHaveLength(7);
    expect(within(screen.getByRole("region", { name: "Radii" })).getByText("pill chip")).toBeInTheDocument();
    const components = within(screen.getByRole("region", { name: "Components" }));
    for (const text of ["Send", "Stop", "All", "Reading 4 pages", "Web search didn't answer", "What Auto did", "Open"]) {
      expect(components.getByText(text)).toBeInTheDocument();
    }
    expect(components.queryAllByRole("button")).toEqual([]);
    expect(components.queryAllByRole("link")).toEqual([]);
    const mascot = within(screen.getByRole("region", { name: /^Mascot slot/ }));
    expect(mascot.getAllByRole("listitem")).toHaveLength(12);
    expect(mascot.getAllByText(`ring light · ${LIGHTS.mint.hex}`)).toHaveLength(4);
    expect(mascot.getAllByText(`ring accent · ${ACCENTS.molten.hex}`)).toHaveLength(4);
  });
});

describe("the style page follows the active Look", () => {
  it("redraws the bg swatch and shows a darkened accent text on Daylight", async () => {
    const user = userEvent.setup();
    renderStyle();
    await ready();
    await user.click(screen.getByRole("button", { name: "Pick Daylight" }));
    await ready(DAYLIGHT);
    expect(swatchValue("--ground-bg")).toBe(GROUNDS.paper.bg);
    expect(swatchValue("--accent-text")).not.toBe(ACCENTS.molten.hex);
    expect(swatchValue("--accent-text")).toBe(lookToCssVars(DAYLIGHT)["--accent-text"]);
    expect(swatch("--accent-text").getByText("darkened for reading on Paper")).toBeInTheDocument();
    expect(swatch("--error-text").getByText("darkened for reading on Paper")).toBeInTheDocument();
    expect(ratioFor("accent text / bg")).toBeGreaterThanOrEqual(4.5);
  });

  it("redraws the type and the rings for another Look", async () => {
    const user = userEvent.setup();
    renderStyle();
    await ready();
    await user.click(screen.getByRole("button", { name: "Pick Aurora" }));
    await ready(AURORA);
    expect(screen.getByText("Hero 58px")).toBeInTheDocument();
    expect(screen.getByText(/Characterful · Bricolage Grotesque/)).toBeInTheDocument();
    expect(screen.getAllByText(`ring light · ${LIGHTS.ice.hex}`)).toHaveLength(4);
    expect(screen.getAllByText(`ring accent · ${ACCENTS.mint.hex}`)).toHaveLength(4);
    expect(screen.getByRole("rowheader", { name: "ink / mint" })).toBeInTheDocument();
  });
});

describe("Copy tokens", () => {
  it("copies the active Look's variables as a :root block", async () => {
    const user = userEvent.setup();
    renderStyle();
    await ready();
    await user.click(screen.getByRole("button", { name: "Copy tokens" }));
    expect(await navigator.clipboard.readText()).toBe(rootBlock(EMBER));
    expect(screen.getByText("Copied Ember's tokens as a :root block.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pick Daylight" }));
    await ready(DAYLIGHT);
    expect(screen.queryByText("Copied Ember's tokens as a :root block.")).toBeNull();
  });

  it("says so when the browser blocks the clipboard", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderStyle();
    await ready();
    const denied = new DOMException("Write permission denied.", "NotAllowedError");
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(denied);
    await user.click(screen.getByRole("button", { name: "Copy tokens" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The tokens weren't copied.");
    expect(console.error).toHaveBeenCalledWith("[looks] copying the tokens failed", denied);
  });
});

describe("Motion", () => {
  it("plays the notes with a toggle", async () => {
    const user = userEvent.setup();
    renderStyle();
    await ready();
    const motion = within(screen.getByRole("region", { name: "Motion" }));
    expect(motion.getByText(/rise 12px/)).toBeInTheDocument();
    const toggle = motion.getByRole("button", { name: "Play the motion" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("is off under reduced motion, and says why", async () => {
    preferReducedMotion();
    renderStyle();
    await ready();
    const motion = within(screen.getByRole("region", { name: "Motion" }));
    expect(motion.getByRole("button", { name: "Play the motion" })).toBeDisabled();
    expect(motion.getByText(/reduced motion, so nothing plays/)).toBeInTheDocument();
  });
});

describe("the Looks page", () => {
  it("links to the style sheet", async () => {
    render(
      <LookProvider>
        <LooksPage />
      </LookProvider>,
    );
    await ready();
    expect(screen.getByRole("link", { name: "See the style sheet" })).toHaveAttribute("href", "/looks/style");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
