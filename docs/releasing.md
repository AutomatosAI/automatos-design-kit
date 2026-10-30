# Releasing a theme

How a kit theme version becomes a GitHub release, and how it is then reviewed and signed, exactly as the workflows
in `.github/workflows/` do it. The kit releases three themes, Play (`themes/play`, `automatos/play`), HUD
(`themes/hud`, `automatos/hud`) and Arcade (`themes/arcade`, `automatos/arcade`). Every step below is started by a
person; kit CI checks the workflows, not the runs.
The run that lists a version as the official theme on the hosted edition, with the admin queue's side of each step,
is [OFFICIAL-LISTING.md](OFFICIAL-LISTING.md).

| Workflow | File | Started by | What it does |
|---|---|---|---|
| Kit | `kit.yml` | every pull request and push to `main` | The released-themes guard, then build, lint, typecheck, test and pack; the harness shots |
| Theme release | `theme-release.yml` | a pushed `play-v*`, `hud-v*` or `arcade-v*` tag; a push to `main` that adds a signature; Run workflow on `main` | Builds the tagged theme, publishes its release, attaches its signature |
| Theme review | `theme-review.yml` | Run workflow, at the tag | Reviews one package with no network and no secrets |
| Theme sign | `theme-sign.yml` | Run workflow on `main`, approved by a required reviewer | Signs an approved version |
| Kit lockfile | `kit-lockfile.yml` | Run workflow on a branch | Resolves `package-lock.json` for a dependency change |

## 1. Make the change under a new version

A released version never changes. While a theme's `theme.json` names a version that has a release tag, kit CI's
first step (`scripts/release/released-unchanged.mjs`, before anything is installed) fails if any of that theme's
packed paths differs from the tag:

| Theme | Packed paths the guard holds to the tag |
|---|---|
| Play | `themes/play/` `theme.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `assets/`, `src/`; `packages/look-kit/src`, `packages/mascot/src` |
| HUD | `themes/hud/` `theme.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `assets/`, `boot/`, `looks/`, `src/`; `packages/look-kit/src`, `packages/mascot/src` |
| Arcade | `themes/arcade/` `theme.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `assets/`, `boot/`, `looks/`, `src/`; `packages/mascot/src` |

These are the paths `pack` collects that each theme folder commits, and the `src/` of each kit library the theme
bundles. Play's `dist/`, `boot/` and `looks/` are gitignored and built from `src/` by its build; HUD and Arcade both
commit `boot/` and `looks/`, and only their `dist/` is built. Play and HUD both bundle `packages/look-kit/src` and
`packages/mascot/src`; Arcade bundles `packages/mascot/src` alone. So a change to `packages/look-kit/src` needs a
new version of Play and HUD, and a change to `packages/mascot/src` needs a new version of every released theme.

The guard reads each theme's version from its `theme.json` and lists the theme's tags on `origin` with
`git ls-remote`:

- the version has a tag: the packed paths must be as that tag has them, or the job fails and lists each changed path;
- no tag names the version, and it is above every release tag of that theme: it passes (nothing of it is released);
- no tag names it, and it is not above the latest release: it fails, since a new version must be above every
  release;
- the theme has no release tag yet: it passes.

Each theme is checked against its own tags alone, Play first, and the job fails when either fails. A failure to list,
fetch or compare is a failure, never a pass.

So a change to a released theme, in one pull request:

1. Raise `version` in the theme's `theme.json` and in its `package.json` to the same new value, above every release
   (each theme's own `test/manifest.test.ts` holds the two equal).
2. Add the version's section at the top of the theme's `CHANGELOG.md`, newest first, saying what changed.
   `CHANGELOG.md` is packed, so write it before the tag: after the release it can only change with another version.
3. Let kit CI pass. Its `kit` job packs every theme and uploads the packages as the `kit-themes` artifact.

The theme's `signatures/` folder is never packed and is not among the packed paths, so committing a signature later
never trips the guard.

## 2. Tag and release

Merge to `main`, then push the tag on a commit of `main`: `play-v<major>.<minor>.<patch>` for Play,
`hud-v<major>.<minor>.<patch>` for HUD, `arcade-v<major>.<minor>.<patch>` for Arcade.

```sh
git tag play-v<version> <commit on main>
git push origin play-v<version>
```

GitHub runs no path filter for a tag push, so every `play-v*`, `hud-v*` and `arcade-v*` tag runs
`theme-release.yml`'s `release` job (permissions: `contents: write` and nothing else; no secrets). In order, it:

1. checks out the tagged commit with all history, sets up Node 22 and pins npm 11.21.1, as `kit.yml` does;
2. checks the tag matches `^(play|hud|arcade)-v[0-9]+\.[0-9]+\.[0-9]+$`, and takes the theme (`play`, `hud` or
   `arcade`) and the version from it;
3. checks that `themes/<theme>/theme.json`'s `id` is `automatos/<theme>`, that the tagged commit is on
   `origin/main`, and that `theme.json`'s `version` is the tag's;
4. installs with `npm ci --ignore-scripts`, runs the root `build`, then the theme's `pack` script
   (`npm run pack --workspace themes/<theme>`, which writes into `themes/<theme>/out/`);
5. writes `automatos.<theme>-<version>.autotheme.sha256` with `sha256sum` and checks it against the `zipSha256` that
   `pack` recorded in `automatos.<theme>-<version>.sha256.json`;
6. looks for `themes/<theme>/signatures/<version>.sig.json` at the tag. When there is one, `keys/theme-signing.json`
   must hold an active key (otherwise the job stops: "No signing key yet") and `scripts/sign/verify.ts` must verify
   the envelope against the package just built; when there is none, the release goes out unsigned;
7. publishes the release with `gh release create <tag> --verify-tag`: the `.autotheme`, its `.autotheme.sha256` and
   any signature, titled with `theme.json`'s `name` and the version ("Play 1.1.1", "HUD 1.0.0", "Arcade 1.0.0"), and
   notes giving
   the package digest (the one an admin queue shows) and the file's sha256, then the pictures `theme.json` lists
   under `previews`, each shown from the tag (`scripts/release/preview-notes.ts`; a theme that lists none shows none).

A local or open-source edition installs the release asset with Settings › Appearance › Themes › Install theme.

## 3. Review

A Marketplace version is reviewed by a person, who runs `theme-review.yml` at the tag, so the review uses the kit's
scripts and lockfile as they were when the theme was built:

```sh
gh workflow run theme-review.yml --ref play-v<version> \
  -f package_url=https://github.com/AutomatosAI/automatos-design-kit/releases/download/play-v<version>/automatos.play-<version>.autotheme \
  -f expected_digest=<the 64-hex digest the admin queue shows>
