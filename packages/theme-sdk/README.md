# @automatos/theme-sdk (vendored types)

The type declarations of `@automatos/theme-sdk` 1.1.0, the one module an Automatos theme imports from the host.
**Types only.** At runtime the host serves the SDK through its import map, so a theme never bundles it: the
vite-preset keeps `@automatos/theme-sdk` external.

## Where it comes from

Vendored from core (`AutomatosAI/automatos-ai`), `frontend/packages/theme-sdk`, at commit
`101a0bf33f64fb4f89af81b4293415be60b661ac` (SDK 1.1.0, which adds the `storage` area; since `7ae677b52` only comments changed: the
trial and `TrialExhaustedBanner` are described in credits, and `HeaderUtilities` names the credit balance), by version (PRD-261 D2-b):
`package.json`, `index.d.ts`, `areas/*.d.ts` and `internal/*.d.ts` are core's files unchanged. Only this README is
the kit's own.

It stays vendored until core publishes the SDK tarball on its CDN; then the kit depends on that tarball by its
exact-version URL instead, and this folder goes.

## Updating it

Core bumps the package's `version` (and its `sdkVersion`) whenever the SDK's surface changes. To take a new
version, copy the folder again from the core commit that has it, keep this README, and name the commit here and in
the pull request. Never edit the declarations in the kit: core wins.

Themes depend on it as a workspace package (`"@automatos/theme-sdk": "1.1.0"` in `peerDependencies`), and
TypeScript reads `index.d.ts` through the package's `types` and `exports`.
