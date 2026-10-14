// Just enough CSS reading for the accessibility checks: the stylesheets are ours and
// plain (no nesting but @media), so a brace walk is enough.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Path, not URL, arithmetic: in jsdom tests vitest rewrites a URL resolved against import.meta.url to self.location (http:).
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export interface CssRule {
  readonly selector: string;
  readonly body: string;
  /** The @media prelude around the rule, or null at the top level. */
  readonly media: string | null;
}

export interface Declaration {
  readonly property: string;
  readonly value: string;
}

export function readSource(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** Repo-relative paths of the files under dir that end with one of the suffixes. */
export function filesUnder(dir: string, suffixes: readonly string[]): readonly string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((name) => suffixes.some((suffix) => name.endsWith(suffix)))
    .map((name) => join(dir, name));
}

/** Every stylesheet Play ships: app/ and components/. */
export function stylesheets(): readonly string[] {
  return [...filesUnder("app", [".css"]), ...filesUnder("components", [".css"])];
}

export function cssRules(css: string): readonly CssRule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: CssRule[] = [];
  const open: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") {
      open.push(text.slice(start, index).trim());
      start = index + 1;
    } else if (char === "}") {
      const prelude = open.pop() ?? "";
      if (!prelude.startsWith("@")) {
        const media = open.find((outer) => outer.startsWith("@media")) ?? null;
        rules.push({ selector: prelude, body: text.slice(start, index), media });
      }
      start = index + 1;
    }
  }
  return rules;
}

export function declarations(body: string): readonly Declaration[] {
  return body
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.includes(":"))
    .map((part) => {
      const colon = part.indexOf(":");
      return { property: part.slice(0, colon).trim(), value: part.slice(colon + 1).trim() };
    });
}

/** The custom properties declared on :root in app/theme.css. */
export function themeTokens(): ReadonlyMap<string, string> {
  const root = cssRules(readSource("app/theme.css")).find((rule) => rule.selector === ":root");
  if (!root) throw new Error("app/theme.css has no :root rule");
  return new Map(
    declarations(root.body)
      .filter((declaration) => declaration.property.startsWith("--"))
      .map((declaration): [string, string] => [declaration.property, declaration.value]),
  );
}

const VAR = /var\((--[\w-]+)\)/g;

/** The value with every theme var() replaced by its value, recursively. Unknown vars stay. */
export function resolveTokens(value: string, tokens: ReadonlyMap<string, string>, depth = 0): string {
  if (depth > 8) throw new Error(`var() loop in ${value}`);
  const resolved = value.replace(VAR, (whole, name: string) => tokens.get(name) ?? whole);
  return resolved === value ? value : resolveTokens(resolved, tokens, depth + 1);
}

/** Every px length in the value, after resolving theme tokens. */
export function pxLengths(value: string, tokens: ReadonlyMap<string, string>): readonly number[] {
  return [...resolveTokens(value, tokens).matchAll(/(-?\d+(?:\.\d+)?)px\b/g)].map((match) => Number(match[1]));
}

/** True for a rule that has a class token exactly (".row" matches ".row:hover", not ".rowTitle"). */
export function selectsClass(selector: string, className: string): boolean {
  return new RegExp(`\\.${className}(?![\\w-])`).test(selector);
}
