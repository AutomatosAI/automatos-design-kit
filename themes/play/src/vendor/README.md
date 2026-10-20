# Vendored code

The theme builds only from its own `src/` (the vite-preset's source guard refuses a module from
`node_modules`), so the three outside packages Play's code needs are copied here as source, at the
versions core's `frontend/package-lock.json` pins. Each folder keeps its package's licence.

| Folder | Package | Licence | What is here |
|---|---|---|---|
| `lucide-react/` | lucide-react 0.279.0 | ISC | `createLucideIcon.js`, `defaultAttributes.js` and the two icons Play draws (`Search`, `ExternalLink`) from `dist/esm`, as published without the source map comments; `index.js` and `index.d.ts` export only those two. |
| `zustand/` | zustand 4.4.1 | MIT | `esm/vanilla.mjs` and `esm/index.mjs` as `vanilla.js` and `index.js`, their imports made relative; `vanilla.d.ts` and `index.d.ts` from `esm/vanilla.d.mts` and `esm/react.d.mts`. |
| `use-sync-external-store/` | use-sync-external-store 1.2.0 | MIT | `with-selector.js`: zustand's one import from it, as an ES module over React's own `useSyncExternalStore` (see the file's header). |

Each tarball was checked against the integrity hash in core's lockfile before it was copied.
Play's code imports these by relative path (`stores/play-chat-store.ts`, `components/play/shell/play-frame.tsx`,
`components/play/shell/play-sidebar.tsx`); `test/imports.test.ts` refuses any other bare import but the host's shared modules.
