# Releasing a theme

How a kit theme version becomes a release, exactly as the workflows in `.github/workflows/` do it. Every folder under
`themes/` is a theme (Play, `themes/play`, `automatos/play`; HUD, `themes/hud`, `automatos/hud`; Arcade,
`themes/arcade`, `automatos/arcade`; Candy, `themes/candy`, `automatos/candy`). A merge to `main` that raises a theme's
version publishes it: `theme-publish.yml` reviews, signs and lists it on the hosted Marketplace and releases it here,
with nobody running anything. Kit CI checks the workflows, not the runs. The flow end to end, the environment and its keys, what blocks a publish and how to
backfill: [OFFICIAL-LISTING.md](OFFICIAL-LISTING.md).

| Workflow | File | Started by | What it does |
|---|---|---|---|
| Kit | `kit.yml` | every pull request and push to `main` | The released-themes guard, then build, lint, typecheck, test and pack; the harness shots |
| Theme publish | `theme-publish.yml` | `Kit` passing on a push to `main`; Run workflow on `main` with a tag | Builds, reviews, signs, lists and releases each theme whose version moved |
| Theme release | `theme-release.yml` | a release tag a person pushes | Builds the tagged theme and releases it, unlisted and unsigned |
| Theme review | `theme-review.yml` | Run workflow, at the tag | Reviews one package with no network and no secrets |
| Kit lockfile | `kit-lockfile.yml` | Run workflow on a branch | Resolves `package-lock.json` for a dependency change |

## 1. Make the change under a new version

