// The harness job's shots of every theme under themes/ but Play and HUD (which have steps of their own): a theme the
// kit adds, or one a copy of the kit adds, is drawn in a browser on every pull request too. Each goes to its own
// folder of the upload, packages/theme-harness/dist/shots/themes/<name>/. Run from the kit's root after the build.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The themes with steps of their own in kit.yml's harness job. */
export const SHOT_ELSEWHERE = ["play", "hud"];
export const OTHER_SHOTS_OUT = "packages/theme-harness/dist/shots/themes";

/** Every other theme folder under `root`/themes (one with a theme.json), by name, in order. */
export function otherThemes(root) {
  const themes = join(root, "themes");
  if (!existsSync(themes)) return [];
  return readdirSync(themes, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !SHOT_ELSEWHERE.includes(entry.name))
    .filter((entry) => existsSync(join(themes, entry.name, "theme.json")))
    .map((entry) => entry.name)
    .sort();
}

/** Shoots each theme in turn; the exit code is the first failure's, or 0. */
export function shootOtherThemes(root) {
  const names = otherThemes(root);
  if (names.length === 0) console.log("No theme under themes/ but Play and HUD: nothing more to shoot.");
  for (const name of names) {
    const ran = spawnSync("npx", ["automatos-theme", "shots", `themes/${name}`, "--out", `${OTHER_SHOTS_OUT}/${name}`], {
      cwd: root,
      stdio: "inherit",
    });
    if (ran.status !== 0) return ran.status ?? 1;
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(shootOtherThemes(process.cwd()));
}
