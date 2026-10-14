import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EditorPage from "@/app/page";
import { BASE_PAIR_VERDICT, INCOMPLETE_VERDICT, setTooLabel } from "@/components/skins/ColourRow";
import { toneLockNote } from "@/components/skins/MetaFields";
import { KEPT_STATUS, NOT_KEPT_STATUS, SkinEditor } from "@/components/skins/SkinEditor";
import { SKIN_CSS_TEST_ID } from "@/components/skins/SkinPreviewStrip";
import type { StorageSource } from "@/lib/looks/storage";
import { basePalette } from "@/lib/skins/base";
import { DRAFT_KEY } from "@/lib/skins/draft-store";

import { blockedStorage, memoryStorage } from "../looks/helpers";

// PRD-004 K-004: the skin editor. Editing a token updates the preview's CSS, a failing pair
// shows its badge and the suggestion fixes it, undo restores, dropping a tone hides its column,
// and the draft survives a reload. K-010: the badges follow decision K5 (base pairs aren't
// checked, one-sided pairs are flagged) and a one-tone skin says Studio locks its tone (K4).

type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

function renderEditor(storage?: StorageSource) {
  return render(storage ? <SkinEditor storage={storage} /> : <EditorPage />);
}

/** The preview's stylesheet, once the draft has been read from storage. */
async function skinCss(): Promise<string> {
  return (await screen.findByTestId(SKIN_CSS_TEST_ID)).textContent ?? "";
}

/** One tone of one token: its picker, text field, source and badges. */
function cell(name: string, tone: "Light" | "Dark") {
  return within(screen.getByRole("group", { name: `${name}, ${tone}` }));
}

function textField(name: string, tone: "Light" | "Dark"): HTMLElement {
  return screen.getByRole("textbox", { name: `${name}, ${tone}, hex or HSL` });
}

async function showGroup(user: User, label: string): Promise<void> {
  await user.click(within(screen.getByRole("group", { name: "Colour groups" })).getByRole("button", { name: label }));
}

async function typeColour(user: User, field: HTMLElement, colour: string): Promise<void> {
  await user.clear(field);
  await user.type(field, `${colour}{Enter}`);
}

