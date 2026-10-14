import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LooksScreen as LooksPage } from "@/components/looks/LooksScreen";
import { LookProvider } from "@/components/looks/LookProvider";
import { lookToCssVars } from "@/lib/looks/css";
import { EMBER, PRESETS } from "@/lib/looks/presets";
import { ACTIVE_LOOK_KEY, SAVED_LOOKS_KEY } from "@/lib/looks/storage";
import { LOOK_FILE_MAX_BYTES, NOT_JSON, TOO_BIG, lookJson } from "@/lib/looks/transfer";

import { blobText, clearRoot, myLook, rootVars, stubObjectUrls } from "./helpers";

// PRD-002 L-005: rename, duplicate and delete saved Looks (presets duplicate only), Export and
// Copy JSON, and Import from pasted JSON or a file through the validator.

type User = ReturnType<typeof userEvent.setup>;

const BLOB_URL = "blob:play/look";

function renderLooks() {
  return render(
    <LookProvider>
      <LooksPage />
    </LookProvider>,
  );
}

const status = () => screen.getByRole("status");
const looksRow = () => within(screen.getByRole("region", { name: "Looks" }));
const manage = () => within(screen.getByRole("region", { name: "This look" }));
const importer = () => within(screen.getByRole("region", { name: "Import a look" }));

function stored(key: string): unknown {
  const raw = window.localStorage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}

function pressedCard(): HTMLElement {
  const pressed = looksRow().getAllByRole("button", { pressed: true });
  expect(pressed).toHaveLength(1);
  return pressed[0] as HTMLElement;
}

async function ready(): Promise<void> {
  await waitFor(() => expect(rootVars()).toEqual(lookToCssVars(EMBER)));
}

/** Starts on the user's own "My look 1" (rose on Night). */
async function readyOnMyLook(): Promise<void> {
  window.localStorage.setItem(SAVED_LOOKS_KEY, JSON.stringify([myLook()]));
  window.localStorage.setItem(ACTIVE_LOOK_KEY, JSON.stringify(myLook()));
  renderLooks();
  await waitFor(() => expect(status()).toHaveTextContent(/^My look 1$/));
}

async function paste(user: User, text: string): Promise<void> {
  await user.click(importer().getByLabelText("Paste a Look's JSON"));
  await user.paste(text);
  await user.click(importer().getByRole("button", { name: "Import pasted JSON" }));
}

beforeEach(() => {
  window.localStorage.clear();
  clearRoot();
  // Auto's files are never in CI (his still warns), and refused imports are logged.
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  clearRoot();
});

