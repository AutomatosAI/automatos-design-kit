// PRD-261 B-01d: the design references in references/. Command's looks, converted from its looks.json (look schema
// v0, with booleans) to look schema v1 (choices and numbers only), pass the kit's copy of core's look validators and
// equal v0 value for value; Command's brief marks each ground rule of the pilot's standalone app "Obsolete"; no file
// there is over 2 MB; and no tracked file outside references/ names the Command folder, but the proof's leak list
// (proof/leak-paths.txt, PRD-261 B-06a), so it can be taken out on its own. These checks read files only; nothing is
// built.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LOOK_SCHEMA_SCHEMA, validateLook, validateLookSchema, type LookKnob, type LookSchema,
} from "../packages/theme-cli/src/core/look-schema.ts";
import { lookFileErrors, PRESETS_DIR, SCHEMA_PATH } from "../packages/theme-cli/src/looks.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const REFERENCES = "references";
/** The Command folder's name, joined at run time so this file never holds it whole (the last scan looks for it). */
const COMMAND_NAME = ["designs", "command"].join("/");
const COMMAND = join(ROOT, REFERENCES, COMMAND_NAME);
const DESIGN_READMES = ["README.md", "designs/ember/README.md", `${COMMAND_NAME}/README.md`];
/**
 * PRD-261 B-06a: the list of paths a proof run's launcher deletes from its clone. It names the Command folder (and
 * this test, which reads it) so that the folder is taken out on its own; tests/proof.test.ts holds the list.
 */
const PROOF_LEAK_LIST = "proof/leak-paths.txt";
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const PRESET_SUFFIX = ".look.json";
const V0_LOOK_SCHEMA = "automatos-interface-look/v0";
const V1_LOOK_SCHEMA = "automatos-interface-look/v1";
const ON = "on";
const OFF = "off";
/** Each knob's label: the HUD's LOOK drawer heading for that knob, in title case (v0 has no labels). */
const KNOB_LABELS: Readonly<Record<string, string>> = {
  accent: "Accent", ground: "Background", font: "Type", grid: "Grid", glow: "Glow", scan: "Scan", auto: "Auto",
  motion: "Motion",
};
/** The ground rules that described the pilot's standalone app, and the two that still hold. */
const OBSOLETE_RULES = ["Own repo", "Proxy only", "API knowledge", "Fonts"];
const KEPT_RULES = ["Deliverables list", "Words"];
/** Practices of the pilot's standalone app: a line naming one must say it is obsolete. */
const PILOT_ONLY = [
  "proxy", "localstorage", "next/font", "build-automatos-interface", "orchestrator_api_key", "automatos_backend_url",
  "skill-gaps",
];
const OBSOLETE_MARK = "Obsolete";
const GROUND_RULE = /^- (\*\*Obsolete\.\*\* )?\*\*([^*:]+):\*\*/;

type V0Value = string | number | boolean;
type V0Option = Readonly<Record<string, unknown>>;
type V0Preset = Readonly<Record<string, V0Value>>;
interface V0Looks {
  readonly $schema: string;
  readonly interface: string;
  readonly default: string;
  readonly options: Readonly<Record<string, V0Option>>;
  readonly presets: readonly V0Preset[];
}
interface V1SchemaDocument {
  readonly schema: string;
  readonly look: Readonly<Record<string, string>>;
  readonly knobs: Readonly<Record<string, LookKnob>>;
}
type JsonRecord = Readonly<Record<string, unknown>>;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** A v0 value as look schema v1 writes it: a boolean becomes the choice "on" or "off". */
function toV1(value: V0Value): string | number {
  if (typeof value !== "boolean") return value;
  return value ? ON : OFF;
}

/** The v1 knob a v0 option becomes, label aside, with the default preset's value as its default. */
function expectedKnob(option: V0Option, fallback: V0Value): JsonRecord {
  if (option.type === "boolean") return { kind: "choice", choices: [ON, OFF], default: toV1(fallback) };
  if (typeof option.min === "number" && typeof option.max === "number") {
    return { kind: "number", min: option.min, max: option.max, integer: true, default: fallback };
  }
  return { kind: "choice", choices: Object.keys(option), default: fallback };
}

