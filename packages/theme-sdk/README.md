# @automatos/theme-sdk (vendored types)

The type declarations of `@automatos/theme-sdk` 1.2.0, the one module an Automatos theme imports from the host.
**Types only.** At runtime the host serves the SDK through its import map, so a theme never bundles it: the
vite-preset keeps `@automatos/theme-sdk` external.

## Where it comes from

Vendored from core (`AutomatosAI/automatos-ai`), `frontend/packages/theme-sdk`, at commit
`3d8c72e7b58d32866f058a171d68bbbb8a335504` (SDK 1.2.0), core `main` on 28 Oct 2026, after the merge of pull request
#1365. Since `2e57484810204fb9b3481c86a0faed7c6eb3d0ae`, the kit's previous pin (SDK 1.2.0, which added the `voice`
area), only the doc comments of `areas/cards.d.ts` and `areas/chat.d.ts` changed, so the version stays: `AiLabelFence`
now draws its children alone and disables nothing (no theme can hide the host's AI label, which the host draws again
in its own layer), and Send and Try again refuse only on a page with no host AI label. By version (PRD-261 D2-b): `package.json`, `index.d.ts`, `areas/*.d.ts` and
`internal/*.d.ts` are core's files unchanged. Only this README is the kit's own.

It stays vendored until core publishes the SDK tarball on its CDN; then the kit depends on that tarball by its
exact-version URL instead, and this folder goes.

## Updating it

Core bumps the package's `version` (and its `sdkVersion`) whenever the SDK's surface changes. To take a new
version, copy the folder again from the core commit that has it, keep this README, and name the commit here and in
the pull request. Never edit the declarations in the kit: core wins.

Themes depend on it as a workspace package (`"@automatos/theme-sdk": "1.2.0"` in `peerDependencies`), and
TypeScript reads `index.d.ts` through the package's `types` and `exports`.
