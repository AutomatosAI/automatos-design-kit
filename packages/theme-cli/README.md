# @automatos/theme-cli

`automatos-theme pack <theme folder> [--out <folder>]` turns a built theme into the package the Automatos server
installs.

It reads the folder's package files (`theme.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, and everything under
`dist/`, `boot/`, `looks/`, `assets/` and `source/`), checks them as core's package reader does, and writes:

- `<publisher>.<slug>-<version>.autotheme`: a plain zip, members in path order with one fixed time, so the same
  files always give the same package;
- `<publisher>.<slug>-<version>.sha256.json`: each file's type, size and sha256, the package digest the server
  names the package by, and the sha256 of the zip.

When the server would refuse the theme, `pack` writes nothing, prints every reason with the server's code
(`MISSING_SLOT`, `CSS_UNSCOPED`, `NOT_ALLOWED`, ...) and exits 1. The checks are core's own validators for
`theme.json`, the looks and the prepaint table (vendored in `src/core`, see its README), and ports of the server's
zip reader (`src/members.ts`, `src/check-package.ts`) and CSS scope check (`@automatos/vite-preset/css-scope`).
Core's shared test corpus holds all of them to the server's verdicts (`test/core-corpus.test.ts`).

Node 22.18 or later runs the TypeScript sources directly (type stripping): `npm run pack` packs core's hello
test theme into `out/`.