/** The v1 preset a v0 preset becomes: the look's header, an empty sub, and every value converted. */
function expectedPreset(v0: V0Looks, preset: V0Preset): JsonRecord {
  const values = Object.fromEntries(Object.entries(preset).map(([name, value]) => [name, toV1(value)]));
  return { schema: V1_LOOK_SCHEMA, interface: v0.interface, ...values, sub: "" };
}

function presetFiles(): string[] {
  return readdirSync(join(COMMAND, PRESETS_DIR)).filter((name) => name.endsWith(PRESET_SUFFIX)).sort();
}

/** The look files as a package holds them: looks/schema.json and looks/presets/<id>.look.json. */
function lookFiles(): Map<string, Uint8Array> {
  const schema: [string, Uint8Array] = [SCHEMA_PATH, readFileSync(join(COMMAND, SCHEMA_PATH))];
  const presets = presetFiles().map((name): [string, Uint8Array] => [
    `${PRESETS_DIR}${name}`, readFileSync(join(COMMAND, PRESETS_DIR, name)),
  ]);
  return new Map<string, Uint8Array>([schema, ...presets]);
}

function checkedSchema(document: unknown): LookSchema {
  const { schema, errors } = validateLookSchema(document);
  if (schema === null) throw new Error(`the converted schema is refused: ${JSON.stringify(errors)}`);
  return schema;
}

/** Every file under references/, relative to the repo root. */
function referenceFiles(): string[] {
  return readdirSync(join(ROOT, REFERENCES), { encoding: "utf8", recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).split("\\").join("/"))
    .sort();
}

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
}

