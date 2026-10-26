# Listing Play as the official theme

How a Play version reaches each Automatos edition, and the run that lists it as the official theme on the
hosted edition. Every step is done by a person; kit CI checks the workflows, not the run. `<v>` is Play's
version as `themes/play/theme.json` gives it (for example `1.1.1`).

- **Local and open-source editions** install Play from its GitHub release: the `automatos.play-<v>.autotheme`
  asset, and its `<v>.sig.json` once the version is signed, through Settings › Appearance › Themes › Install
  theme.
- **The hosted edition** gets Play from its Marketplace listing (Marketplace › Themes), with the **Official**
  badge.

A theme is Official when its publisher is the reserved `automatos` publisher **and** the version shown carries
a signature that verifies with an active key of the Automatos keys file. So on the hosted edition Play turns
Official at step 5, when its signature is pasted, not at approval.

**HUD** (`automatos/hud`, `themes/hud`) follows the same steps, with its own names in place of Play's: the tag
`hud-v<v>` (on a commit of `main`, naming `themes/hud/theme.json`'s version), the release asset
`automatos.hud-<v>.autotheme` and its `.sha256`, the envelope `themes/hud/signatures/<v>.sig.json`, the review run
`--ref hud-v<v>` with that asset's URL, and `tag` set to `hud-v<v>` to attach a signature again. Theme release reads
the theme from the tag, so the same workflow releases both.

## The workflows

| Workflow (Actions tab) | File | Started by | Inputs |
|---|---|---|---|
| Theme release | `theme-release.yml` | a pushed tag `play-v<v>` (or `hud-v<v>`) on a commit of `main` (the release); a push to `main` that adds `themes/play/signatures/<v>.sig.json` (or HUD's), or Run workflow on `main` (the signature) | `tag`, by hand only |
| Theme review | `theme-review.yml` | Run workflow at the tag: `--ref play-v<v>` | `package_url`, `expected_digest` |
| Theme sign | `theme-sign.yml` | Run workflow on `main`; it waits for a required reviewer of the `theme-signing` environment | `request` |

## Once, before the first signature: the signing environment and key

- The `theme-signing` environment (Settings › Environments): deployment branches `main` only; required
  reviewers are the named signers, and either one may approve a run. "Prevent self-review" is off for now.
- One Ed25519 key, held only as that environment's secret `THEME_SIGNING_KEY` (a PKCS#8 PEM), with an
  offline backup: losing it means re-signing every official version.
- Its public half, in `keys/theme-signing.json` here and in the core repo's
  `orchestrator/services/themes/data/signing-keys.json`, the two files identical and holding one key:
  `{"keyId": "ed25519:<16 hex>", "spki": "<base64>", "status": "active", "added": "<YYYY-MM-DD>"}`. A Theme
  sign run prints both values (`Public key (SPKI, base64)` and `Key id`). Until this repo's file holds the key,
  Theme release attaches no signature: it stops with "No signing key yet".

## The run

### 0. Preconditions

- The hosted edition runs a core that reads this Play version (host contract 1.1.0 with the theme `mobile`
  block; from Play 1.2.0, theme SDK 1.2.0 with the `voice` area, and the declared `minWidth` honoured) and verifies a
  signature when it is pasted, and the public key above is merged in both repos and deployed.
- On hosted, a read-only query finds no theme version holding a signature stored before verification existed
  (`select count(*) from theme_packages where signature is not null` is 0); clear or re-sign any it finds.
- `play-v<v>` is pushed on a commit of `main`, and Theme release has published its release with
  `automatos.play-<v>.autotheme` and its `.sha256`.

### 1. Rehearse

Go through steps 2 to 6 with a throwaway version, `automatos/hello-drill` 0.0.1 (the kit's hello test theme
under that id and version, at its own https URL; it has no release, so step 5 ends at **Save signature**). Then
take it down: in the admin queue, **Deactivate**, with a reason. Never rehearse with Play: a submitted version
number is spent (the same version with other bytes, or a lower version, is refused).

### 2. Submit

In hosted workspace A, as a platform admin: Marketplace › Themes, under Publish theme,
**Choose a .autotheme file** (the release's `automatos.play-<v>.autotheme`), then **Submit for review**. The
version is pending with the verdict pass or review required, never blocked. Review required with "LLM stage
did not run" is expected when Play's `source/` and `dist/` exceed the LLM stage's chunk cap; approval still
works (raise `THEME_LLM_MAX_CHUNKS` for the run only if the reviewer wants the LLM read). The admin queue
(`/admin/themes`) shows the version's digest.

### 3. Review at the tag

```sh
gh workflow run theme-review.yml --ref play-v<v> -f package_url=https://github.com/AutomatosAI/automatos-design-kit/releases/download/play-v<v>/automatos.play-<v>.autotheme -f expected_digest=<digest>
```

`<digest>` is the 64-hex digest the admin queue shows. `--ref play-v<v>` runs the review with the kit as it was
at the tag (the scripts and lockfile Play was built with), whatever `main` holds by then. In the admin queue's
Isolated review (kit job) section, paste the job summary under "Paste the Theme review job summary", choose
**Pass**, **Save review note**, and confirm your identity when asked.

### 4. Approve and sign

**Approve** (confirm your identity). In the Signature section, **Copy request**, then run Theme sign on `main`
with the whole request as its `request` input: Actions › Theme sign › Run workflow (branch `main`), or

```sh
gh workflow run theme-sign.yml --ref main -f request='<the whole request JSON>'
```

A required reviewer of `theme-signing` approves the run's use of the environment (either reviewer may). The
run's summary prints the request id, the signature, the key id and the envelope.

### 5. Paste, then attach the envelope to the release

In the Signature section, under "Paste the signature the workflow printed", paste it and **Save signature**:
the version shows a verified signature by `ed25519:…`, and the listing turns Official. Then open one pull
request here that adds the envelope line the run printed as `themes/play/signatures/<v>.sig.json` (the folder
is not packed, so Play's released files stay as they are). Its merge to `main` runs Theme release's signature
job: it builds the tagged commit, verifies the envelope against that build and uploads it to the `play-v<v>`
release (`gh release upload --clobber`). A failure there means the release asset did not rebuild to the signed
bytes: stop and find out why. To attach it again later: Actions › Theme release › Run workflow on `main` with
`tag` set to `play-v<v>`.

### 6. Install from the listing

In hosted workspace B (another account, with `workspace:manage`): Marketplace › Themes shows Play with the
**Official** badge and its previews per preset. **Add to my workspace** (confirm your identity),
**Use this theme**, reload: Play renders with its looks, Auto and the pause control. Then, as that member,
`GET /api/themes/mobile/<install id>` answers `source: fromLooks`, the look's tone and tokens, no fonts, and
Auto's twelve states with clip and still URLs that load.

### 7. Evidence

Keep with the release's record: the run links of steps 3 to 5, screenshots of steps 5 and 6, and the output of
a read-only query showing one approved, reviewed and signed package row with two installations referencing it.