```

The job has no permissions and no secrets. It refuses a `package_url` that isn't `https://` and an
`expected_digest` that isn't 64 lower-case hex characters, downloads the package (HTTPS only, at most 10 MiB, two
minutes), installs the kit with `npm ci --ignore-scripts`, and then runs `scripts/review/main.ts` in
`docker run --network none` on a Node image pinned by digest: the kit mounted read-only, all capabilities dropped,
no new privileges. The review's checks, in order: no network, the package (core's reader, as the kit ports it), the
digest against `expected_digest`, `source/` present, the JS rules on `source/`, and the reproducible build of
`source/` with the kit's preset. The outcome is `pass` only when every check passed; a JS-rule warning is listed for
the reviewer and fails nothing. The job summary holds the text the reviewer pastes into the admin queue's report
note, with its outcome.

To see the same checks before submitting, run `automatos-theme check <theme folder> --rebuild` ([cli.md](cli.md)).

## 4. Sign

Approving a version in the admin queue records a signature request. A person runs `theme-sign.yml` on `main` with
the whole request as its input:

```sh
gh workflow run theme-sign.yml --ref main -f request='<the whole request JSON from the admin queue>'
```

- The job runs only on `main`, in the `theme-signing` environment, whose deployment branches are `main` only and
  whose required reviewers are the named signers: the run waits until one of them approves its use of the key.
- It installs nothing. Its one step, `node scripts/sign/cli.ts`, reads the request from `SIGN_REQUEST` and the
  Ed25519 key (a PKCS#8 PEM) from the environment secret `THEME_SIGNING_KEY`, which no other workflow may name.
- It refuses when the secret is absent, when the request is malformed or its file hashes don't add up to its
  digest, when the id or version breaks core's manifest patterns, when `requestId` is not a UUID, and when any line
  it would print holds a line break or `::`.
- It prints the request id and the base64 signature over the canonical JSON of `{id, version, digest, files}` (to
  paste into the admin queue), the key id, and the one-line `.sig.json` envelope to keep next to the package:
  `{form: "automatos-theme-signature/v1", algorithm: "ed25519", keyId, id, version, digest, signature}`.

## 5. Attach the signature to the release

Commit the envelope the sign run printed as `themes/<theme>/signatures/<version>.sig.json`, in a pull request to
`main`. When it merges, the push to `main` runs `theme-release.yml`'s `signature` job, which:

1. takes the one signature file that push added or changed (exactly one, or it stops) and makes the tag from it:
   `themes/play/signatures/<version>.sig.json` names `play-v<version>`, and the same for HUD's and Arcade's; the
   tag must exist;
2. keeps the envelope and `keys/theme-signing.json` from the triggering commit, so a key published after the tag
   counts and a revoked one stops counting, and checks the keys file holds an active key;
3. checks out the **tagged** commit (never `main`'s head), checks it as the release job does, installs, builds and
   packs it, and checks the `.sha256` against `pack`'s record;
4. verifies the envelope against that build with `scripts/sign/verify.ts`; a mismatch fails the run, since the release
   asset must rebuild to the signed bytes on another runner;
5. uploads the envelope to the tag's release with `gh release upload --clobber`.

To attach a signature again, run the workflow by hand on `main` with the `tag` input set (`play-v<version>`,
`hud-v<version>` or `arcade-v<version>`). The job runs only on `main`, so a run on another branch can't bring its
own keys file.

`keys/theme-signing.json` is `{"schema":1,"keys":[{keyId, spki, status, added}]}`, `status` one of `active`, `retired`
and `revoked`. It holds one key: Automatos's theme-signing key, `ed25519:e138b6d0fa7aaaf3`, active, added 2026-10-26.
Nothing is signed with it yet; the first signatures come from Theme sign runs (section 4). If the file held no active
key, no signature would verify, and both jobs stop when a signature is there to check. A change to the keys is a pull
request to `main`, with the same bytes in core's `orchestrator/services/themes/data/signing-keys.json`
([OFFICIAL-LISTING.md](OFFICIAL-LISTING.md), "Once, before the first signature").

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
