import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PreviewScreen } from "@/components/preview/PreviewScreen";
import { GALLERY_CSS_TEST_ID } from "@/components/preview/content";
import { SkinEditor } from "@/components/skins/SkinEditor";
import { SKIN_CSS_TEST_ID } from "@/components/skins/SkinPreviewStrip";
import type { StorageSource } from "@/lib/looks/storage";
import { captionFor } from "@/lib/mascot/media";
import { FULL_MESSAGE, memoryAssetStore, type AssetStore } from "@/lib/skins/asset-store";
import { ownBuffer, type StoredAsset } from "@/lib/skins/assets";
import { DRAFT_KEY, DRAFT_STORE_VERSION } from "@/lib/skins/draft-store";
import type { FontHost } from "@/lib/skins/font-faces";
import { MASCOT_FORMATS, MASCOT_STATES } from "@/lib/skins/format";
import { startDraft, type SkinDraft } from "@/lib/skins/model";

import { memoryStorage } from "../looks/helpers";
import { PNG_BYTES, WOFF2_BYTES, bytesFor } from "./helpers";

// PRD-004 K-006: fonts and mascot in the editor. A file that isn't woff2 is refused in words, a
// woff2 file reaches the preview through the FontFace API (K-010, decision K2: no @font-face), a
// custom mascot set lists what it is missing, the mode switch updates the draft, and the files
// survive a reload.

interface Registered {
  readonly family: string;
  readonly bytes: number;
  removed: boolean;
}

/** A FontFace host that records what the page registers and removes. */
function fakeFontHost(): { readonly host: FontHost; readonly registered: Registered[] } {
  const registered: Registered[] = [];
  const host: FontHost = {
    register: async (family, bytes) => {
      const entry: Registered = { family, bytes: bytes.byteLength, removed: false };
      registered.push(entry);
      return () => {
        entry.removed = true;
      };
    },
  };
  return { host, registered };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function file(name: string, bytes: Uint8Array): File {
  return new File([ownBuffer(bytes)], name);
}

function storageWith(draft?: SkinDraft): { readonly storage: Storage; readonly source: StorageSource } {
  const initial: Record<string, string> = draft ? { [DRAFT_KEY]: JSON.stringify({ version: DRAFT_STORE_VERSION, draft }) } : {};
  const storage = memoryStorage(initial);
  return { storage, source: () => storage };
}

function storedDraft(storage: Storage): SkinDraft {
  const raw = storage.getItem(DRAFT_KEY);
  if (raw === null) throw new Error("no stored draft");
  return (JSON.parse(raw) as { draft: SkinDraft }).draft;
}

async function renderEditor(assetStore: AssetStore = memoryAssetStore(), draft?: SkinDraft, fontHost: FontHost | null = null) {
  const { storage, source } = storageWith(draft);
  render(<SkinEditor storage={source} assetStore={assetStore} fontHost={fontHost} />);
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

  it("uses a woff2 file: kept with the draft and registered for the preview through the FontFace API", async () => {
    const user = userEvent.setup();
    const assetStore = memoryAssetStore();
    const fonts = fakeFontHost();
    const storage = await renderEditor(assetStore, undefined, fonts.host);
    await user.upload(slot("Sans").getByLabelText("Choose a .woff2 file for Sans"), file("My Face.woff2", WOFF2_BYTES));

    const live = () => fonts.registered.filter((entry) => !entry.removed);
    await waitFor(() => expect(live()).toEqual([{ family: "skin-kit-draft-sans", bytes: WOFF2_BYTES.length, removed: false }]));
    expect(css()).toContain('--font-geist-sans: "skin-kit-draft-sans", ui-sans-serif, system-ui, sans-serif;');
    expect(css()).not.toContain("@font-face");
    expect(css()).not.toContain("url(");
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
    expect(storedDraft(storage).fonts).toEqual({ serif: "newsreader" });
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
    expect(storedDraft(storage).mascot).toEqual({ mode: "auto", shell: "bronze", light: "mint" });
    expect(mascotModes().getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(screen.getByRole("group", { name: "Shell tint" })).getByRole("button", { name: "Cobalt" }));
    await user.click(within(screen.getByRole("group", { name: "Light colour" })).getByRole("button", { name: "Rose" }));
    expect(storedDraft(storage).mascot).toEqual({ mode: "auto", shell: "cobalt", light: "rose" });

    await user.click(mascotModes().getByRole("button", { name: "Custom" }));
    expect(storedDraft(storage).mascot).toEqual({ mode: "custom", light: "rose" });
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
  it("registers the draft's font files there too, and removes them when the page goes", async () => {
    const face: StoredAsset = { path: "assets/fonts/face.woff2", name: "Face.woff2", bytes: WOFF2_BYTES };
    const { source } = storageWith({ ...startDraft("studio"), fonts: { serif: face.path } });
    const fonts = fakeFontHost();
    const { unmount } = render(<PreviewScreen storage={source} assetStore={memoryAssetStore([face])} fontHost={fonts.host} />);
    const live = () => fonts.registered.filter((entry) => !entry.removed).map((entry) => entry.family);
    await waitFor(() => expect(live()).toEqual(["skin-kit-draft-serif"]));
    await waitFor(() => expect(screen.getByTestId(GALLERY_CSS_TEST_ID).textContent).toContain('"skin-kit-draft-serif"'));
    expect(screen.getByTestId(GALLERY_CSS_TEST_ID).textContent).not.toContain("@font-face");
    unmount();
    await waitFor(() => expect(fonts.registered.every((entry) => entry.removed)).toBe(true));
  });
});
