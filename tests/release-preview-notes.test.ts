// scripts/release/preview-notes.ts: the release notes end with the pictures a theme's theme.json lists under
// previews, each a Markdown image of the file at the release's tag, so a theme's release page shows the theme. Play
// lists its hand-picked previews; a theme that lists none adds nothing; a list that names anything but a picture
// under assets/previews/ fails the release. theme-release.yml's "Publish the release" appends the script's output.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXIT_FAILED, EXIT_OK, EXIT_USAGE, PREVIEWS_HEADING, previewNotes, previewPaths, runPreviewNotes,
} from "../scripts/release/preview-notes.ts";
import { ROOT, readText, stepNamed, stepsOf, jobOf } from "./support/workflow-steps.ts";

const REPO = "AutomatosAI/automatos-design-kit";
const RUN = 'previews="$(node scripts/release/preview-notes.ts "$THEME_DIR" "$TAG" "$GH_REPO")"';
const APPEND = `if [ -n "$previews" ]; then notes="$notes"$'\\n\\n'"$previews"; fi`;

function ran(args: readonly string[], cwd: string = ROOT): { readonly code: number; readonly out: string[]; readonly err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const code = runPreviewNotes(args, { out: (line) => out.push(line), err: (line) => err.push(line) }, cwd);
  return { code, out, err };
}

const listed = (dir: string): unknown => (JSON.parse(readFileSync(join(ROOT, dir, "theme.json"), "utf8")) as { previews?: unknown }).previews;

describe("previewPaths", () => {
  it("takes a list of pictures under assets/previews/, and none when the field is left out", () => {
    expect(previewPaths(undefined)).toEqual({ ok: true, paths: [] });
    expect(previewPaths(["assets/previews/a.png", "assets/previews/b-2.jpg", "assets/previews/c.webp"]))
      .toEqual({ ok: true, paths: ["assets/previews/a.png", "assets/previews/b-2.jpg", "assets/previews/c.webp"] });
  });

  it("refuses anything else, naming each entry it refuses", () => {
    expect(previewPaths("assets/previews/a.png")).toEqual({ ok: false, error: "theme.json previews is not a list." });
    const refused = previewPaths(["assets/previews/a.png", "../secret.png", "assets/other/b.png", 7, "assets/previews/c.svg"]);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      ["\"../secret.png\"", "\"assets/other/b.png\"", "7", "\"assets/previews/c.svg\""].forEach((part) => expect(refused.error).toContain(part));
      expect(refused.error).not.toContain("\"assets/previews/a.png\"");
    }
  });
});

describe("previewNotes", () => {
  it("is a heading and one image per preview, in order, each the file at the tag", () => {
    const notes = previewNotes({ themeDir: "themes/acme", paths: ["assets/previews/day.png", "assets/previews/night-chat.png"], tag: "acme-v1.2.3", repo: REPO });
    expect(notes.split("\n")).toEqual([
      PREVIEWS_HEADING,
      "",
      `![day](https://github.com/${REPO}/raw/acme-v1.2.3/themes/acme/assets/previews/day.png)`,
      `![night-chat](https://github.com/${REPO}/raw/acme-v1.2.3/themes/acme/assets/previews/night-chat.png)`,
    ]);
  });

  it("is empty for no previews", () => {
    expect(previewNotes({ themeDir: "themes/acme", paths: [], tag: "acme-v1.0.0", repo: REPO })).toBe("");
  });
});

describe("the command, on the kit's themes", () => {
  it("prints Play's previews, as its theme.json lists them", () => {
    const previews = listed("themes/play") as string[];
    expect(previews.length).toBeGreaterThan(0);
    const result = ran(["themes/play", "play-v1.1.1", REPO]);
    expect(result).toEqual({ code: EXIT_OK, out: [previewNotes({ themeDir: "themes/play", paths: previews, tag: "play-v1.1.1", repo: REPO })], err: [] });
  });

  it("prints nothing for a theme that lists no previews", () => {
    const root = mkdtempSync(join(tmpdir(), "preview-notes-"));
    try {
      mkdirSync(join(root, "themes", "acme"), { recursive: true });
      writeFileSync(join(root, "themes", "acme", "theme.json"), JSON.stringify({ id: "acme/acme", name: "Acme" }));
      expect(ran(["themes/acme", "acme-v1.0.0", REPO], root)).toEqual({ code: EXIT_OK, out: [], err: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("is a usage error for a bad argument, and a failure for a folder with no theme.json", () => {
    [[], ["themes/play", "play-v1.1.1"], ["../themes/play", "play-v1.1.1", REPO], ["themes/play", "main", REPO],
      ["themes/play", "play-v1.1.1", "not a repo"]].forEach((args) => expect(ran(args).code).toBe(EXIT_USAGE));
    const missing = ran(["themes/no-such-theme", "acme-v1.0.0", REPO]);
    expect(missing.code).toBe(EXIT_FAILED);
    expect(missing.err[0]).toContain("themes/no-such-theme/theme.json can't be read");
  });
});

describe("theme-release.yml appends the previews to the release notes", () => {
  it("runs the script after the notes and before the release is created", () => {
    const run = stepNamed(stepsOf(jobOf(readText(".github/workflows/theme-release.yml"), "release")), "Publish the release").run;
    const order = [run.indexOf('notes="$title.'), run.indexOf(RUN), run.indexOf(APPEND), run.indexOf("gh release create")];
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
