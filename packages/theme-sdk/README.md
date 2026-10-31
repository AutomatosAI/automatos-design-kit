# @automatos/theme-sdk (vendored types)

The type declarations of `@automatos/theme-sdk` 1.4.0, the one module an Automatos theme imports from the host.
**Types only.** At runtime the host serves the SDK through its import map, so a theme never bundles it: the
vite-preset keeps `@automatos/theme-sdk` external.

## Where it comes from

Vendored from core (`AutomatosAI/automatos-ai`), `frontend/packages/theme-sdk`, at commit
`d08a242b5895522aac3e317a6eb3e7ec3d087f26` (SDK 1.4.0). A temporary pin: the head of core pull request #1383 on
31 Oct 2026, before it merges; re-pin to core `main` once it does. Since `1a8956c874dc42cff05b96f431c50b7d722a71aa`,
the kit's previous pin (SDK 1.3.0), SDK 1.4.0 adds, for a theme that owns `/chat`: a chat message's `knownParts`
(`areas/chat.d.ts`: its text, `brief@1`, `suggestion@1` and `reply_chips@1` parts, checked and frozen, as the union
`HostMessagePart`; a part of any other type is left out), the brief row Auto is reading (`areas/voice.d.ts`:
`BriefVoice`'s `onSpeakingRow` and its root's `data-voice-row`) and the brief's thumbs (`areas/proactive.d.ts`:
`useRateBrief`, through the host's digest feedback route, and given the brief's `state_hash` the person's own rating
of it, shared with `BriefCard`'s thumbs, which `thumbs={false}` leaves out). No area is added, and the host contract
stays 1.1.0. `CHANGELOG.md` lists what each version added. By version (PRD-261 D2-b): `package.json`, `CHANGELOG.md`,
`index.d.ts`, `areas/*.d.ts` and `internal/*.d.ts` are core's files unchanged. Only this README is the kit's own.

It stays vendored until core publishes the SDK tarball on its CDN; then the kit depends on that tarball by its
exact-version URL instead, and this folder goes.

## Updating it

Core bumps the package's `version` (and its `sdkVersion`) whenever the SDK's surface changes. To take a new
version, copy the folder again from the core commit that has it, keep this README, and name the commit here and in
the pull request. Never edit the declarations in the kit: core wins.

Themes depend on it as a workspace package (`"@automatos/theme-sdk": "1.4.0"` in `peerDependencies`), and
TypeScript reads `index.d.ts` through the package's `types` and `exports`.
