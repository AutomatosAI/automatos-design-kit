// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DEFAULT_BACKEND_URL } from "@/lib/server/backend";

// The README and the compose file are how an open-source user starts Play: keep them
// in step with the code they describe.

const ROOT = new URL("../", import.meta.url);

function read(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, ROOT)), "utf8");
}

const MASCOT_STATES = [
  "hello",
  "idle",
  "listening",
  "thinking",
  "working",
  "searching",
  "reading",
  "celebrate",
  "oops",
  "sleeping",
  "lost",
  "loading",
] as const;

describe("README", () => {
  const readme = read("README.md");

  it("covers install, the env file, the dev server and the port", () => {
    for (const step of ["npm install", "cp .env.example .env.local", "npm run dev", "http://localhost:3100"]) {
      expect({ step, present: readme.includes(step) }).toEqual({ step, present: true });
    }
    expect(read("package.json")).toContain('"dev": "next dev -p 3100"');
  });

  it("names every setting in .env.example and the default backend URL", () => {
    const settings = Array.from(read(".env.example").matchAll(/^#?\s*([A-Z_]+)=/gm), (match) => match[1]);
    expect(settings).toEqual(["AUTOMATOS_BACKEND_URL", "PLAY_ALLOWED_HOSTS"]);
    for (const setting of settings) expect(readme).toContain(setting);
    expect(readme).toContain(DEFAULT_BACKEND_URL);
  });

  it("says where the mascot files go, for every state", () => {
    expect(readme).toContain("public/auto/");
    for (const state of MASCOT_STATES) expect(readme).toContain(`\`${state}\``);
  });

  it("has the three troubleshooting cases", () => {
    for (const heading of ["**\"Automatos is asleep\" (the backend is down).**", "**Wrong port.**", "**Workspace 400.**"]) {
      expect(readme).toContain(heading);
    }
  });
});

describe("docker-compose.yml", () => {
  const compose = read("docker-compose.yml");

  it("joins the core's network as external, so automatos-ai needs no edit", () => {
    expect(compose).toMatch(/networks:\n {2}automatos:\n {4}external: true\n {4}name: automatos_network\n/);
  });

  it("points Play at the backend service and serves it on localhost only", () => {
    expect(compose).toContain("AUTOMATOS_BACKEND_URL: http://backend:8000");
    expect(compose).toContain('"127.0.0.1:${PLAY_PORT:-3100}:3100"');
  });
});
