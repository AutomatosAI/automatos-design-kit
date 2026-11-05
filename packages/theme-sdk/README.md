# @automatos/theme-sdk (vendored types)

The type declarations of `@automatos/theme-sdk` 1.5.0, the one module an Automatos theme imports from the host.
**Types only.** At runtime the host serves the SDK through its import map, so a theme never bundles it: the
vite-preset keeps `@automatos/theme-sdk` external.

## Where it comes from

Vendored from core (`AutomatosAI/automatos-ai`), `frontend/packages/theme-sdk`, at commit
`5e357cd7ffa5dc89725349784445fee5de985265` (SDK 1.5.0), the commit of core's pull request for SDK 1.5.0, pending its
merge: once it merges, the pin moves to the merge commit (the files there are these). Since
`d92cabf202f4a04f48a429d5f79a05cbe6c1eefb`, the kit's previous pin (SDK 1.4.0), SDK 1.5.0 adds, with no new name
(fields only): who answers a theme's chat and Plan, on the chat controller (`areas/chat.d.ts`: `HostChatController`'s
`agentId`, `chooseAgent(id)`, which refuses a session agent, an id the roster lacks and anything while the roster loads,
`planMode` and `setPlanMode(on)`, the host's own Plan switch), and a roster agent's `configuration`
(`areas/pages-agents.d.ts`: its `runtime`, 'cli' for a session agent, which a theme opens with a link to
`/chat?agent=<id>`). No area is added, and the host contract stays 1.1.0. `CHANGELOG.md` lists what each version
added. By version (PRD-261 D2-b): `package.json`, `CHANGELOG.md`, `index.d.ts`, `areas/*.d.ts` and `internal/*.d.ts`
are core's files unchanged. Only this README is the kit's own.

It stays vendored until core publishes the SDK tarball on its CDN; then the kit depends on that tarball by its
exact-version URL instead, and this folder goes.

## Updating it

Core bumps the package's `version` (and its `sdkVersion`) whenever the SDK's surface changes. To take a new
version, copy the folder again from the core commit that has it, keep this README, and name the commit here and in
the pull request. Never edit the declarations in the kit: core wins.

Themes depend on it as a workspace package (`"@automatos/theme-sdk": "1.5.0"` in `peerDependencies`), and
TypeScript reads `index.d.ts` through the package's `types` and `exports`.
