# From a design to an installed theme

The nine steps from a design session to a theme a member can install, generic for any theme: design, brief, base,
launch, judge, fix, release, install, list. Each step is a sentence or two and the exact commands; the proof protocol
([proof/README.md](../proof/README.md)) carries steps 4 and 5. Arcade is the worked example throughout, since it is
public: a made-up theme, not a released one, so its id and commands below are illustrative, not a real `themes/`
folder.

## 1. Design

A Claude Design session draws the theme before any code. The handoff a brief and a run can read is: a `README.md`
of the frame's rules and which pages it covers; `looks.json` with the knobs and their presets, each knob's values,
and the WCAG contrast pairs the kit will hold the built theme to; and an HTML mock per screen (`*.html`, or `*.dc.html`
when the session exports Claude Design's own format). The host's own parts — the approval cards, the voice button,
the pages the theme does not replace — are placed in the mock as the host draws them, never restyled or redrawn as
the theme's own markup ([pitfalls.md](pitfalls.md), "Styling the approval cards"). A phone skin, when the brief asks
for one, is data only in the handoff too: colours, fonts and Auto's clips, never a drawn phone screen
([mobile-skins.md](mobile-skins.md), "What a skin is, and isn't").

## 2. Brief

The brief ([proof/BRIEF.template.md](../proof/BRIEF.template.md)) is what a build is told to build; the design is
what it was drawn as. The two must agree on the theme's id, its slots, which pages it replaces or adds, and its phone
skin (or the absence of one) — a brief that names a slot the design never draws, or a design that draws a page the
brief does not mention, is a gap to fix before launching, not one to leave for the run to find.

## 3. Base

The owner tags the commit the run builds against, so every proof launched from it starts from the same kit:

```sh
git tag kit-b06-base <commit on main>
git push origin kit-b06-base
```

## 4. Launch

```sh
scripts/proof/launch.sh --id arcade --slug arcade --brief briefs/arcade/BRIEF.md --design "design/Arcade handoff" \
  --model claude-opus-5-5 --dest /tmp/proofs/arcade-01
```

`--design` is optional and takes the handoff folder from step 1, copied into the run's clone as `proof/<id>/design/`
([proof/README.md](../proof/README.md), "Launching a run"). The run is unattended and sandboxed: its model is pinned
by the flag, it reads and writes only inside its clone, and its shell runs in a sandbox that denies the home folder
and reaches only the npm registry (proof/README.md, "Isolation").

## 5. Judge

```sh
node scripts/proof/audit.mjs /tmp/proofs/arcade-01.transcript.jsonl /tmp/proofs/arcade-01 --deny <file kept outside the repo>
git push origin proof/arcade-arcade
```

The audit reads the transcript for a leak file's text in any tool result (the authoritative check) and for what each
call reached for; push the proof branch and open a pull request, which runs the kit's own CI (`guard.mjs`, the build,
`automatos-theme check`, and the harness's shots on Chromium and WebKit with an axe scan — `proof/README.md`, "What
each check proves"). Compare the shots the `kit-proof-shots` artifact uploads with the design's mock, page by page
and preset by preset.

## 6. Fix

Every row of the run's `proof/<id>/GAPS.md` is a fix to the kit, not to the theme: a missing guide, a CLI command
that failed or misled, a template that lacked what the brief needed, a check that passed something wrong or refused
something right, or a brief or environment problem the triage can defer. Each fix ships with a test that fails
without it, same as any other kit change.

## 7. Release

The proof branch can never merge as it stands — its first commit deletes the leak paths
([proof/README.md](../proof/README.md), "After the run"). Open a new branch from `main` that takes only
`themes/<slug>/` and `proof/<id>/` from the proof branch, with the new workspace's lockfile entries, and merge it.
The merge releases the theme: `theme-publish.yml` takes any theme whose version has no `<slug>-v*` tag yet and whose
publisher `release/publishers.json` lists, so `pixelcade/arcade` 0.1.0 is released as `arcade-v0.1.0` with no tag
pushed by hand ([docs/releasing.md](../docs/releasing.md), "Merge to publish"). The tag rule is any
`<slug>-v<major>.<minor>.<patch>`; a theme of a publisher the list doesn't name needs that publisher added first.

## 8. Install

A local or open-source edition installs the release asset by hand: Settings › Appearance › Themes › Install theme
with the `.autotheme` file. The install is private and opts the workspace in to code that has not been reviewed
(`automatos-theme install`'s own `opt-in` step does the same thing from the command line). Check it in the browser at
desktop and phone width, and, when the theme carries a phone skin, in Automatos Go.

## 9. List

The same merge lists it: the publish run reviews the package, signs it and sends it to the Marketplace, which
approves it, before the release is made ([docs/OFFICIAL-LISTING.md](../docs/OFFICIAL-LISTING.md)); a later version
is listed by the merge that raises it. A listed version turns **Official** only when its publisher is the reserved
`automatos` publisher and its signature verifies with an active key of the Automatos keys file.
