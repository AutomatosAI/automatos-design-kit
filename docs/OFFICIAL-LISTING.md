# Listing a theme on the Marketplace

How a kit theme version reaches each Automatos edition. The merge is the approval: a pull request that raises a
theme's `version`, once it is merged to `main` and the `Kit` workflow has passed on it, is reviewed, signed, listed on
the hosted Marketplace and released here by `theme-publish.yml`, with nobody running anything. `<slug>` is the theme's
folder under `themes/`, `<publisher>` the part of its `theme.json` id before the slash, and `<v>` its version.

- **Local and open-source editions** install a version from its GitHub release: the `<publisher>.<slug>-<v>.autotheme`
  asset, its `.sha256` and its `<v>.sig.json`, through Settings › Appearance › Themes › Install theme.
- **The hosted edition** gets it from its Marketplace listing (Marketplace › Themes). A theme is **Official** when its
  publisher is the reserved `automatos` publisher and the version shown carries a signature that verifies with an
  active key of the Automatos keys file. Every publisher the run publishes for is signed the same way; only
  `automatos` themes read as Official.

Play, HUD and **Arcade** (`automatos/arcade`, `themes/arcade`) are all published this way. Arcade has no `arcade-v*`
tag yet, so the first `theme-publish.yml` run on `main` picks its version, 1.0.0: it reviews, signs and lists it, and
releases `arcade-v1.0.0` with `automatos.arcade-1.0.0.autotheme`, its `.sha256` and `1.0.0.sig.json`. Push no
`arcade-v*` tag by hand for it: `theme-release.yml` would release it unlisted and unsigned, and it would then need a
backfill (below).

## The workflows

| Workflow (Actions tab) | File | Started by | What it does |
|---|---|---|---|
| Theme publish | `theme-publish.yml` | `Kit` passing on a push to `main`; Run workflow on `main` with `tag` (a backfill) | Picks, builds, reviews, signs, publishes and releases each theme whose version moved |
| Theme release | `theme-release.yml` | a release tag a person pushes | Releases that tag here, unlisted and unsigned |
| Theme review | `theme-review.yml` | Run workflow at a tag, with a package URL and its digest | Reviews one package with no network, for a submission a person reviews in the admin queue |

## What a merge does

1. **Pick** (`scripts/release/bumped.mjs`, Node alone): each folder under `themes/` is a theme, and its `theme.json`
   id must be `<publisher>/<slug>`, its slug the folder's name. A theme is picked when its version is above its
   newest `<slug>-v*` tag (or it has none) and its publisher is listed in `release/publishers.json` (today
   `automatos` alone). A theme of another publisher is built and tested with the kit, never published.
2. **Build**, one job per theme, with no secrets, no environment and a read-only token: at the merged commit it
   installs the kit with `npm ci --ignore-scripts`, builds, packs the theme, checks the `.sha256` against pack's
   `.sha256.json`, and runs `scripts/review/main.ts` on the package in `docker run --network none`, as
   `theme-review.yml` does. The review's text is the summary the Marketplace keeps as the version's review note.
