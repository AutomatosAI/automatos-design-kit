import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EXPORT_LABEL,
  IMPORT_LABEL,
  LOAD_LABEL,
  MARKETPLACE_LINK,
  PACK_HEADING,
  SUBMIT_LABEL,
} from "@/components/skins/PackPanel";
import { SkinEditor } from "@/components/skins/SkinEditor";
import { SKIN_CSS_TEST_ID } from "@/components/skins/SkinPreviewStrip";
import { readBytes } from "@/components/skins/files";
import { NOT_EXPORTED, NOT_IMPORTED } from "@/components/skins/usePackActions";
import { memoryAssetStore } from "@/lib/skins/asset-store";
import { ownBuffer } from "@/lib/skins/assets";
import { DRAFT_KEY, DRAFT_STORE_VERSION } from "@/lib/skins/draft-store";
import { draftFromSkin, setMeta, type SkinDraft } from "@/lib/skins/model";
import { packSkin, unpackSkin } from "@/lib/skins/pack";
import { NO_SKINS_MESSAGE, SKIN_KIT_HEADER } from "@/lib/skins/sharing";
import { validateSkin } from "@/lib/skins/validate";

import { memoryStorage, stubObjectUrls } from "../looks/helpers";
import { TEXT_BYTES, validSkin } from "./helpers";

// PRD-004 K-007 in the editor: Export downloads the draft as a .autoskin, Import loads one
// (validated, with plain-word errors), Load into my Automatos and Submit post it to the kit's own
// routes, and the Marketplace link opens Studio's page.

const fetchMock = vi.fn<typeof fetch>();

function validDraft(): SkinDraft {
  const checked = validateSkin(validSkin(), []);
  if (!checked.ok) throw new Error("the fixture skin must be valid");
  return draftFromSkin(checked.skin);
}

function answer(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

async function renderEditor(draft: SkinDraft = validDraft()): Promise<Storage> {
  const storage = memoryStorage({ [DRAFT_KEY]: JSON.stringify({ version: DRAFT_STORE_VERSION, draft }) });
  render(<SkinEditor storage={() => storage} assetStore={memoryAssetStore()} />);
  await screen.findByTestId(SKIN_CSS_TEST_ID);
  return storage;
}

function storedDraft(storage: Storage): SkinDraft {
  const raw = storage.getItem(DRAFT_KEY);
  if (raw === null) throw new Error("no stored draft");
  return (JSON.parse(raw) as { draft: SkinDraft }).draft;
}

const panel = () => within(screen.getByRole("region", { name: PACK_HEADING }));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Export", () => {
  it("downloads <slug>-<version>.autoskin, a package that unpacks to the draft", async () => {
    const made: Blob[] = [];
    const revoke = vi.fn();
    const restore = stubObjectUrls((blob) => {
      made.push(blob);
      return `blob:http://localhost/00000000-0000-4000-8000-${String(made.length).padStart(12, "0")}`;
    }, revoke);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    try {
      const user = userEvent.setup();
      await renderEditor();
      await user.click(panel().getByRole("button", { name: EXPORT_LABEL }));

      expect(click).toHaveBeenCalledTimes(1);
      const link = click.mock.contexts[0] as HTMLAnchorElement;
      expect(link.download).toBe("warm-paper-1.0.0.autoskin");
      const blob = made.at(-1);
      expect(blob?.type).toBe("application/zip");
      const unpacked = blob ? unpackSkin(await readBytes(blob)) : null;
      expect(unpacked?.ok && unpacked.skin.name).toBe("Warm Paper");
      expect(panel().getByText("Exported warm-paper-1.0.0.autoskin.")).toBeInTheDocument();
      await waitFor(() => expect(revoke).toHaveBeenCalled(), { timeout: 2000 });
    } finally {
      restore();
    }
  });

  it("refuses a draft Studio would refuse and says why, in words", async () => {
    const user = userEvent.setup();
    await renderEditor(setMeta(validDraft(), { author: "" }));
    await user.click(panel().getByRole("button", { name: EXPORT_LABEL }));

    const alert = await panel().findByRole("alert");
    expect(alert).toHaveTextContent(NOT_EXPORTED);
    expect(alert).toHaveTextContent(/\$\.author: /);
  });
});

describe("Import", () => {
  it("loads a valid .autoskin as the draft", async () => {
    const skin = { ...validSkin(), slug: "night-paper", name: "Night Paper" };
    const packed = packSkin(JSON.stringify(skin), []);
    if (!packed.ok) throw new Error("the fixture package must pack");
    const user = userEvent.setup();
    const storage = await renderEditor();

    await user.upload(panel().getByLabelText(IMPORT_LABEL), new File([ownBuffer(packed.bytes)], packed.fileName));

    expect(await panel().findByText(/^Imported Night Paper\./)).toBeInTheDocument();
    await waitFor(() => expect(storedDraft(storage).meta.slug).toBe("night-paper"));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Night Paper");
  });

  it("refuses a file that isn't a skin and leaves the draft alone", async () => {
    const user = userEvent.setup();
    const storage = await renderEditor();

    await user.upload(panel().getByLabelText(IMPORT_LABEL), new File([ownBuffer(TEXT_BYTES)], "notes.autoskin"));

    const alert = await panel().findByRole("alert");
    expect(alert).toHaveTextContent(NOT_IMPORTED);
    expect(alert).toHaveTextContent("it isn't a zip Studio can read");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Warm Paper");
    expect(storage.getItem(DRAFT_KEY)).not.toContain("night-paper");
  });
});

describe("Load into my Automatos and Submit", () => {
  it("posts the packed skin to the kit's import route with X-Skin-Kit: 1 and says it worked", async () => {
    fetchMock.mockResolvedValue(answer(200, { name: "Warm Paper" }));
    const user = userEvent.setup();
    await renderEditor();

    await user.click(panel().getByRole("button", { name: LOAD_LABEL }));

    expect(await panel().findByText(/^Warm Paper is in your Automatos\./)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/studio/import-skin");
    expect(new Headers(init?.headers).get(SKIN_KIT_HEADER)).toBe("1");
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it("says the Automatos doesn't support skins yet when it answers 404", async () => {
    fetchMock.mockResolvedValue(answer(404, { error: NO_SKINS_MESSAGE }));
    const user = userEvent.setup();
    await renderEditor();

    await user.click(panel().getByRole("button", { name: SUBMIT_LABEL }));

    const alert = await panel().findByRole("alert");
    expect(alert).toHaveTextContent(NO_SKINS_MESSAGE);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/studio/submit-skin");
  });

  it("sends nothing when the draft is invalid", async () => {
    const user = userEvent.setup();
    await renderEditor(setMeta(validDraft(), { author: "" }));

    await user.click(panel().getByRole("button", { name: LOAD_LABEL }));

    expect(await panel().findByRole("alert")).toHaveTextContent(/\$\.author: /);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("links to the Marketplace of the person's Automatos in a new tab", async () => {
    await renderEditor();
    const link = panel().getByRole("link", { name: MARKETPLACE_LINK });
    expect(link).toHaveAttribute("href", "http://localhost:3000/marketplace");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });
});
