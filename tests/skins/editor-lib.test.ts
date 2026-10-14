// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { DRAFT_KEY, DRAFT_STORE_VERSION, parseStoredDraft, readStoredDraft, writeStoredDraft } from "@/lib/skins/draft-store";
import { INITIAL_EDITOR_STATE, editorReducer, type EditorAction, type EditorState } from "@/lib/skins/editor-state";
import { ALLOWED_TOKENS } from "@/lib/skins/format";
import { COLOUR_GROUPS, groupById } from "@/lib/skins/groups";
import { setMeta, setShape, setToken, setTones, startDraft, type SkinDraft } from "@/lib/skins/model";

import { blockedStorage, memoryStorage } from "../looks/helpers";

// The skin editor's pure parts (PRD-004 K-004): the colour groups, the kept draft and the
// editor's undo/redo state with grouped edits.

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the colour groups", () => {
  it("hold every allowed token exactly once", () => {
    const grouped = COLOUR_GROUPS.flatMap((group) => group.tokens);
    expect([...grouped].sort()).toEqual([...ALLOWED_TOKENS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("are Surfaces, Text, Brand, Status, Charts and Studio aliases", () => {
    expect(COLOUR_GROUPS.map((group) => group.label)).toEqual(["Surfaces", "Text", "Brand", "Status", "Charts", "Studio aliases"]);
    expect(groupById("brand").tokens).toEqual(["primary", "accent", "ring", "destructive"]);
    expect(groupById("nope").id).toBe("surfaces");
  });
});

function edited(): SkinDraft {
  const draft = setToken(setMeta(startDraft("classic"), { name: "Harbour", author: "Gerard" }), "dark", "primary", "#336699");
  return setShape(setTones(draft, ["dark"]), { radius: 14, glow: 20 });
}

describe("the kept draft", () => {
  it("survives a write and a read", () => {
    const storage = memoryStorage();
    expect(writeStoredDraft(() => storage, edited())).toBe(true);
    expect(readStoredDraft(() => storage)).toEqual(edited());
  });

  it("reads nothing when nothing is stored", () => {
    expect(readStoredDraft(() => memoryStorage())).toBeNull();
  });

  it("ignores text that isn't JSON, or isn't a draft this editor wrote", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(readStoredDraft(() => memoryStorage({ [DRAFT_KEY]: "{oops" }))).toBeNull();
    expect(readStoredDraft(() => memoryStorage({ [DRAFT_KEY]: JSON.stringify({ version: 99, draft: {} }) }))).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("keeps only what is valid from a tampered draft", () => {
    const stored = {
      version: DRAFT_STORE_VERSION,
      draft: {
        meta: { name: "Fine", slug: 42 },
        base: "neon",
        tones: ["dark", "dusk", "dark"],
        tokens: { light: { primary: "}body{", background: "#FFFFFF", "evil-token": "0 0% 0%" }, dark: "nope" },
        fonts: { sans: "url(https://example.com/x.woff2)", mono: "Geist Mono" },
        shape: { radius: 99, glow: "lots" },
        mascot: { mode: "custom", shell: "plaid", light: "0 0% 100%" },
      },
    };
    const draft = parseStoredDraft(stored);
    expect(draft).not.toBeNull();
    expect(draft?.meta.name).toBe("Fine");
    expect(draft?.meta.slug).toBe("my-skin");
    expect(draft?.base).toBe("studio");
    expect(draft?.tones).toEqual(["dark"]);
    expect(draft?.tokens).toEqual({ light: { background: "0 0% 100%" }, dark: {} });
    expect(draft?.fonts).toEqual({ mono: "Geist Mono" });
    expect(draft?.shape).toEqual({ radius: 24, glow: 0 });
    expect(draft?.mascot).toEqual({ mode: "custom", light: "0 0% 100%" });
  });

  it("says so when the browser blocks storage, and never throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(readStoredDraft(blockedStorage)).toBeNull();
    expect(writeStoredDraft(blockedStorage, edited())).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

function run(actions: readonly EditorAction[], state: EditorState = INITIAL_EDITOR_STATE): EditorState {
  return actions.reduce(editorReducer, state);
}

const pick = (colour: string): EditorAction => ({
  type: "edit",
  change: (draft) => setToken(draft, "light", "primary", colour),
  group: "pick:light:primary",
});

describe("the editor state", () => {
  it("takes the stored draft when storage answers, unless the user already changed something", () => {
    const loaded = run([{ type: "loaded", draft: edited() }]);
    expect(loaded.loaded).toBe(true);
    expect(loaded.history.present).toEqual(edited());
    expect(loaded.changed).toBe(false);

    const early = run([pick("#336699"), { type: "loaded", draft: edited() }]);
    expect(early.history.present.tokens.light.primary).toBe("210 50% 40%");
  });

  it("makes a run of edits with the same group one undo step", () => {
    const dragged = run([pick("#336699"), pick("#336680"), pick("#33667f")]);
    expect(dragged.history.past).toHaveLength(1);
    expect(dragged.changed).toBe(true);
    const undone = run([{ type: "undo" }], dragged);
    expect(undone.history.present.tokens.light.primary).toBeUndefined();
    expect(run([{ type: "redo" }], undone).history.present).toEqual(dragged.history.present);
  });

  it("starts a new step after the group ends or another edit comes between", () => {
    const ended = run([pick("#336699"), { type: "endGroup" }, pick("#336680")]);
    expect(ended.history.past).toHaveLength(2);
    const between = run([pick("#336699"), { type: "edit", change: (draft) => setMeta(draft, { name: "X" }) }, pick("#336680")]);
    expect(between.history.past).toHaveLength(3);
  });

  it("records nothing for an edit that changes nothing", () => {
    const state = run([{ type: "edit", change: (draft) => draft }]);
    expect(state).toBe(INITIAL_EDITOR_STATE);
  });
});
