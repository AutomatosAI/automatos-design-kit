# @automatos/theme-sdk (vendored types)

The type declarations of `@automatos/theme-sdk` 1.3.0, the one module an Automatos theme imports from the host.
**Types only.** At runtime the host serves the SDK through its import map, so a theme never bundles it: the
vite-preset keeps `@automatos/theme-sdk` external.

## Where it comes from

Vendored from core (`AutomatosAI/automatos-ai`), `frontend/packages/theme-sdk`, at commit
`1a8956c874dc42cff05b96f431c50b7d722a71aa` (SDK 1.3.0), core `main` on 30 Oct 2026, after the merge of pull request
#1375. Since `3d8c72e7b58d32866f058a171d68bbbb8a335504`, the kit's previous pin (SDK 1.2.0), SDK 1.3.0 adds the
`proactive` area (`areas/proactive.d.ts`: the day's brief, what Auto depends on, the open suggestions with Start and
Hide, and calibration), the cards area's proactive defaults (`BriefCard`, `SuggestionCard`, `StatusLabel`,
`ReadinessList`, `CalibrationCard`, `ReplyChips`) and an approval's `approval_view`, the voice area's `BriefVoice`,
the theme area's `DISPLAY_STATE_LABELS`, and a Mission's `display_state`, `next_step` and `retry`. By version
(PRD-261 D2-b): `package.json`, `index.d.ts`, `areas/*.d.ts` and `internal/*.d.ts` are core's files unchanged. Only
this README is the kit's own.

It stays vendored until core publishes the SDK tarball on its CDN; then the kit depends on that tarball by its
exact-version URL instead, and this folder goes.

## Updating it

Core bumps the package's `version` (and its `sdkVersion`) whenever the SDK's surface changes. To take a new
version, copy the folder again from the core commit that has it, keep this README, and name the commit here and in
the pull request. Never edit the declarations in the kit: core wins.

Themes depend on it as a workspace package (`"@automatos/theme-sdk": "1.3.0"` in `peerDependencies`), and
TypeScript reads `index.d.ts` through the package's `types` and `exports`.
