import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LooksPage from "@/app/looks/page";
import { LookProvider } from "@/components/looks/LookProvider";
import { ACCENTS, GROUNDS, LIGHTS, SHELLS, TYPE_STYLES } from "@/lib/looks/catalogue";
import { lookToCssVars } from "@/lib/looks/css";
import { SAVED_SUB } from "@/lib/looks/editor";
import { AURORA, EMBER, PRESETS, WORKSHOP } from "@/lib/looks/presets";
import { ACTIVE_LOOK_KEY, SAVED_LOOKS_KEY } from "@/lib/looks/storage";

import { clearRoot, myLook, rootVars } from "./helpers";

// PRD-002 L-004: the Looks page. Every control changes the variables on <html>, so the whole
// app follows, not only the preview.

type User = ReturnType<typeof userEvent.setup>;

function renderLooks() {
  return render(
    <LookProvider>
      <LooksPage />
    </LookProvider>,
  );
}

function rootVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name).trim();
}

/** The line beside the heading: the active Look's name, "· edited" once changed. */
function status(): HTMLElement {
  return screen.getByRole("status");
}

function looksRow() {
  return within(screen.getByRole("region", { name: "Looks" }));
}

function group(name: string | RegExp) {
  return within(screen.getByRole("group", { name }));
}

function card(name: string): HTMLElement {
  return looksRow().getByRole("button", { name: new RegExp(`^${name}\\b`) });
}

function stored(key: string): unknown {
  const raw = window.localStorage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}

async function ready(): Promise<void> {
  await waitFor(() => expect(rootVars()).toEqual(lookToCssVars(EMBER)));
}

beforeEach(() => {
  window.localStorage.clear();
  clearRoot();
  // Auto's files are never in CI: his still fails to load and warns.
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  clearRoot();
});

describe("the Looks page", () => {
  it("shows the heading with the active Look's name, the preview, the Looks row and the editor", async () => {
    renderLooks();
    await ready();
    expect(screen.getByRole("heading", { level: 1, name: "Make it yours." })).toBeInTheDocument();
    expect(status()).toHaveTextContent(/^Ember$/);

    const preview = within(screen.getByRole("region", { name: "Preview" }));
    expect(preview.getByText("Ta-da.")).toBeInTheDocument();
    expect(preview.getByText("Can you make me a shortlist under £700?")).toBeInTheDocument();
    expect(preview.getByText("✓ Searched the web · 5 results")).toBeInTheDocument();
    expect(preview.getByText("ASUS Vivobook S 14")).toBeInTheDocument();
    expect(preview.getByText("Laptop shortlist")).toBeInTheDocument();
    expect(preview.getByText("Open")).toBeInTheDocument();
    expect(preview.getByText("Message Auto")).toBeInTheDocument();
    expect(preview.getByTestId("auto-stage")).toBeInTheDocument();

    expect(looksRow().getAllByRole("button").map((button) => button.textContent)).toEqual(
      PRESETS.map((look) => `Aa${look.name} ${look.sub}`),
    );
    expect(card("Ember")).toHaveAttribute("aria-pressed", "true");
    expect(card("Aurora")).toHaveAttribute("aria-pressed", "false");

    const editor = within(screen.getByRole("complementary", { name: "Edit the look" }));
    for (const name of ["Accent · Molten", "Background", "Type", "Auto's shell", "Auto's light · eyes + ring"]) {
      expect(editor.getByRole("group", { name })).toBeInTheDocument();
    }
    expect(editor.getByRole("slider", { name: "Glow" })).toHaveValue("24");
    expect(editor.getByRole("button", { name: "Save as new look" })).toBeInTheDocument();
    expect(editor.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("picking a preset changes --accent on the root and keeps the choice", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    await user.click(card("Aurora"));
    await waitFor(() => expect(rootVar("--accent")).toBe(ACCENTS.mint.hex));
    expect(rootVars()).toEqual(lookToCssVars(AURORA));
    expect(card("Aurora")).toHaveAttribute("aria-pressed", "true");
    expect(card("Ember")).toHaveAttribute("aria-pressed", "false");
    expect(status()).toHaveTextContent(/^Aurora$/);
    expect(stored(ACTIVE_LOOK_KEY)).toEqual(AURORA);
  });

  it("marks the Look '· edited' when a control changes it", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    await user.click(group(/^Accent/).getByRole("button", { name: "Rose" }));
    expect(status()).toHaveTextContent(/^Ember · edited$/);
    expect(screen.getByRole("group", { name: "Accent · Rose" })).toBeInTheDocument();
    expect(group(/^Accent/).getByRole("button", { name: "Rose" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(rootVar("--accent")).toBe(ACCENTS.rose.hex));
  });

  it("re-themes the whole app from every control at once", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();

    await user.click(group("Background").getByRole("button", { name: "Paper" }));
    await waitFor(() => expect(rootVar("--ground-bg")).toBe(GROUNDS.paper.bg));

    await user.click(group("Type").getByRole("button", { name: "Playful" }));
    await waitFor(() => expect(rootVar("--display-family")).toBe(TYPE_STYLES.round.family));

    await user.click(group("Auto's shell").getByRole("button", { name: "Cobalt" }));
    await waitFor(() => expect(rootVar("--auto-shell-filter")).toBe(SHELLS.cobalt.filter));

    await user.click(group(/^Auto's light/).getByRole("button", { name: "Ice" }));
    await waitFor(() => expect(rootVar("--auto-light")).toBe(LIGHTS.ice.hex));

    const slider = screen.getByRole("slider", { name: "Glow" });
    fireEvent.change(slider, { target: { value: "0" } });
    await waitFor(() => expect(rootVar("--glow")).toBe("rgba(255,106,31,0)"));
    expect(slider).toHaveAttribute("aria-valuetext", "Off");
    expect(screen.getByText("Off")).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "31" } });
    await waitFor(() => expect(rootVar("--glow")).toBe("rgba(255,106,31,0.31)"));
    expect(slider).toHaveAttribute("aria-valuetext", "31%");

    expect(stored(ACTIVE_LOOK_KEY)).toEqual({
      ...EMBER,
      ground: "paper",
      font: "round",
      shell: "cobalt",
      light: "ice",
      glow: 31,
    });
  });

  it("Save as new look adds 'My look 1' to the row and selects it", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    await user.click(group(/^Accent/).getByRole("button", { name: "Gold" }));
    await user.click(screen.getByRole("button", { name: "Save as new look" }));

    const saved = card("My look 1");
    expect(saved).toHaveAttribute("aria-pressed", "true");
    expect(saved).toHaveTextContent(SAVED_SUB);
    expect(card("Ember")).toHaveAttribute("aria-pressed", "false");
    expect(status()).toHaveTextContent(/^My look 1$/);

    const mine = { ...EMBER, id: "look-1", name: "My look 1", sub: SAVED_SUB, accent: "gold" };
    expect(stored(SAVED_LOOKS_KEY)).toEqual([mine]);
    expect(stored(ACTIVE_LOOK_KEY)).toEqual(mine);
    await waitFor(() => expect(rootVar("--accent")).toBe(ACCENTS.gold.hex));

    await user.click(screen.getByRole("button", { name: "Save as new look" }));
    expect(card("My look 2")).toHaveAttribute("aria-pressed", "true");
    expect(looksRow().getAllByRole("button")).toHaveLength(PRESETS.length + 2);
  });

  it("Reset returns to the picked Look's saved values", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    await user.click(card("Workshop"));
    await user.click(group(/^Accent/).getByRole("button", { name: "Mint" }));
    fireEvent.change(screen.getByRole("slider", { name: "Glow" }), { target: { value: "40" } });
    expect(status()).toHaveTextContent(/^Workshop · edited$/);
    await waitFor(() => expect(rootVar("--accent")).toBe(ACCENTS.mint.hex));

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(status()).toHaveTextContent(/^Workshop$/);
    await waitFor(() => expect(rootVars()).toEqual(lookToCssVars(WORKSHOP)));
    expect(screen.getByRole("slider", { name: "Glow" })).toHaveValue(String(WORKSHOP.glow));
    expect(stored(ACTIVE_LOOK_KEY)).toEqual(WORKSHOP);
  });

  it("Reset on a saved Look goes back to what was saved, not to a preset", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(SAVED_LOOKS_KEY, JSON.stringify([myLook()]));
    window.localStorage.setItem(ACTIVE_LOOK_KEY, JSON.stringify(myLook({ accent: "cream" })));
    renderLooks();
    await waitFor(() => expect(status()).toHaveTextContent(/^My look 1 · edited$/));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(status()).toHaveTextContent(/^My look 1$/);
    await waitFor(() => expect(rootVars()).toEqual(lookToCssVars(myLook())));
  });

  it("can't Reset a Look that has nothing to go back to", async () => {
    window.localStorage.setItem(ACTIVE_LOOK_KEY, JSON.stringify(myLook({ id: "gone" })));
    renderLooks();
    await waitFor(() => expect(rootVars()).toEqual(lookToCssVars(myLook({ id: "gone" }))));
    expect(status()).toHaveTextContent(/^My look 1$/);
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });
});