describe("the skin editor", () => {
  it("starts from Studio with the details, the colour groups, the shape and a live preview", async () => {
    renderEditor();
    await skinCss();
    expect(screen.getByRole("heading", { level: 1, name: "Make a skin." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start from Studio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start from Classic" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("My skin");
    const groups = within(screen.getByRole("group", { name: "Colour groups" }));
    for (const label of ["Surfaces", "Text", "Brand", "Status", "Charts", "Studio aliases"]) {
      expect(groups.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(textField("background", "Light")).toHaveValue(basePalette("studio", "light").background);
    expect(textField("background", "Dark")).toHaveValue(basePalette("studio", "dark").background);
    expect(screen.getByRole("slider", { name: "Radius" })).toHaveValue("8");
    expect(screen.getByRole("slider", { name: "Glow" })).toHaveValue("0");
    expect(screen.getByRole("figure", { name: "Light preview" })).toHaveAttribute("data-skin-preview", "kit-base-studio kit-draft");
    expect(screen.getByRole("figure", { name: "Dark preview" })).toHaveAttribute("data-skin-tone", "dark");
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("updates the preview CSS when a token is typed or picked", async () => {
    const user = userEvent.setup();
    renderEditor();
    expect(await skinCss()).not.toContain("--primary: 200 50% 40%;");
    await showGroup(user, "Brand");
    await typeColour(user, textField("primary", "Light"), "200 50% 40%");
    expect(await skinCss()).toContain('[data-skin-preview~="kit-draft"] {\n  --primary: 200 50% 40%;');
    expect(cell("primary", "Light").getByText("Set by this skin")).toBeInTheDocument();

    fireEvent.change(cell("primary", "Dark").getByLabelText("primary, Dark"), { target: { value: "#336699" } });
    expect(await skinCss()).toContain('[data-skin-tone="dark"][data-skin-preview~="kit-draft"] {\n  --primary: 210 50% 40%;');
    expect(textField("primary", "Dark")).toHaveValue("210 50% 40%");
  });

  it("says when a typed colour can't be read, and changes nothing", async () => {
    const user = userEvent.setup();
    renderEditor();
    const before = await skinCss();
    await typeColour(user, textField("card", "Light"), "orange");
    expect(screen.getByRole("alert")).toHaveTextContent("Use #rrggbb or an HSL triplet");
    expect(textField("card", "Light")).toHaveAttribute("aria-invalid", "true");
    expect(await skinCss()).toBe(before);
  });

  it("shows a base pair as not checked, and its suggestion makes it the skin's own checked pair (K5)", async () => {
    const user = userEvent.setup();
    renderEditor();
    await skinCss();
    await user.click(screen.getByRole("button", { name: "Start from Classic" }));
    await showGroup(user, "Brand");
    const light = cell("primary", "Light");
    expect(light.getByText(BASE_PAIR_VERDICT)).toBeInTheDocument();
    expect(light.getByText("–")).toBeInTheDocument();
    expect(light.queryByText("AA fail")).toBeNull();
    expect(light.getByText("primary-foreground on primary")).toBeInTheDocument();
    expect(light.getByText(/^\d+\.\d\d:1$/)).toBeInTheDocument();

    await user.click(light.getByRole("button", { name: /^Use suggestion for primary-foreground, Light/ }));
    expect(cell("primary", "Light").queryByText(BASE_PAIR_VERDICT)).toBeNull();
    expect(cell("primary", "Light").getByText("AA pass")).toBeInTheDocument();
    expect(cell("primary", "Light").getByText("✓")).toBeInTheDocument();
    expect(cell("primary", "Light").getByText("Set by this skin")).toBeInTheDocument();
    expect(cell("primary", "Light").queryByRole("button", { name: /^Use suggestion/ })).toBeNull();
  });

  it("shows a failing pair the skin sets as AA fail, with a suggestion", async () => {
    const user = userEvent.setup();
    renderEditor();
    await skinCss();
    await showGroup(user, "Brand");
    await typeColour(user, textField("primary", "Light"), "0 0% 96%");
    const light = cell("primary", "Light");
    expect(light.getByText("AA fail")).toBeInTheDocument();
    expect(light.getByText("✗")).toBeInTheDocument();
    expect(light.getByRole("button", { name: /^Use suggestion for primary-foreground, Light/ })).toBeInTheDocument();
  });

  it("flags a pair the skin sets one side of, and Set … too completes it", async () => {
    const user = userEvent.setup();
    renderEditor();
    await skinCss();
    await showGroup(user, "Brand");
    await typeColour(user, textField("primary", "Light"), "200 50% 40%");
    await showGroup(user, "Text");
    await user.click(cell("primary-foreground", "Light").getByRole("button", { name: "Use base colour for primary-foreground, Light" }));
    const text = cell("primary-foreground", "Light");
    expect(text.getByText(INCOMPLETE_VERDICT)).toBeInTheDocument();
    expect(text.getByText("!")).toBeInTheDocument();

    await user.click(text.getByRole("button", { name: `${setTooLabel("primary-foreground")}, Light` }));
    expect(cell("primary-foreground", "Light").queryByText(INCOMPLETE_VERDICT)).toBeNull();
    expect(cell("primary-foreground", "Light").getByText(/^AA (pass|fail)$/)).toBeInTheDocument();
    expect(cell("primary-foreground", "Light").getByText("Set by this skin")).toBeInTheDocument();
  });

  it("undoes and redoes with the buttons and the keyboard", async () => {
    const user = userEvent.setup();
    renderEditor();
    await skinCss();
    await showGroup(user, "Brand");
    await typeColour(user, textField("primary", "Light"), "200 50% 40%");
    expect(await skinCss()).toContain("--primary: 200 50% 40%;");

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(await skinCss()).not.toContain("--primary: 200 50% 40%;");
    expect(textField("primary", "Light")).toHaveValue(basePalette("studio", "light").primary);

    await user.click(document.body);
    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(await skinCss()).toContain("--primary: 200 50% 40%;");
    await user.keyboard("{Control>}z{/Control}");
    expect(await skinCss()).not.toContain("--primary: 200 50% 40%;");
    await user.keyboard("{Control>}y{/Control}");
    expect(await skinCss()).toContain("--primary: 200 50% 40%;");
  });

  it("hides a tone's column when the skin drops that tone, and keeps at least one", async () => {
    const user = userEvent.setup();
    renderEditor();
    await skinCss();
    const tones = within(screen.getByRole("group", { name: "Tones" }));
    await user.click(tones.getByRole("button", { name: "Light" }));
    expect(screen.queryByRole("textbox", { name: "background, Light, hex or HSL" })).toBeNull();
    expect(textField("background", "Dark")).toBeInTheDocument();
    expect(screen.queryByRole("figure", { name: "Light preview" })).toBeNull();
    expect(tones.getByRole("button", { name: "Dark" })).toBeDisabled();
    expect(tones.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(toneLockNote("dark"))).toBeInTheDocument();
    expect(toneLockNote("dark")).toBe("Dark only: Studio locks Dark while this skin is on.");
  });

  it("moves the radius and glow sliders, with their values shown", async () => {
    renderEditor();
    await skinCss();
    fireEvent.change(screen.getByRole("slider", { name: "Radius" }), { target: { value: "16" } });
    fireEvent.change(screen.getByRole("slider", { name: "Glow" }), { target: { value: "24" } });
    expect(screen.getByText("16 px")).toBeInTheDocument();
    expect(screen.getByText("24 px")).toBeInTheDocument();
    const css = await skinCss();
    expect(css).toContain("--radius: 16px;");
    expect(css).toContain("--skin-glow: 24px;");
  });

  it("keeps the draft in this browser, so it survives a reload", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const source: StorageSource = () => storage;
    const first = renderEditor(source);
    await skinCss();
    expect(screen.getByRole("status")).toHaveTextContent(KEPT_STATUS);
    await showGroup(user, "Brand");
    await typeColour(user, textField("primary", "Light"), "200 50% 40%");
    expect(storage.getItem(DRAFT_KEY)).toContain("200 50% 40%");
    first.unmount();

    renderEditor(source);
    expect(await skinCss()).toContain("--primary: 200 50% 40%;");
    await showGroup(user, "Brand");
    await waitFor(() => expect(textField("primary", "Light")).toHaveValue("200 50% 40%"));
  });

  it("still works when the browser blocks storage, and says the draft isn't kept", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderEditor(blockedStorage);
    await skinCss();
    expect(screen.getByRole("status")).toHaveTextContent(NOT_KEPT_STATUS);
    await typeColour(user, textField("card", "Light"), "120 40% 50%");
    expect(await skinCss()).toContain("--card: 120 40% 50%;");
  });
});
