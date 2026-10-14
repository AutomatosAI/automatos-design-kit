import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PreviewScreen } from "@/components/preview/PreviewScreen";
import { GALLERY_CSS_TEST_ID } from "@/components/preview/content";
import { SkinEditor } from "@/components/skins/SkinEditor";
import { SKIN_CSS_TEST_ID } from "@/components/skins/SkinPreviewStrip";
import { LIGHTS } from "@/lib/looks/catalogue";
import type { StorageSource } from "@/lib/looks/storage";
import { captionFor } from "@/lib/mascot/media";
import { FULL_MESSAGE, memoryAssetStore, type AssetStore } from "@/lib/skins/asset-store";
import { ownBuffer, type StoredAsset } from "@/lib/skins/assets";
import { normaliseColour } from "@/lib/skins/colour";
import { DRAFT_KEY, DRAFT_STORE_VERSION } from "@/lib/skins/draft-store";
import { MASCOT_FORMATS, MASCOT_STATES } from "@/lib/skins/format";
import { startDraft, type SkinDraft } from "@/lib/skins/model";

import { memoryStorage, stubObjectUrls } from "../looks/helpers";
import { PNG_BYTES, WOFF2_BYTES, bytesFor } from "./helpers";

// PRD-004 K-006: fonts and mascot in the editor. A file that isn't woff2 is refused in words, a
// woff2 file reaches the preview through @font-face from an object URL, a custom mascot set
// lists what it is missing, the mode switch updates the draft, and the files survive a reload.

const MINT = normaliseColour(LIGHTS.mint.hex) ?? "";

let restoreUrls: (() => void) | null = null;
let made = 0;

/** Object URLs in the shape the browser makes them, so skinToCss accepts them. */
function fakeObjectUrls(): void {
  made = 0;
  restoreUrls = stubObjectUrls(
    () => {
      made += 1;
      return `blob:http://localhost/00000000-0000-4000-8000-${String(made).padStart(12, "0")}`;
    },
    () => undefined,
  );
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  restoreUrls?.();
  restoreUrls = null;
  vi.restoreAllMocks();
});

function file(name: string, bytes: Uint8Array): File {
  return new File([ownBuffer(bytes)], name);
}

function storageWith(draft?: SkinDraft): { readonly storage: Storage; readonly source: StorageSource } {
  const initial = draft ? { [DRAFT_KEY]: JSON.stringify({ version: DRAFT_STORE_VERSION, draft }) } : {};
  const storage = memoryStorage(initial);
  return { storage, source: () => storage };
}

function storedDraft(storage: Storage): SkinDraft {
  const raw = storage.getItem(DRAFT_KEY);
  if (raw === null) throw new Error("no stored draft");
  return (JSON.parse(raw) as { draft: SkinDraft }).draft;
}

async function renderEditor(assetStore: AssetStore = memoryAssetStore(), draft?: SkinDraft) {
  const { storage, source } = storageWith(draft);
  render(<SkinEditor storage={source} assetStore={assetStore} />);
  await screen.findByTestId(SKIN_CSS_TEST_ID);
  return storage;
}

const css = () => screen.getByTestId(SKIN_CSS_TEST_ID).textContent ?? "";
const slot = (label: "Sans" | "Serif" | "Mono") => within(screen.getByRole("group", { name: `${label} font` }));
const mascotModes = () => within(screen.getByRole("group", { name: "Mascot" }));

