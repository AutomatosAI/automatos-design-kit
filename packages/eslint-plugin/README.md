# @automatos/eslint-plugin

The JS rules the Automatos Marketplace review runs on a theme package's `source/` (`@automatos/theme-rules`), as
ESLint rules, so a theme's author sees a refused pattern in `npm run lint` before the review does.

## Use it in a theme

```js
// themes/<theme>/eslint.config.js
import automatos from '@automatos/eslint-plugin'

export default [automatos.configs.recommended]
```

```jsonc
// themes/<theme>/package.json
"scripts": { "lint": "eslint src --max-warnings 0" },
"devDependencies": { "@automatos/eslint-plugin": "0.1.0", "eslint": "9.39.5" }
```

The kit's root `lint` script runs every workspace's `lint`, so kit CI's Lint step lints the theme's `src/`.
`--max-warnings 0` fails the lint on a warning too, as Play's does; leave it out to have warnings listed only.

## The rules

One rule per code the review reports, named by the code: `@automatos/JS_FETCH`, `@automatos/JS_COMPUTED_GLOBAL`,
`@automatos/JS_ALIAS_IMPORT` and the rest. They are every code of theme-rules' `RULES` table, then the codes its
other checks report (`JS_ALIAS_IMPORT`, `JS_NEXT_IMPORT`, `JS_IMPORT`, `JS_PATH_IMPORT`, `JS_DYNAMIC_IMPORT`,
`JS_MINIFIED`, `JS_OBFUSCATED`). The plugin's tests hold the list to every code in theme-rules' source, so a code
added there without a rule here fails CI.

Each rule runs theme-rules' own `fileFindings` on the file's text and reports its code's findings on their lines,
with the review's message. The review reads a file at `source/<its path under src/>`, and so does the rule: a
relative import that leaves `src/` is `JS_PATH_IMPORT` here as it is there.

`configs.recommended` lints every script under `src/` (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, as the
review reads them) with every rule: a code the review refuses on is an error, a code it only lists for the reviewer
(`JS_SPEECH_RECOGNITION`, `JS_GET_USER_MEDIA`) is a warning.

## What it reads

The text, as the review does, comments and strings included. The recommended config's parser (`textParser`) parses
nothing, so:

- TypeScript and JSX lint with no parser package; a syntax error is the typecheck's to report.
- ESLint reads no comment as a directive. An `eslint-disable` comment hides no finding (the review honours none),
  and one naming another plugin's rule, in a file copied from an app, is not an error.

The theme's `src/` is `<cwd>/src`, eslint run from the theme's folder as its `lint` script runs it. Run from
elsewhere, set it: `settings: { automatos: { sourceRoot: '<the theme folder>/src' } }`. A file outside it stops
the lint with an error naming both paths, rather than be checked at a path the review would never read.

Like the review's rules, this is a lint for honest authors and can be bypassed; the person who reviews every version
is the control.
