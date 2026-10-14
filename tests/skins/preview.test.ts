// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { skinToCss } from "@/lib/skins/css";
import { setFont, setTones, setToken, startDraft, type SkinDraft } from "@/lib/skins/model";
import { DRAFT_PREVIEW_ID, draftAsSkin, frameSkins, previewCss, scopeToFrame } from "@/lib/skins/preview";

// The editor's live preview stylesheet: skinToCss's output for the base palette and for the
// draft, moved from <html> onto the preview frames.

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scopeToFrame", () => {
  it("moves both of skinToCss's selectors onto the frames that name the skin", () => {
    const css = skinToCss(draftAsSkin(setToken(startDraft("studio"), "dark", "primary", "#336699")));
    const scoped = scopeToFrame(css, DRAFT_PREVIEW_ID);
    expect(scoped).not.toContain("html");
    expect(scoped).toContain('[data-skin-preview~="kit-draft"] {\n  --radius: 8px;');
    expect(scoped).toContain('[data-skin-tone="dark"][data-skin-preview~="kit-draft"] {\n  --primary: 210 50% 40%;');
  });
});

describe("previewCss", () => {
  it("writes the base palette first and the draft over it", () => {
    const css = previewCss(setToken(startDraft("classic"), "light", "background", "#FFFFFF"));
    const base = css.indexOf('[data-skin-preview~="kit-base-classic"] {');
    const draft = css.indexOf('[data-skin-preview~="kit-draft"] {');
    expect(base).toBeGreaterThanOrEqual(0);
    expect(draft).toBeGreaterThan(base);
    expect(css.slice(draft)).toContain("--background: 0 0% 100%;");
    expect(css).toContain('[data-skin-tone="dark"][data-skin-preview~="kit-base-classic"] {');
    expect(frameSkins("classic")).toBe("kit-base-classic kit-draft");
  });

  it("follows the draft's base and leaves a dropped tone's colours out", () => {
    const draft = setTones(setToken(startDraft("studio"), "light", "primary", "#336699"), ["dark"]);
    const css = previewCss(draft);
    expect(css).toContain('[data-skin-preview~="kit-base-studio"]');
    expect(css).not.toContain("--primary: 210 50% 40%;");
  });

  it("leaves out a draft that holds anything unsafe, and logs why", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const start = startDraft("studio");
    const hostile: SkinDraft = { ...start, tokens: { light: { primary: "}body{background:url(x)}" }, dark: {} } };
    const css = previewCss(hostile);
    expect(css).toContain("kit-base-studio");
    expect(css).not.toContain("kit-draft");
    expect(css).not.toContain("url(");
    expect(css).not.toContain("}body{");
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("loads the draft's font files through @font-face from object URLs, and refuses any other URL", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const draft = setFont(setFont(startDraft("studio"), "sans", "assets/fonts/face.woff2"), "mono", "assets/fonts/code.woff2");
    const url = "blob:http://localhost:3100/0f8fad5b-d9cb-469f-a165-70867728950e";
    const css = previewCss(draft, "studio", {
      "assets/fonts/face.woff2": url,
      "assets/fonts/code.woff2": 'https://evil.example/x.woff2") ; } body { background: red',
    });
    expect(css).toContain(`@font-face {\n  font-family: "skin-kit-draft-sans";\n  src: url("${url}") format("woff2");`);
    expect(css).toContain('--font-geist-mono: "skin-kit-draft-mono", ui-monospace, monospace;');
    expect(css).not.toContain("evil.example");
    expect(css).not.toContain("skin-kit-draft-mono\";\n  src");
    expect(error).not.toHaveBeenCalled();
  });
});