/** The text of one `## <heading>` section, up to the next `## ` heading. */
function sectionOf(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}`);
  if (start < 0) throw new Error(`no "## ${heading}" section`);
  const end = text.indexOf("\n## ", start + 1);
  return text.slice(start, end < 0 ? undefined : end);
}

/** Each ground-rule bullet's label, and whether it is marked obsolete. */
function groundRules(readme: string): Array<{ readonly label: string; readonly obsolete: boolean }> {
  return sectionOf(readme, "Ground rules").split("\n").filter((line) => line.startsWith("- ")).map((line) => {
    const match = GROUND_RULE.exec(line);
    if (match === null) throw new Error(`a ground rule without a bold label: ${line}`);
    return { label: match[2], obsolete: match[1] !== undefined };
  });
}

const v0 = readJson<V0Looks>(join(COMMAND, "looks.json"));
const schemaDocument = readJson<V1SchemaDocument>(join(COMMAND, SCHEMA_PATH));
const v0Default = v0.presets.find((preset) => preset.id === v0.default);
const presetIds = v0.presets.map((preset) => String(preset.id));

describe("Command's looks.json is the v0 original the conversion starts from", () => {
  it("is look schema v0, for the command interface, with five presets and a default among them", () => {
    expect(v0.$schema).toBe(V0_LOOK_SCHEMA);
    expect(v0.interface).toBe("command");
    expect(presetIds).toEqual(["arc", "forge", "ghost", "nova", "signal"]);
    expect(v0Default).toBeDefined();
  });

  it("has three on/off options as booleans, which look schema v1 has no kind for", () => {
    const flags = Object.keys(v0.options).filter((name) => v0.options[name].type === "boolean");
    expect(flags).toEqual(["scan", "auto", "motion"]);
    const refused = validateLookSchema({ ...schemaDocument, knobs: { scan: v0.options.scan } }).errors;
    expect(refused.map((error) => [error.code, error.path])).toContainEqual(["BAD_KNOB", "knobs.scan"]);
  });
});

describe("Command's looks/schema.json (look schema v1)", () => {
  it("passes the vendored look-schema validator", () => {
    expect(validateLookSchema(schemaDocument).errors).toEqual([]);
    expect(schemaDocument.schema).toBe(LOOK_SCHEMA_SCHEMA);
  });

  it("describes v1 looks for the same interface", () => {
    const schema = checkedSchema(schemaDocument);
    expect(schema.lookSchema).toBe(V1_LOOK_SCHEMA);
    expect(schema.interface).toBe(v0.interface);
  });

  it("has v0's options as its knobs, in v0's order, each with an expected label", () => {
    expect(Object.keys(schemaDocument.knobs)).toEqual(Object.keys(v0.options));
    expect(Object.keys(KNOB_LABELS)).toEqual(Object.keys(v0.options));
  });

  it.each(Object.keys(v0.options))("knob %s equals its v0 option, the default preset's value its default", (name) => {
    const { label, ...knob } = schemaDocument.knobs[name];
    expect(knob).toEqual(expectedKnob(v0.options[name], (v0Default as V0Preset)[name]));
    expect(label).toBe(KNOB_LABELS[name]);
  });
});

describe("Command's looks/presets (look schema v1)", () => {
  it("are v0's presets, one file each, named by id", () => {
    expect(presetFiles()).toEqual([...presetIds].sort().map((id) => `${id}${PRESET_SUFFIX}`));
  });

  it("pass the package look check: the schema, then every preset against it, each id its file name", () => {
    expect(lookFileErrors(lookFiles())).toEqual([]);
  });

  it.each(presetIds)("%s equals its v0 preset value for value (true is on, false is off)", (id) => {
    const preset = v0.presets.find((candidate) => candidate.id === id) as V0Preset;
    const converted = readJson<unknown>(join(COMMAND, PRESETS_DIR, `${id}${PRESET_SUFFIX}`));
    expect(converted).toEqual(expectedPreset(v0, preset));
    expect(validateLook(checkedSchema(schemaDocument), converted)).toEqual([]);
  });

  it("would be refused had a v0 boolean been kept", () => {
    const arc = readJson<JsonRecord>(join(COMMAND, PRESETS_DIR, `arc${PRESET_SUFFIX}`));
    const errors = validateLook(checkedSchema(schemaDocument), { ...arc, scan: true });
    expect(errors.map((error) => [error.code, error.path])).toEqual([["LOOK_BAD_VALUE", "scan"]]);
  });
});

describe("the briefs mark what described the pilot's standalone app", () => {
  const command = readFileSync(join(COMMAND, "README.md"), "utf8");

  it("Command's brief marks each obsolete ground rule Obsolete, and only those", () => {
    const rules = groundRules(command);
    expect(rules.filter((rule) => rule.obsolete).map((rule) => rule.label)).toEqual(OBSOLETE_RULES);
    expect(rules.filter((rule) => !rule.obsolete).map((rule) => rule.label)).toEqual(KEPT_RULES);
  });

  it.each(DESIGN_READMES)("references/%s marks every line that names a pilot-only practice", (rel) => {
    const lines = readFileSync(join(ROOT, REFERENCES, rel), "utf8").split("\n");
    const unmarked = lines.filter((line) => PILOT_ONLY.some((term) => line.toLowerCase().includes(term)))
      .filter((line) => !line.includes(OBSOLETE_MARK));
    expect(unmarked).toEqual([]);
  });

  it("references/README.md names the missing support.js as a known gap", () => {
    const readme = readFileSync(join(ROOT, REFERENCES, "README.md"), "utf8");
    expect(sectionOf(readme, "Known gap")).toContain("`./support.js`");
  });
});

describe("references/ as files", () => {
  const files = referenceFiles();

  it("holds both designs", () => {
    expect(files).toEqual(expect.arrayContaining([
      `${REFERENCES}/designs/ember/README.md`, `${REFERENCES}/${COMMAND_NAME}/README.md`,
    ]));
  });

  it("has no file over 2 MB", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((rel) => statSync(join(ROOT, rel)).size > MAX_FILE_BYTES)).toEqual([]);
  });

  it("ships no support.js (its licence is unclear)", () => {
    expect(files.filter((rel) => rel.endsWith("/support.js"))).toEqual([]);
  });

  it("is the only place a tracked file names the Command folder, but the proof's leak list, which removes it", () => {
    const outside = trackedFiles().filter((rel) => !rel.startsWith(`${REFERENCES}/`) && rel !== PROOF_LEAK_LIST);
    expect(outside.length).toBeGreaterThan(0);
    const naming = outside.filter((rel) => existsSync(join(ROOT, rel)))
      .filter((rel) => readFileSync(join(ROOT, rel)).includes(COMMAND_NAME));
    expect(naming).toEqual([]);
  });
});
