// theme-publish.yml, read as a file: a merge to main publishes, and only a merge to this repository's main does. Its
// triggers and the pick job's gate, each job's token, the one environment, each secret in one step alone, nothing
// installed next to a key, the review in a container with no network, and actions pinned as the other workflows pin
// them. Its bash steps are run with stand-ins for gh, git and curl in tests/theme-publish-steps.test.ts; the scripts
// it runs are tested on their own (release-bumped, theme-from-pack, release-publish-answer).
import { describe, expect, it } from "vitest";
import { blockOf, codeOf, envOf, expectInOrder, jobOf, readText, stepNamed, stepsOf, usesLines } from "./support/workflow-steps.ts";

const PUBLISH = ".github/workflows/theme-publish.yml";
const PINNED_ACTION = /@[0-9a-f]{40}(?:\s+#.*)?$/;
/** The publish contract's endpoint, under the THEME_PUBLISH_API_URL variable. */
const ENDPOINT = "/api/marketplace/themes/publish";
const SECRETS = { THEME_SIGNING_KEY: "Sign", THEME_PUBLISH_KEY: "Publish to the Marketplace" } as const;
const GATE = [
  "(github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main') ||",
  "(github.event_name == 'workflow_run' &&",
  "github.event.workflow_run.conclusion == 'success' &&",
  "github.event.workflow_run.event == 'push' &&",
  "github.event.workflow_run.head_branch == 'main' &&",
  "github.event.workflow_run.head_repository.full_name == github.repository)",
];
const INSTALLS = /\b(?:npm|npx|yarn|pnpm)\b/;

const text = readText(PUBLISH);
const [pick, build, publish] = ["pick", "build", "publish"].map((job) => jobOf(text, job));
const [pickSteps, buildSteps, publishSteps] = [pick, build, publish].map(stepsOf);
const allSteps = [...pickSteps, ...buildSteps, ...publishSteps];

describe("theme-publish.yml: when it runs", () => {
  it("runs when Kit completes on main, and by hand with one tag input, and on nothing else", () => {
    const on = blockOf(text, "on");
    expect([on.match(/^ {2}\S+:$/gm), on.match(/^ {6}\S+:$/gm)]).toEqual([["  workflow_run:", "  workflow_dispatch:"], ["      tag:"]]);
    expect(on).toContain("\n  workflow_run:\n    workflows: [Kit]\n    types: [completed]\n    branches: [main]\n");
    expect(readText(".github/workflows/kit.yml").split("\n")[0]).toBe("name: Kit");
  });

  it("acts on a Kit run only when it passed on a push to main of this repository, or on a run by hand on main", () => {
    expect(pick).toContain(`\n    if: >-\n${GATE.map((line) => `      ${line}\n`).join("")}`);
  });

  it("builds and publishes only what pick names, the publish on main only, after every build passed", () => {
    expect(build).toContain("\n    needs: pick\n    if: needs.pick.result == 'success' && needs.pick.outputs.themes != '[]'\n");
    expect(publish).toContain("\n    needs: [pick, build]\n    if: github.ref == 'refs/heads/main' && needs.pick.result == 'success' && needs.pick.outputs.themes != '[]'\n");
    [build, publish].forEach((job) => expect(job).toContain("\n        theme: ${{ fromJSON(needs.pick.outputs.themes) }}\n"));
    expect(publish).toContain("\n      fail-fast: false\n");
  });

  it("publishes a theme one run at a time, never cancelled half way, queued per publish job, not per workflow", () => {
    expect(publish).toContain("\n    concurrency:\n      group: theme-publish-${{ matrix.theme.slug }}\n      cancel-in-progress: false\n");
    expect(text).not.toMatch(/^concurrency:/m);
    expect(text.match(/^ *concurrency:/gm)).toHaveLength(1);
  });

  it("checks out the Kit run's commit (main's for a run by hand), each theme's commit to build, and pick's commit to sign", () => {
    expect(stepNamed(pickSteps, "Check out the commit").body).toMatch(/\n {10}fetch-depth: 0\n {10}ref: \$\{\{ github\.event\.workflow_run\.head_sha \|\| github\.sha \}\}\n/);
    expect(stepNamed(buildSteps, "Check out the theme's commit").body).toContain("\n          ref: ${{ matrix.theme.commit }}\n");
    expect(stepNamed(publishSteps, "Check out the kit").body).toContain("\n          ref: ${{ needs.pick.outputs.tools }}\n");
    expect(stepNamed(pickSteps, "Pick the themes").run).toMatch(/node scripts\/release\/bumped\.mjs --tag "\$TAG_INPUT" > "\$picked"\n[^]*node scripts\/release\/bumped\.mjs > "\$picked"/);
  });
});

describe("theme-publish.yml: tokens, the environment and the secrets", () => {
  it("gives its token nothing at the top, read to pick and build, and write to the publish job alone", () => {
    expect(text.match(/^ *permissions:.*$/gm)).toEqual(["permissions: {}", "    permissions:", "    permissions:", "    permissions:"]);
    [pick, build].forEach((job) => expect(job).toMatch(/\n {4}permissions:\n {6}contents: read\n {4}\S/));
    expect(publish).toMatch(/\n {4}permissions:\n {6}contents: write\n {4}\S/);
  });

  it("runs only the publish job in the theme-publish environment", () => {
    expect(text.match(/^ *environment:.*$/gm)).toEqual(["    environment: theme-publish"]);
    expect(publish).toContain("\n    environment: theme-publish\n");
  });

  it("names two secrets, each in the env of one publish step alone", () => {
    expect([...new Set(text.match(/\bsecrets\.[A-Za-z0-9_]+/g))].sort()).toEqual(Object.keys(SECRETS).map((name) => `secrets.${name}`).sort());
    Object.entries(SECRETS).forEach(([name, holder]) => {
      expect(text.match(new RegExp(`secrets\\.${name}\\b`, "g"))).toHaveLength(1);
      expect(allSteps.filter((step) => step.body.includes(`secrets.${name}`)).map((step) => step.name)).toEqual([holder]);
      expect(stepNamed(publishSteps, holder).body).toContain(`\n        env:\n`);
      expect(stepNamed(publishSteps, holder).body).toMatch(new RegExp(`\\n {10}${name}: \\$\\{\\{ secrets\\.${name} \\}\\}\\n`));
    });
    expect(allSteps.filter((step) => step.body.includes("vars.")).map((step) => step.name)).toEqual(["Publish to the Marketplace"]);
    expect(stepNamed(publishSteps, "Publish to the Marketplace").body).toContain("\n          THEME_PUBLISH_API_URL: ${{ vars.THEME_PUBLISH_API_URL }}\n");
  });

  it("gives gh alone the job's token, in the publish job's release steps, and keeps no checkout credentials", () => {
    expect(allSteps.filter((step) => step.body.includes("github.token")).map((step) => step.name)).toEqual(["Find the release", "Release"]);
    const checkouts = text.match(/actions\/checkout@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+persist-credentials: false\n/g);
    expect(checkouts).toHaveLength(usesLines(text).filter((line) => line.includes("actions/checkout@")).length);
    expect(checkouts).toHaveLength(3);
  });

  it("pins every action to a full commit SHA, the ones kit.yml uses as kit.yml pins them", () => {
    const kit = readText(".github/workflows/kit.yml");
    const uses = usesLines(text);
    expect(uses.filter((line) => !PINNED_ACTION.test(line))).toEqual([]);
    uses.filter((line) => !line.includes("actions/download-artifact@")).forEach((line) => expect(kit, line).toContain(line.trim()));
    expect(uses.filter((line) => line.includes("actions/download-artifact@"))).toEqual(["        uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2"]);
  });

  it("passes every input, output and matrix value to a script through env, never into its text", () => {
    allSteps.forEach((step) => expect(step.run, step.name).not.toContain("${{"));
    expect(stepNamed(pickSteps, "Pick the themes").body).toContain("\n          TAG_INPUT: ${{ inputs.tag }}\n");
  });
});

describe("theme-publish.yml: the build, with no secrets", () => {
  it("installs the kit from the lockfile with install scripts off, then builds and packs the theme", () => {
    expectInOrder(buildSteps, ["Check out the theme's commit", "Install (from the lockfile)", "Build", "Pack the theme", "Checksum",
      "Pull the review image", "Review (no network)", "Check the review", "Write the release notes", "Upload the package and its review"]);
    expect(stepNamed(buildSteps, "Install (from the lockfile)").run).toBe("npm ci --ignore-scripts --no-audit --no-fund");
    expect(stepNamed(buildSteps, "Pack the theme").run).toBe('npm run pack --workspace "$THEME_DIR"');
    expect(build).not.toMatch(/\bsecrets\.|\bvars\.|environment:/);
  });

  it("reviews the package as theme-review.yml does: its pinned image, no network, the kit read-only, main.ts", () => {
    expect(envOf(text, "REVIEW_IMAGE")).toBe(envOf(readText(".github/workflows/theme-review.yml"), "REVIEW_IMAGE"));
    const review = stepNamed(buildSteps, "Review (no network)").run;
    ["docker run --rm --network none", "--cap-drop ALL --security-opt no-new-privileges", '-v "$GITHUB_WORKSPACE:/kit:ro"',
      '-e EXPECTED_DIGEST="$PACKAGE_DIGEST"', '"$REVIEW_IMAGE" node scripts/review/main.ts > "$review/summary.txt"'].forEach((part) => expect(review).toContain(part));
    expect(review.match(/\bdocker run\b/g)).toHaveLength(1);
  });

  it("makes the release's title and notes as theme-release.yml does", () => {
    const release = stepNamed(stepsOf(jobOf(readText(".github/workflows/theme-release.yml"), "release")), "Publish the release").run;
    const lines = (run: string, prefixes: readonly string[]): string[] => run.split("\n").map((line) => line.trim()).filter((line) => prefixes.some((prefix) => line.startsWith(prefix)));
    const notes = ["title=", "notes=", "previews=", 'if [ -n "$previews" ]'];
    expect(lines(stepNamed(buildSteps, "Write the release notes").run, notes)).toEqual(lines(release, notes));
  });

  it("uploads the package, its summary, its .sha256, the review's text and the notes, one artifact per theme", () => {
    const gather = stepNamed(buildSteps, "Gather the package and its review").run;
    expect(gather).toContain('cp "$base.autotheme" "$base.autotheme.sha256" "$base.sha256.json" "$RUNNER_TEMP/publish/"');
    expect(gather).toContain('cp "$RUNNER_TEMP/review/summary.txt" "$RUNNER_TEMP/publish/review.txt"');
    expect(stepNamed(buildSteps, "Upload the package and its review").body).toMatch(/\n {10}name: theme-\$\{\{ matrix\.theme\.slug \}\}\n {10}path: \$\{\{ runner\.temp \}\}\/publish\/\n {10}if-no-files-found: error/);
  });
});

describe("theme-publish.yml: the publish, which installs nothing", () => {
  it("checks, compares, signs, verifies, publishes, then releases, in that order, installing nothing", () => {
    expectInOrder(publishSteps, ["Check out the kit", "Set up Node", "Download the package", "Check the package against its summary",
      "Find the release", "Sign", "Verify the signature", "Publish to the Marketplace", "Release"]);
    publishSteps.forEach((step) => expect(step.run, step.name).not.toMatch(INSTALLS));
    expect(stepNamed(publishSteps, "Download the package").body).toContain("\n          name: theme-${{ matrix.theme.slug }}\n");
  });

  it("checks the downloaded bytes against pack's summary before the key is read, then signs and verifies with the kit's scripts", () => {
    const check = stepNamed(publishSteps, "Check the package against its summary").run;
    ['"$actual" != "$(summary zipSha256)"', '"$(summary id)" != "$THEME_ID"', 'node scripts/sign/from-pack.ts check "$base.autotheme" "$base.sha256.json"']
      .forEach((part) => expect(check).toContain(part));
    expect(stepNamed(publishSteps, "Sign").run).toBe('node scripts/sign/from-pack.ts sign "$PACKAGE" "$SUMMARY" "$ENVELOPE"');
    expect(stepNamed(publishSteps, "Verify the signature").run).toBe('node scripts/sign/verify.ts "$PACKAGE" "$ENVELOPE" "$KEYS_FILE"');
    expect(envOf(text, "KEYS_FILE")).toBe("keys/theme-signing.json");
  });

  it("posts to the contract's endpoint over https only, the key on curl's stdin as a header, never on a command line", () => {
    const post = stepNamed(publishSteps, "Publish to the Marketplace").run;
    expect(envOf(text, "PUBLISH_PATH")).toBe(ENDPOINT);
    ["printf 'Authorization: Bearer %s\\n' \"$THEME_PUBLISH_KEY\" | curl", "--proto '=https'", "--header @-", '"$api$PUBLISH_PATH"',
      '--form "package=@$PACKAGE;type=application/octet-stream;filename=$PACKAGE_NAME-$VERSION.autotheme"',
      '--form "signature=<$ENVELOPE"', '--form "review_summary=<$REVIEW"', "unset THEME_PUBLISH_KEY",
      'node scripts/release/publish-answer.ts "$sent" "$code" "$answer" "$THEME_ID" "$VERSION" "$PACKAGE_DIGEST" >> "$GITHUB_OUTPUT"']
      .forEach((part) => expect(post).toContain(part));
    expect(post.split("\n").filter((line) => line.includes("$THEME_PUBLISH_KEY"))).toEqual([
      '  if [ -z "$THEME_PUBLISH_KEY" ]; then',
      "  code=$(printf 'Authorization: Bearer %s\\n' \"$THEME_PUBLISH_KEY\" | curl --silent --show-error --proto '=https' \\",
    ].map((line) => `        ${line}`));
  });

  it("releases only on core's published or unchanged, and never replaces a release's assets", () => {
    const release = stepNamed(publishSteps, "Release");
    expect(release.body).toContain("\n          PUBLISHED: ${{ steps.publish.outputs.status }}\n");
    expect(stepNamed(publishSteps, "Publish to the Marketplace").body).toContain("\n        id: publish\n");
    expect(release.run).toContain("case \"$PUBLISHED\" in published|unchanged) ;;");
    expect(release.run).not.toMatch(/--clobber|gh release delete|gh release edit/);
    expect(codeOf(release)).toContain('gh release create "$TAG" "$PACKAGE" "$PACKAGE.sha256" "$ENVELOPE" --target "$COMMIT"');
  });
});