describe("the Looks page without a LookProvider", () => {
  it("says in words why Save as new look didn't save, and logs it", async () => {
    const user = userEvent.setup();
    render(<LooksPage />);
    await user.click(screen.getByRole("button", { name: "Save as new look" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("That look wasn't saved.");
    expect(alert).toHaveTextContent("Looks aren't available here.");
    expect(console.warn).toHaveBeenCalledWith("[looks] Save as new look was refused:", ["Looks aren't available here."]);

    await user.click(looksRow().getByRole("button", { name: /^Daylight\b/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

/** Tab from the top until focus comes round again. */
async function tabStops(user: User): Promise<readonly Element[]> {
  const stops: Element[] = [];
  for (let count = 0; count < 60; count += 1) {
    await user.tab();
    const focused = document.activeElement;
    if (!focused || focused === document.body || stops.includes(focused)) break;
    stops.push(focused);
  }
  return stops;
}

describe("the Looks page by keyboard", () => {
  it("reaches every Look, option, the slider and both actions with Tab", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    const controls = [...screen.getAllByRole("button"), screen.getByRole("slider", { name: "Glow" })];
    const stops = await tabStops(user);
    expect(controls.filter((control) => !stops.includes(control)).map((control) => control.textContent)).toEqual([]);
  });

  it("names every swatch and reads the slider's value", async () => {
    renderLooks();
    await ready();
    const accents = group(/^Accent/).getAllByRole("button");
    expect(accents.map((swatch) => swatch.getAttribute("aria-label"))).toEqual(
      Object.values(ACCENTS).map((accent) => accent.name),
    );
    expect(group("Background").getAllByRole("button").map((button) => button.textContent)).toEqual(
      Object.values(GROUNDS).map((ground) => ground.name),
    );
    expect(group("Type").getByRole("button", { name: "Editorial" })).toHaveAttribute("aria-pressed", "true");
    const slider = screen.getByRole("slider", { name: "Glow" });
    expect(slider).toHaveAttribute("aria-valuetext", "24%");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "40");
  });
});
