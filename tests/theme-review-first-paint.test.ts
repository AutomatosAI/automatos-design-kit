// The isolated review (theme-review.yml, and theme-publish.yml's build job, both through scripts/review/main.ts) refuses a
// package the browser would draw only in part, as core's reader does: its Package check is the reader's port, which runs
// theme-cli's first-paint rules (core's first_paint.py), so a prepaint value the first paint drops (a gradient), a
// look-schema knob the table never paints and a knob the table paints that the schema lacks fail it with every reason,
// and the rest of the review doesn't run. A table the first paint keeps whole, painting every knob, passes. The package
// is core's hello theme with a prepaint table.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { writeZip } from "@automatos/theme-cli/zip";
import { folderFiles } from "../packages/theme-cli/test/hello-files.ts";
import { readPackage } from "../scripts/review/review.ts";

const HELLO = fileURLToPath(new URL("../packages/theme-cli/test/fixtures/core/hello/", import.meta.url));
const PREPAINT = "boot/prepaint.json";
const GROUND = { paper: { "--hello-bg": "#FFFFFF" }, ink: { "--hello-bg": "#111111" } };
const ACCENT = { blue: { "--hello-accent": "#1D4ED8" }, green: { "--hello-accent": "#1E7F3C" } };
const RADIUS = {
  var: "--hello-glow", knob: "radius", min: 0, max: 16, integer: true, scale: 100, capTable: null, caps: null,
  color: { knob: "accent", rgb: { blue: "29,78,216", green: "30,127,60" } }, template: "rgba-alpha",
};
const DEFAULTS = { ground: "paper", accent: "blue", radius: 6 };
/** The Package check's sentence for a package core's reader refuses (review.ts readPackage). */
const READER_REFUSED = "Core's reader would refuse it.";

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
    expect(read.check).toMatchObject({ name: "Package", status: "fail", detail: READER_REFUSED });
    expect(read.check.items.map((item) => item.split(": ")[0])).toEqual([
      `BAD_CSS_VALUE ${PREPAINT}#knobs.accent.blue.--hello-wash`, "KNOB_NOT_PAINTED looks/schema.json#knobs.radius",
    ]);
  });

  it("refuses a knob the table paints that the look schema doesn't declare", () => {
    const glow = { ...RADIUS, var: "--hello-shine", knob: "shine", max: 30 };
    const read = readPackage(helloZip({ knobs: { ground: GROUND, accent: ACCENT }, pairs: [], numeric: [RADIUS, glow], defaults: { ...DEFAULTS, shine: 4 } }));
    expect(read.check).toMatchObject({ name: "Package", status: "fail", detail: READER_REFUSED });
    expect(read.check.items.map((item) => item.split(": ")[0])).toEqual([`KNOB_NOT_IN_SCHEMA ${PREPAINT}#numeric[1].knob`]);
  });

  it("passes a table the first paint keeps whole, painting every knob of the schema", () => {
    const read = readPackage(helloZip({ knobs: { ground: GROUND, accent: ACCENT }, pairs: [], numeric: [RADIUS], defaults: DEFAULTS }));
    expect(read.check.status).toBe("pass");
    expect(read.files?.has(PREPAINT)).toBe(true);
  });
});