describe("fonts in the editor", () => {
  it("refuses a file that isn't woff2, in words, and changes nothing", async () => {
    const user = userEvent.setup();
    const assetStore = memoryAssetStore();
    await renderEditor(assetStore);
    await user.upload(slot("Sans").getByLabelText("Choose a .woff2 file for Sans"), file("sneaky.woff2", PNG_BYTES));
    expect(await slot("Sans").findByRole("alert")).toHaveTextContent(
      '"sneaky.woff2" isn\'t a woff2 font: its first bytes say it is a PNG image.',
    );
    expect(slot("Sans").getByRole("combobox", { name: "Sans" })).toHaveValue("");
    expect((await assetStore.load()).assets).toEqual([]);
    expect(css()).not.toContain("--font-geist-sans");
  });

  it("refuses a non-woff2 file chosen by type, too", async () => {
    const user = userEvent.setup({ applyAccept: false });
    await renderEditor();
    await user.upload(slot("Mono").getByLabelText("Choose a .woff2 file for Mono"), file("photo.png", PNG_BYTES));
    expect(await slot("Mono").findByRole("alert")).toHaveTextContent(/"photo\.png" isn't a woff2 font/);
  });

  it("uses a woff2 file: kept with the draft and loaded by the preview through @font-face from an object URL", async () => {
    fakeObjectUrls();
    const user = userEvent.setup();
    const assetStore = memoryAssetStore();
    const storage = await renderEditor(assetStore);
    await user.upload(slot("Sans").getByLabelText("Choose a .woff2 file for Sans"), file("My Face.woff2", WOFF2_BYTES));

    await waitFor(() => expect(css()).toContain('@font-face {\n  font-family: "skin-kit-draft-sans";\n  src: url("blob:http://localhost/'));
    expect(css()).toContain('--font-geist-sans: "skin-kit-draft-sans", ui-sans-serif, system-ui, sans-serif;');
    expect(slot("Sans").getByRole("combobox", { name: "Sans" })).toHaveValue("assets/fonts/sans-My-Face.woff2");
    expect(slot("Sans").getByText(/Your file: My Face\.woff2 \(1 KB\)/)).toBeInTheDocument();
    expect(storedDraft(storage).fonts).toEqual({ sans: "assets/fonts/sans-My-Face.woff2" });
    const kept = (await assetStore.load()).assets;
    expect(kept.map((asset) => [asset.path, asset.name])).toEqual([["assets/fonts/sans-My-Face.woff2", "My Face.woff2"]]);
  });

  it("picks one of Studio's fonts, and back to Studio's default", async () => {
    const user = userEvent.setup();
    const storage = await renderEditor();
    await user.selectOptions(slot("Serif").getByRole("combobox", { name: "Serif" }), "Newsreader");
    expect(css()).toContain('--font-newsreader: "Newsreader", Georgia, ui-serif, serif;');
    expect(storedDraft(storage).fonts).toEqual({ serif: "Newsreader" });
    await user.selectOptions(slot("Serif").getByRole("combobox", { name: "Serif" }), "Studio's default");
    expect(storedDraft(storage).fonts).toEqual({});
    expect(css()).not.toContain("--font-newsreader");
  });

  it("says in words when the browser has no room for the file, and still uses it for this visit", async () => {
    const user = userEvent.setup();
    const full: AssetStore = { ...memoryAssetStore(), put: async () => ({ ok: false as const, message: FULL_MESSAGE }) };
    await renderEditor(full);
    await user.upload(slot("Sans").getByLabelText("Choose a .woff2 file for Sans"), file("face.woff2", WOFF2_BYTES));
    expect(await screen.findByText(FULL_MESSAGE)).toBeInTheDocument();
    expect(slot("Sans").getByRole("combobox", { name: "Sans" })).toHaveValue("assets/fonts/sans-face.woff2");
  });

  it("keeps the files across a reload, and drops font files the draft no longer names", async () => {
    const face: StoredAsset = { path: "assets/fonts/face.woff2", name: "Face.woff2", bytes: WOFF2_BYTES };
    const old: StoredAsset = { path: "assets/fonts/old.woff2", name: "Old.woff2", bytes: WOFF2_BYTES };
    const assetStore = memoryAssetStore([face, old]);
    await renderEditor(assetStore, { ...startDraft("studio"), fonts: { sans: face.path } });
    expect(await slot("Sans").findByText(/Your file: Face\.woff2/)).toBeInTheDocument();
    await waitFor(async () => expect((await assetStore.load()).assets.map((asset) => asset.path)).toEqual([face.path]));
  });

  it("says when a font the draft names isn't in this browser any more", async () => {
    await renderEditor(memoryAssetStore(), { ...startDraft("studio"), fonts: { mono: "assets/fonts/gone.woff2" } });
    expect(await slot("Mono").findByText(/assets\/fonts\/gone\.woff2 isn't in this browser any more/)).toBeInTheDocument();
  });
});

describe("the mascot in the editor", () => {
  it("starts Off, and switching the mode updates the draft", async () => {
    const user = userEvent.setup();
    const storage = await renderEditor();
    expect(mascotModes().getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("group", { name: "Mascot state" })).toBeNull();

    await user.click(mascotModes().getByRole("button", { name: "Auto" }));
    expect(storedDraft(storage).mascot).toEqual({ mode: "auto", shell: "bronze", light: MINT });
    expect(mascotModes().getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(screen.getByRole("group", { name: "Shell tint" })).getByRole("button", { name: "Cobalt" }));
    await user.click(within(screen.getByRole("group", { name: "Light colour" })).getByRole("button", { name: "Rose" }));
    expect(storedDraft(storage).mascot).toEqual({ mode: "auto", shell: "cobalt", light: normaliseColour(LIGHTS.rose.hex) });

    await user.click(mascotModes().getByRole("button", { name: "Custom" }));
    expect(storedDraft(storage).mascot).toEqual({ mode: "custom", light: normaliseColour(LIGHTS.rose.hex) });
    expect(screen.queryByRole("group", { name: "Shell tint" })).toBeNull();
    expect(screen.getByLabelText("Choose mascot files")).toBeInTheDocument();

    await user.click(mascotModes().getByRole("button", { name: "Off" }));
    expect(storedDraft(storage).mascot).toEqual({ mode: "off" });
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(storedDraft(storage).mascot.mode).toBe("custom");
  });

  it("plays each state from the state picker (Auto's stand-in while his clips are missing)", async () => {
    const user = userEvent.setup();
    await renderEditor();
    await user.click(mascotModes().getByRole("button", { name: "Auto" }));
    const states = within(screen.getByRole("group", { name: "Mascot state" }));
    expect(states.getAllByRole("button")).toHaveLength(MASCOT_STATES.length);
    expect(states.getByRole("button", { name: "Idle" })).toHaveAttribute("aria-pressed", "true");
    await user.click(states.getByRole("button", { name: "Searching" }));
    expect(states.getByRole("button", { name: "Searching" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(captionFor("searching"))).toBeInTheDocument();
    expect(await screen.findByTestId("auto-placeholder")).toHaveTextContent("searching");
  });

  it("lists what a custom set is missing", async () => {
    const user = userEvent.setup();
    const assetStore = memoryAssetStore();
    await renderEditor(assetStore);
    await user.click(mascotModes().getByRole("button", { name: "Custom" }));
    expect(screen.getByText(/^0 of 36 files\. Missing: hello \(webm, mp4, png\)/)).toBeInTheDocument();

    const skip = ["hello.webm", "hello.mp4", "hello.png", "oops.png"];
    const files = MASCOT_STATES.flatMap((state) =>
      MASCOT_FORMATS.filter((format) => !skip.includes(`${state}.${format}`)).map((format) =>
        file(`${state}.${format}`, bytesFor(format)),
      ),
    );
    await user.upload(screen.getByLabelText("Choose mascot files"), files);
    expect(await screen.findByText("32 of 36 files. Missing: hello (webm, mp4, png), oops (png).")).toBeInTheDocument();
    await waitFor(async () => expect((await assetStore.load()).assets).toHaveLength(32));
    expect(screen.getByRole("button", { name: "Remove the mascot files" })).toBeInTheDocument();
  });

  it("refuses a custom file whose bytes aren't its kind", async () => {
    const user = userEvent.setup();
    const assetStore = memoryAssetStore();
    await renderEditor(assetStore);
    await user.click(mascotModes().getByRole("button", { name: "Custom" }));
    await user.upload(screen.getByLabelText("Choose mascot files"), [file("idle.webm", PNG_BYTES), file("idle.png", PNG_BYTES)]);
    expect(await screen.findByRole("alert")).toHaveTextContent('"idle.webm" isn\'t a WebM video: its first bytes say it is a PNG image.');
    await waitFor(async () => expect((await assetStore.load()).assets.map((asset) => asset.path)).toEqual(["assets/mascot/idle.png"]));
  });
});

describe("fonts in the preview gallery", () => {
  it("loads the draft's font files there too", async () => {
    fakeObjectUrls();
    const face: StoredAsset = { path: "assets/fonts/face.woff2", name: "Face.woff2", bytes: WOFF2_BYTES };
    const { source } = storageWith({ ...startDraft("studio"), fonts: { serif: face.path } });
    render(<PreviewScreen storage={source} assetStore={memoryAssetStore([face])} />);
    await waitFor(() =>
      expect(screen.getByTestId(GALLERY_CSS_TEST_ID).textContent).toContain('font-family: "skin-kit-draft-serif";\n  src: url("blob:'),
    );
  });
});