3. **Publish**, one job per theme, in the `theme-publish` environment, installing nothing: it checks the package's
   bytes against pack's summary (`scripts/sign/from-pack.ts check`), compares them with any release the tag has
   already, signs `{id, version, digest, files}` with `THEME_SIGNING_KEY` (`from-pack.ts sign`; the signed text is
   core's canonical text of the version), verifies the envelope against `keys/theme-signing.json`, then posts three
   parts to `THEME_PUBLISH_API_URL` + `/api/marketplace/themes/publish` with `THEME_PUBLISH_KEY` as its bearer key:
   `package` (the `.autotheme` file), `signature` (the `.sig.json` envelope) and `review_summary` (the review's text).
4. **The Marketplace** checks the key, the publisher, the signature and the package, runs its own review of it,
   keeps the summary as the review note, approves the version and stores its signature, and answers `published`; for
   bytes it already holds, approved and signed, it answers `unchanged`.
5. **Release**: on `published`, or `unchanged`, the run releases `<slug>-v<v>` at the commit it built, with the
   `.autotheme`, its `.sha256` and its `<v>.sig.json`, or adds the `.sig.json` to the release the tag has already.
   A release's assets are never replaced. The run makes the tag itself; a tag made with the run's token starts no
   workflow, so `theme-release.yml` never runs for it.

Several themes moved in one merge each build and publish on their own. Push no release tag by hand for a version a
merge will publish: `theme-release.yml` would release it unlisted and unsigned, and the publish run would then see
the version as released and pick nothing. A version released that way is listed with a backfill (below).

## What blocks a publish

The run fails, releases nothing and says why (the Marketplace's error code, never a key) when:

- `Kit` failed on the merged commit, or the run was not started by a push to this repository's `main` (a fork's
  branch named `main` starts nothing).
- `bumped.mjs` refuses: a folder that isn't its id's slug, an id or version outside core's patterns, a `theme.json`
  or `release/publishers.json` it can't read. Nothing is picked from that run.
- The build, the pack or the checksum fails, or the review doesn't pass: its text must name the package's digest
  with `Outcome: pass`.
- The downloaded package isn't the bytes pack described; the tag's release holds other bytes than the ones rebuilt;
  the tag is at another commit than the one built.
- `THEME_SIGNING_KEY` is missing, or isn't the private half of an active key in `keys/theme-signing.json`.
- `THEME_PUBLISH_API_URL` isn't an `https://` address, or `THEME_PUBLISH_KEY` is missing.
- The Marketplace refuses the post:
  - **400**: the request wasn't the multipart form the endpoint takes.
  - **401**: the publish key is missing or wrong.
  - **403**: the publisher isn't one the endpoint publishes for, or belongs to someone else (`PUBLISHER_TAKEN`), or
    the Marketplace is off.
  - **409**: the version is not above the highest one held, is closed (`VERSION_CLOSED`), or is being published
    already (`PUBLISH_BUSY`).
  - **413**: the request is over the size the endpoint takes.
  - **422**: a refused package or `source/` (`PACKAGE_REFUSED`), a signature no active key verifies or that does
    not bind this id, version and digest, a summary that doesn't name this digest with `Outcome: pass`, a `blocked`
    verdict, a disabled digest, or a missing part (`PART_MISSING`).
  - **429**: the endpoint's daily publish quota is spent (`PUBLISH_QUOTA`).
  - **503**: the endpoint is not configured (`PUBLISH_NOT_CONFIGURED`), its reviews are busy (`REVIEWS_BUSY`), or
    its store or keys can't be read.

After a 503 for busy reviews or a 429, run the failed jobs again later (Actions › the run › Re-run failed jobs).
A run that stopped after the Marketplace's answer and before the release is run again the same way: the Marketplace
answers `unchanged` for the same bytes, and the release is made then.

## The `theme-publish` environment, once

Settings › Environments › New environment, `theme-publish`:

- Deployment branches and tags: selected branches, `main` only. No required reviewers: the merge is the approval.
  Only maintainers merge, `.github/CODEOWNERS` names an owner for every path a published package is built from, and
  pull requests never see the environment's secrets.
- Secret `THEME_SIGNING_KEY`: Automatos's Ed25519 theme-signing key as a PKCS#8 PEM, the private half of the active
  key in `keys/theme-signing.json`, with an offline backup. Losing it means signing every listed version again
  with a new key.
- Secret `THEME_PUBLISH_KEY`: 32 random bytes as hex (`openssl rand -hex 32`). The Marketplace holds only its
  lower-case hex sha256 (`printf %s "$key" | sha256sum`), as `THEME_PUBLISH_KEY_SHA256`; it acts as a service user
  of its own and may do nothing but publish versions of the listed publishers.
- Variable `THEME_PUBLISH_API_URL`: the core API's `https://` address, with no path.

Each secret is read by one step of the publish job alone (Sign, and Publish to the Marketplace), and no other
workflow may name either; the root tests enforce it. The Marketplace's side is its own configuration:
`THEME_PUBLISH_KEY_SHA256`, `THEME_PUBLISH_PUBLISHERS` (the publishers `release/publishers.json` lists) and
`THEME_PUBLISH_ACTOR` (the service user); with any of them unset the endpoint answers 503.

The signing key's public half is in `keys/theme-signing.json` here and in the core repo's
`orchestrator/services/themes/data/signing-keys.json`, the two files identical:
`{"keyId": "ed25519:<16 hex>", "spki": "<base64>", "status": "active", "added": "<YYYY-MM-DD>"}`. Both hold
Automatos's theme-signing key, `ed25519:e138b6d0fa7aaaf3`, active since 2026-10-26.

## Rotate and revoke

- **Rotate the publish key**: make a new one and add its sha256 to `THEME_PUBLISH_KEY_SHA256` beside the old one
  (comma-separated, two at most), deploy, replace the `THEME_PUBLISH_KEY` secret, then drop the old hash and deploy.
- **Revoke the publish key**: remove its hash from `THEME_PUBLISH_KEY_SHA256` and deploy; with no hash left the
  endpoint answers 503 and nothing publishes. Delete the secret, and deactivate in the admin queue any version it
  published that you don't trust.
- **Rotate the signing key**: make a new Ed25519 key, add its public half as a second active key to both keys files
  (a pull request to each repository, then a core deploy), and replace the `THEME_SIGNING_KEY` secret. The next
  publish signs with it. Set the old key `retired` in both files only when nothing still needs its signatures: a
  retired key verifies nothing.
- **Revoke the signing key**: set it `revoked` in both keys files and deploy, and delete the secret. Nothing it
  signed verifies any more, so no version it signed reads as Official; make a new key as above before the next
  publish.

## Backfill

A version released before this flow existed, or by a tag pushed by hand, is listed by running the workflow on
`main` with its tag:

```sh
gh workflow run theme-publish.yml --ref main -f tag=play-v1.2.1
gh workflow run theme-publish.yml --ref main -f tag=hud-v1.1.2
```

The tag must exist and be on `main`. The run takes its scripts and keys file from `main`, rebuilds the theme at the
tag (the kit, the lockfile and the review as the tag had them), and holds the rebuilt `.autotheme` to the release's
own asset, byte for byte, before anything is signed or sent: any difference fails the run. It then reviews, signs and
publishes the version, and adds only its `<v>.sig.json` to the release.

## After a publish

The run's summary shows the review's text for each theme; the release carries the `.autotheme`, its `.sha256` and
its `.sig.json`; Marketplace › Themes lists the version, with the **Official** badge for an `automatos` theme. In a
hosted workspace with `workspace:manage`, **Add to my workspace** and **Use this theme** install it; then
`GET /api/themes/mobile/<install id>` answers the theme's phone skin.
