// Reading a workflow file as text, for the root tests that hold the person-run and release workflows
// (tests/theme-workflows.test.ts): its top-level blocks, a job, the env block's values, and each job's steps
// with their run scripts. Moved out of theme-workflows.test.ts to keep that file under the 400-line cap.
// Nothing here runs a workflow.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));

export interface Step {
  readonly name: string;
  readonly body: string;
  /** The `run:` script, without the key; empty for a `uses:` step. */
  readonly run: string;
}

export function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** The script under a step's `run:` key: the inline value or the indented block after it. */
export function runOf(lines: readonly string[]): string {
  const at = lines.findIndex((line) => /^\s*run:/.test(line));
  if (at < 0) return "";
  const indent = (lines[at].match(/^\s*/) ?? [""])[0].length;
  const inline = lines[at].replace(/^\s*run:\s*\|?\s*/, "");
  const block = lines.slice(at + 1);
  const end = block.findIndex((line) => line.trim() !== "" && (line.match(/^\s*/) ?? [""])[0].length <= indent);
  return [inline, ...(end < 0 ? block : block.slice(0, end))].join("\n").trim();
}

/** The job's steps (`      - name:` items), each with its whole text and its run script. */
export function stepsOf(text: string): Step[] {
  const lines = text.split("\n");
  const starts = lines.flatMap((line, index) => (/^ {6}- name: /.test(line) ? [index] : []));
  return starts.map((start, index) => {
    const own = lines.slice(start, starts[index + 1] ?? lines.length);
    return { name: own[0].replace(/^ {6}- name: /, "").trim(), body: own.join("\n"), run: runOf(own) };
  });
}

export function usesLines(text: string): string[] {
  return text.split("\n").filter((line) => /^\s*(?:-\s+)?uses:/.test(line));
}

/** The lines from `first` up to the next line `next` matches, or the end. */
export function section(text: string, first: string, next: RegExp): string {
  const lines = text.split("\n");
  const start = lines.indexOf(first);
  const end = lines.findIndex((line, index) => index > start && next.test(line));
  return start < 0 ? "" : lines.slice(start, end < 0 ? lines.length : end).join("\n");
}

export const blockOf = (text: string, key: string): string => section(text, `${key}:`, /^\S/);
export const jobOf = (text: string, job: string): string => section(blockOf(text, "jobs"), `  ${job}:`, /^ {2}\S/);
export const envOf = (text: string, name: string): string =>
  (blockOf(text, "env").match(new RegExp(`^ {2}${name}: '?(.*?)'?$`, "m")) ?? ["", ""])[1];
/** A step without its comments and blank lines: what it does. */
export const codeOf = (step: Step): string => step.body.split("\n").filter((line) => !/^\s*(?:#.*)?$/.test(line)).join("\n");

export function stepNamed(steps: readonly Step[], name: string): Step {
  const step = steps.find((candidate) => candidate.name === name);
  if (step === undefined) throw new Error(`no step named "${name}"`);
  return step;
}

/** Every named step exists, in this order. */
export function expectInOrder(steps: readonly Step[], names: readonly string[]): void {
  const at = names.map((name) => steps.findIndex((step) => step.name === name));
  expect(at.every((index, n) => index >= 0 && (n === 0 || index > at[n - 1])), names.join(" < ")).toBe(true);
}

/** Every file git tracks, repo-relative. */
export function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter((rel) => rel !== "");
}