A released version never changes. While a theme's `theme.json` names a version that has a release tag, kit CI's
first step (`scripts/release/released-unchanged.mjs`, before anything is installed) fails if any of that theme's
packed paths differs from the tag. For every folder `themes/<slug>` the packed paths are (`scripts/release/themes.mjs`
`packedPathsOf`): its `theme.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `dist/`,
`boot/`, `looks/`, `assets/` and `src/`, and the `src/` of each kit library its `package.json` names under
`dependencies` (Play's and HUD's: `packages/look-kit/src`, `packages/mascot/src`; Arcade's and Candy's:
`packages/mascot/src` alone, since neither `package.json` names look-kit).

These are the paths `pack` collects, and the kit libraries it writes into `source/`. A folder git ignores (Play's
`dist/`, `boot/` and `looks/`, built from `src/`) holds nothing to compare; HUD, Arcade and Candy commit `boot/` and
`looks/`, and only their `dist/` is built. So a change to `packages/look-kit/src` or `packages/mascot/src` needs a new
version of each released theme that bundles it: one to `packages/look-kit/src` a new version of Play and HUD, and one
to `packages/mascot/src` a new version of every released theme.

The guard reads each theme's version from its `theme.json` and lists the theme's `<slug>-v*` tags on `origin` with
`git ls-remote`:

- the version has a tag: the packed paths must be as that tag has them, or the job fails and lists each changed path;
- no tag names the version, and it is above every release tag of that theme: it passes (nothing of it is released);
- no tag names it, and it is not above the latest release: it fails, since a new version must be above every
  release;
- the theme has no release tag yet: it passes.

Each theme is checked against its own tags alone, in folder order, and the job fails when any fails. A failure to
list, fetch or compare is a failure, never a pass.

So a change to a released theme, in one pull request:

1. Raise `version` in the theme's `theme.json` and in its `package.json` to the same new value, above every release
   (each theme's own `test/manifest.test.ts` holds the two equal).
2. Add the version's section at the top of the theme's `CHANGELOG.md`, newest first, saying what changed.
   `CHANGELOG.md` is packed, so write it before the tag: after the release it can only change with another version.
3. Let kit CI pass. Its `kit` job packs every theme and uploads the packages as the `kit-themes` artifact.

The theme's `signatures/` folder is never packed and is not among the packed paths.

## 2. Merge to publish

The tag rule: a release tag is `<slug>-v<major>.<minor>.<patch>` (`^([a-z0-9-]+)-v\d+\.\d+\.\d+$`), naming the
folder `themes/<slug>`, whose `theme.json` id is `<publisher>/<slug>` with the publisher listed in
`release/publishers.json`. `scripts/release/themes.mjs` holds it; `bumped.mjs` and both release workflows apply it.

Merge the pull request. When `Kit` passes on the push to `main`, `theme-publish.yml` picks each theme whose version is
above its newest tag and whose publisher is listed, then builds, reviews, signs and publishes it, and releases
`<slug>-v<version>` at the merged commit ([OFFICIAL-LISTING.md](OFFICIAL-LISTING.md), "What a merge does"). The
release holds `<publisher>.<slug>-<version>.autotheme`, its `.autotheme.sha256` and `<version>.sig.json`, titled
with `theme.json`'s `name` and the version ("Play 1.2.1", "HUD 1.1.2", "Arcade 1.0.0"), with notes giving the package
digest and the file's sha256, then the pictures `theme.json` lists under `previews`, each shown from the tag, and the
phone screenshots it lists under `phonePreviews`, side by side at a phone's width
(`scripts/release/preview-notes.ts`). A local or open-source edition installs the release asset with Settings ›
Appearance › Themes › Install theme.

A theme with no release tag yet is picked by the first run on `main` that sees it, and its first version is listed,
signed and released there: Arcade's `arcade-v1.0.0` and Candy's `candy-v1.0.0` were released that way. Push no
`<slug>-v*` tag by hand for a theme's first version or any later one.

A tag pushed by hand still releases through `theme-release.yml`'s `release` job (permissions: `contents: write` and
nothing else; no secrets), unlisted and unsigned. In order, it:

1. checks out the tagged commit with all history, sets up Node 22 and pins npm 11.21.1, as `kit.yml` does;
2. checks the tag matches the tag rule (in the shell, `^([a-z0-9-]+)-v[0-9]+\.[0-9]+\.[0-9]+$`), and takes the
   slug and the version from it;
3. runs `scripts/release/bumped.mjs --tag <tag>`: the tagged commit is on `origin/main`, and its
   `themes/<slug>/theme.json` is a listed publisher's `<publisher>/<slug>` at the tag's version;
4. installs with `npm ci --ignore-scripts`, runs the root `build`, then the theme's `pack` script
   (`npm run pack --workspace themes/<slug>`, which writes into `themes/<slug>/out/`);
5. writes `<publisher>.<slug>-<version>.autotheme.sha256` with `sha256sum` and checks it against the `zipSha256`
   that `pack` recorded in `<publisher>.<slug>-<version>.sha256.json`;
6. attaches `themes/<slug>/signatures/<version>.sig.json` if the tagged commit holds one, once `keys/theme-signing.json`
   holds an active key and `scripts/sign/verify.ts` verifies it against the package just built;
7. publishes the release with `gh release create <tag> --verify-tag`, titled and noted as above.

Such a version is then seen as released, so no merge publishes it; list it with a backfill
([OFFICIAL-LISTING.md](OFFICIAL-LISTING.md), "Backfill"), which also adds its `.sig.json`.

## 3. Review

A kit theme's version is reviewed by the publish run, at the merged commit (section 2). Any other Marketplace version
is reviewed by a person, who runs `theme-review.yml` at the tag, so the review uses the kit's scripts and lockfile as
they were when the theme was built:

```sh
gh workflow run theme-review.yml --ref play-v<version> \
  -f package_url=https://github.com/AutomatosAI/automatos-design-kit/releases/download/play-v<version>/automatos.play-<version>.autotheme \
  -f expected_digest=<the 64-hex digest the admin queue shows>
```

The job has no permissions and no secrets. It refuses a `package_url` that isn't `https://` and an
`expected_digest` that isn't 64 lower-case hex characters, downloads the package (HTTPS only, at most 32 MiB, the
package cap, two minutes), installs the kit with `npm ci --ignore-scripts`, and then runs `scripts/review/main.ts` in
`docker run --network none` on a Node image pinned by digest: the kit mounted read-only, all capabilities dropped,
no new privileges. The review's checks, in order: no network, the package (core's reader, as the kit ports it), the
digest against `expected_digest`, `source/` present, the JS rules on `source/`, and the reproducible build of
`source/` with the kit's preset. The outcome is `pass` only when every check passed; a JS-rule warning is listed for
the reviewer and fails nothing. The job summary holds the text the reviewer pastes into the admin queue's report
note, with its outcome.

