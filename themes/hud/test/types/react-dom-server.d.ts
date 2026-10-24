// The one react-dom/server function HUD's tests use: rendering a screen as the host's server would, before the
// browser reads anything (the LOOK drawer's and the style sheet's first frame). Copied from Play's
// test/types/react-dom-server.d.ts. The kit pins react-dom
// but not its DefinitelyTyped types (a new outside package needs the maintainer's OK, tests/kit-ci.test.ts), so the
// signature is declared here, as react-dom 19 defines it.
declare module 'react-dom/server' {
  import type { ReactNode } from 'react'

  export function renderToString(node: ReactNode): string
}