describe("managing Looks", () => {
  it("only offers Duplicate (plus Export and Copy JSON) for a preset", async () => {
    renderLooks();
    await ready();
    expect(manage().getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Duplicate",
      "Export",
      "Copy JSON",
    ]);
  });

  it("duplicates a preset into a saved Look and picks it", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    await user.click(manage().getByRole("button", { name: "Duplicate" }));

    const copy = { ...EMBER, id: "look-1", name: "Ember copy" };
    expect(pressedCard()).toHaveTextContent(`${copy.name} ${copy.sub}`);
    expect(status()).toHaveTextContent(/^Ember copy$/);
    expect(manage().getByText("Duplicated as Ember copy.")).toBeInTheDocument();
    expect(stored(SAVED_LOOKS_KEY)).toEqual([copy]);
    expect(stored(ACTIVE_LOOK_KEY)).toEqual(copy);
    // The copy is the user's own: it can be renamed and deleted.
    expect(manage().getByRole("button", { name: "Rename" })).toBeInTheDocument();
  });

  it("keeps unsaved edits in the copy", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    await user.click(within(screen.getByRole("group", { name: /^Accent/ })).getByRole("button", { name: "Rose" }));
    expect(status()).toHaveTextContent(/^Ember · edited$/);
    await user.click(manage().getByRole("button", { name: "Duplicate" }));

    const copy = { ...EMBER, id: "look-1", name: "Ember copy", accent: "rose" };
    expect(stored(SAVED_LOOKS_KEY)).toEqual([copy]);
    expect(status()).toHaveTextContent(/^Ember copy$/);
  });

  it("closes an open form when another Look is picked", async () => {
    const user = userEvent.setup();
    await readyOnMyLook();
    await user.click(manage().getByRole("button", { name: "Rename" }));
    expect(manage().getByRole("textbox", { name: "New name" })).toBeInTheDocument();
    await user.click(looksRow().getByRole("button", { name: /^Aurora\b/ }));
    await user.click(looksRow().getByRole("button", { name: /^My look 1\b/ }));
    expect(manage().queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renames a saved Look", async () => {
    const user = userEvent.setup();
    await readyOnMyLook();
    expect(manage().getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Rename",
      "Duplicate",
      "Delete",
      "Export",
      "Copy JSON",
    ]);

    await user.click(manage().getByRole("button", { name: "Rename" }));
    const field = manage().getByRole("textbox", { name: "New name" });
    expect(field).toHaveValue("My look 1");
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, "Sunset");
    await user.click(manage().getByRole("button", { name: "Save name" }));

    expect(status()).toHaveTextContent(/^Sunset$/);
    expect(pressedCard()).toHaveTextContent("Sunset");
    expect(manage().getByText("Renamed to Sunset.")).toBeInTheDocument();
    expect(manage().queryByRole("textbox")).not.toBeInTheDocument();
    expect(stored(SAVED_LOOKS_KEY)).toEqual([myLook({ name: "Sunset" })]);
    expect(stored(ACTIVE_LOOK_KEY)).toEqual(myLook({ name: "Sunset" }));
  });

  it("says in words why a name wasn't saved, and keeps the old one", async () => {
    const user = userEvent.setup();
    await readyOnMyLook();
    await user.click(manage().getByRole("button", { name: "Rename" }));
    await user.clear(manage().getByRole("textbox", { name: "New name" }));
    await user.click(manage().getByRole("button", { name: "Save name" }));

    const alert = manage().getByRole("alert");
    expect(alert).toHaveTextContent("That name wasn't saved.");
    expect(alert).toHaveTextContent(`"name" can't be empty.`);
    expect(status()).toHaveTextContent(/^My look 1$/);
    expect(stored(SAVED_LOOKS_KEY)).toEqual([myLook()]);
  });

  it("deletes a saved Look only once confirmed, then goes back to Ember", async () => {
    const user = userEvent.setup();
    await readyOnMyLook();
    await user.click(manage().getByRole("button", { name: "Delete" }));
    const confirm = () => within(screen.getByRole("group", { name: /^Delete My look 1\?/ }));
    await user.click(confirm().getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("group", { name: /^Delete My look 1\?/ })).not.toBeInTheDocument();
    expect(stored(SAVED_LOOKS_KEY)).toEqual([myLook()]);

    await user.click(manage().getByRole("button", { name: "Delete" }));
    await user.click(confirm().getByRole("button", { name: "Delete look" }));
    expect(status()).toHaveTextContent(/^Ember$/);
    expect(looksRow().getAllByRole("button")).toHaveLength(PRESETS.length);
    expect(manage().getByText("Deleted My look 1. Play is back to Ember.")).toBeInTheDocument();
    expect(stored(SAVED_LOOKS_KEY)).toEqual([]);
    await ready();
  });
});

describe("Export and Copy JSON", () => {
  let restoreUrls: () => void = () => undefined;
  const blobs: Blob[] = [];
  const revoke = vi.fn<(url: string) => void>();

  beforeEach(() => {
    blobs.length = 0;
    revoke.mockReset();
    restoreUrls = stubObjectUrls((blob) => {
      blobs.push(blob);
      return BLOB_URL;
    }, revoke);
  });

  afterEach(() => restoreUrls());

  async function exportActive(user: User): Promise<string> {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    await user.click(manage().getByRole("button", { name: "Export" }));
    expect(click).toHaveBeenCalledTimes(1);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(BLOB_URL);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]?.type).toBe("application/json");
    // The URL is let go once the download has started.
    await waitFor(() => expect(revoke).toHaveBeenCalledWith(BLOB_URL), { timeout: 2000 });
    return link.download;
  }

  it("downloads <name>.look.json holding the active Look, pretty-printed", async () => {
    const user = userEvent.setup();
    await readyOnMyLook();
    expect(await exportActive(user)).toBe("My look 1.look.json");
    expect(await blobText(blobs[0] as Blob)).toBe(lookJson(myLook()));
    expect(manage().getByText("Downloaded My look 1.look.json.")).toBeInTheDocument();
  });

  it("round-trips: an exported Look imports as an equal saved Look with a new id", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    await exportActive(user);
    const text = await blobText(blobs[0] as Blob);

    await paste(user, text);
    const imported = { ...EMBER, id: "look-1" };
    expect(stored(SAVED_LOOKS_KEY)).toEqual([imported]);
    expect(stored(ACTIVE_LOOK_KEY)).toEqual(imported);
    const cards = looksRow().getAllByRole("button");
    expect(cards).toHaveLength(PRESETS.length + 1);
    expect(cards.at(-1)).toHaveAttribute("aria-pressed", "true");
    expect(importer().getByText("Added Ember to your Looks.")).toBeInTheDocument();
    expect(importer().getByLabelText("Paste a Look's JSON")).toHaveValue("");
  });

  it("copies the active Look's JSON", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    await user.click(manage().getByRole("button", { name: "Copy JSON" }));
    expect(await navigator.clipboard.readText()).toBe(lookJson(EMBER));
    expect(manage().getByText("Copied the JSON.")).toBeInTheDocument();
  });

  it("says so when the browser blocks the clipboard", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    const denied = new DOMException("Write permission denied.", "NotAllowedError");
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(denied);
    await user.click(manage().getByRole("button", { name: "Copy JSON" }));
    expect(await manage().findByRole("alert")).toHaveTextContent("The JSON wasn't copied.");
    expect(console.error).toHaveBeenCalledWith("[looks] copy failed", denied);
  });
});