The text ends with a report-only "Previews and accessibility" section: each preset's previews with their sizes and
the preset that claims each (a preset with none, a preview no preset claims and a file theme.json doesn't list are
named), then its phone screenshots the same way when the package holds any, and contrast, "not measured" while the look schema declares no text and ground pairs. Once the review has
passed, the job draws the package in the kit's browser harness on the runner, outside the container, and adds what
axe found over those shots to the job summary after the text. Neither changes the outcome: the person reviewing
decides.

To see the same checks before submitting, run `automatos-theme check <theme folder> --rebuild` ([cli.md](cli.md)).

## 4. Sign

The publish job signs; nothing else does, and it signs only a package the run built from `main`. Its `Sign` step,
`node scripts/sign/from-pack.ts sign <package> <package.sha256.json> <out.sig.json>`, installs nothing and is the one
step that reads the `THEME_SIGNING_KEY` secret of the `theme-publish` environment (an Ed25519 key, PKCS#8 PEM), which
no other workflow may name:

- it holds the package to `pack`'s summary first: the file's sha256 is the summary's `zipSha256`, and
  `{id, version, digest, files}` rebuilt from the package's own members is the summary's, with file hashes that add
  up to its digest and id and version inside core's manifest patterns;
- it signs the canonical JSON of that payload (sorted keys, no spaces, ASCII: core's
  `canonical_text(signing_payload(package))`, byte for byte, as `tests/fixtures/signing-vector.json` proves), and
  writes the one-line envelope `{form: "automatos-theme-signature/v1", algorithm: "ed25519", keyId, id, version,
  digest, signature}` as `<version>.sig.json`;
- it refuses when the secret is absent or isn't an Ed25519 key, and when any line it would print holds a line break
  or `::`; it prints the key id, never the key.

The next step verifies the envelope with `scripts/sign/verify.ts` against `keys/theme-signing.json`, and the
Marketplace verifies it again against its own copy of the keys before it stores the signature.

## 5. The keys file

`keys/theme-signing.json` is `{"schema":1,"keys":[{keyId, spki, status, added}]}`, `status` one of `active`, `retired`
and `revoked`. It holds one key: Automatos's theme-signing key, `ed25519:e138b6d0fa7aaaf3`, active, added 2026-10-26.
If it held no active key, no signature would verify: the publish run stops at its verify step, and `theme-release.yml`
stops when a committed signature is there to check. A change to the keys is a pull request to `main`, with the same
bytes in core's `orchestrator/services/themes/data/signing-keys.json` ([OFFICIAL-LISTING.md](OFFICIAL-LISTING.md),
"Rotate and revoke").

## Changing a dependency

`package-lock.json` is committed, CI installs from it with `npm ci`, and nobody edits it by hand. Every dependency is
pinned to an exact version (the root tests enforce it), and a new one needs the maintainer's OK. To add or bump one:

1. Pin it exactly in the `package.json` that needs it, and push the branch.
2. Run `kit-lockfile.yml` on that branch: `gh workflow run kit-lockfile.yml --ref <branch>`, or Run workflow in the
   Actions tab. It runs `npm install --package-lock-only --ignore-scripts` with the same Node and npm as `kit.yml`:
   it reads registry metadata only, writes no `node_modules`, runs no install script, keeps every entry the
   committed lockfile records and resolves only what changed. Its token can read the repository and nothing else.
3. Download its `kit-lockfile` artifact, check its sha256 against the one in the run's summary, and commit it as
   `package-lock.json`.

The pull request then has one CI run, which installs with `npm ci`. A new theme folder under `themes/` is a new
workspace and goes through the same dispatch. A change to `packages/look-kit/src` or `packages/mascot/src` is a change
to every released theme that bundles them (step 1).
