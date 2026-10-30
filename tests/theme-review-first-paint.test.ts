// The isolated review (theme-review.yml, and theme-publish.yml's build job, both through scripts/review/main.ts) refuses a
// package the browser would draw only in part, as core's reader does: its Package check runs theme-cli's first-paint
// rules after the reader's port, so a prepaint value the first paint drops (a gradient) and a look-schema knob the table
// never paints fail it with every reason, and the rest of the review doesn't run. A table the first paint keeps whole,
// painting every knob, passes. The package is core's hello theme with a prepaint table.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { writeZip } from "@automatos/theme-cli/zip";
import { folderFiles } from "../packages/theme-cli/test/hello-files.ts";
import { FIRST_PAINT_REFUSED, readPackage } from "../scripts/review/review.ts";

const HELLO = fileURLToPath(new URL("../packages/theme-cli/test/fixtures/core/hello/", import.meta.url));
const PREPAINT = "boot/prepaint.json";
const GROUND = { paper: { "--hello-bg": "#FFFFFF" }, ink: { "--hello-bg": "#111111" } };
const ACCENT = { blue: { "--hello-accent": "#1D4ED8" }, green: { "--hello-accent": "#1E7F3C" } };
const RADIUS = {
  var: "--hello-glow", knob: "radius", min: 0, max: 16, integer: true, scale: 100, capTable: null, caps: null,
  color: { knob: "accent", rgb: { blue: "29,78,216", green: "30,127,60" } }, template: "rgba-alpha",
};
const DEFAULTS = { ground: "paper", accent: "blue", radius: 6 };

/** hello's package with `table` as its boot/prepaint.json. */
function helloZip(table: unknown): Buffer {
  const files = folderFiles(HELLO);
  files.set(PREPAINT, new TextEncoder().encode(`${JSON.stringify(table)}\n`));
  return writeZip(Array.from(files, ([path, data]) => ({ path, data })));
}

describe("the review's Package check and what the browser keeps", () => {
  it("refuses a gradient the first paint drops and a knob the table never paints, with every reason", () => {
    const wash = { ...ACCENT, blue: { ...ACCENT.blue, "--hello-wash": "linear-gradient(120deg,#1D4ED8 0%,#1E7F3C 100%)" } };
    const read = readPackage(helloZip({ knobs: { ground: GROUND, accent: wash }, pairs: [], numeric: [], defaults: DEFAULTS }));
    expect(read.files).toBeNull();
    expect(read.check).toMatchObject({ name: "Package", status: "fail", detail: FIRST_PAINT_REFUSED });
    expect(read.check.items.map((item) => item.split(": ")[0])).toEqual([
      `BAD_CSS_VALUE ${PREPAINT}#knobs.accent.blue.--hello-wash`, "KNOB_NOT_PAINTED looks/schema.json#knobs.radius",
    ]);
  });

  it("passes a table the first paint keeps whole, painting every knob of the schema", () => {
    const read = readPackage(helloZip({ knobs: { ground: GROUND, accent: ACCENT }, pairs: [], numeric: [RADIUS], defaults: DEFAULTS }));
    expect(read.check.status).toBe("pass");
    expect(read.files?.has(PREPAINT)).toBe(true);
  });
});