describe("Import", () => {
  function fileInput(): HTMLInputElement {
    return importer().getByLabelText<HTMLInputElement>("Or choose a .json file");
  }

  it("adds a valid .json file as a saved Look with a fresh id, and picks it", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    const file = new File([lookJson(myLook({ id: "ember" }))], "mine.look.json", { type: "application/json" });
    await user.upload(fileInput(), file);

    const added = myLook({ id: "look-1" });
    await waitFor(() => expect(stored(SAVED_LOOKS_KEY)).toEqual([added]));
    expect(status()).toHaveTextContent(/^My look 1$/);
    expect(pressedCard()).toHaveTextContent("My look 1");
    expect(importer().getByText("Added My look 1 to your Looks.")).toBeInTheDocument();
  });

  it("shows an invalid file's errors in plain words and adds nothing", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    const bad = JSON.stringify({ ...EMBER, schema: "nope", accent: "#ff0000", script: "alert(1)" });
    await user.upload(fileInput(), new File([bad], "bad.look.json", { type: "application/json" }));

    const alert = await importer().findByRole("alert");
    expect(alert).toHaveTextContent("That look wasn't added.");
    expect(alert).toHaveTextContent(`"script" isn't part of a Look. Remove it.`);
    expect(alert).toHaveTextContent(`This isn't a v1 Look: "schema" must be "automatos-interface-look/v1".`);
    expect(alert).toHaveTextContent(`"accent" must be one of the catalogue's accents`);
    expect(looksRow().getAllByRole("button")).toHaveLength(PRESETS.length);
    expect(status()).toHaveTextContent(/^Ember$/);
    expect(stored(SAVED_LOOKS_KEY)).toBeNull();
  });

  it("rejects a 1 MB file before reading it", async () => {
    const user = userEvent.setup();
    const read = vi.spyOn(FileReader.prototype, "readAsText");
    renderLooks();
    await ready();
    const big = new File([new Uint8Array(LOOK_FILE_MAX_BYTES)], "big.look.json", { type: "application/json" });
    await user.upload(fileInput(), big);

    expect(await importer().findByRole("alert")).toHaveTextContent(TOO_BIG);
    expect(read).not.toHaveBeenCalled();
    expect(stored(SAVED_LOOKS_KEY)).toBeNull();
  });

  it("refuses pasted text that isn't JSON and keeps it in the box to fix", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    await paste(user, "{ name: Ember");
    expect(importer().getByRole("alert")).toHaveTextContent(NOT_JSON);
    expect(importer().getByLabelText("Paste a Look's JSON")).toHaveValue("{ name: Ember");
    expect(stored(SAVED_LOOKS_KEY)).toBeNull();
  });

  it("never renders imported text as HTML", async () => {
    const user = userEvent.setup();
    renderLooks();
    await ready();
    await paste(user, JSON.stringify(myLook({ name: "<b>bold</b>", sub: "<img src=x onerror=alert(1)>" })));

    expect(pressedCard()).toHaveTextContent("<b>bold</b> <img src=x onerror=alert(1)>");
    expect(importer().getByText("Added <b>bold</b> to your Looks.")).toBeInTheDocument();
    const row = screen.getByRole("region", { name: "Looks" });
    const imports = screen.getByRole("region", { name: "Import a look" });
    expect([row, imports].map((region) => region.querySelector("b, img"))).toEqual([null, null]);
    expect(status()).toHaveTextContent("<b>bold</b>");
  });
});
