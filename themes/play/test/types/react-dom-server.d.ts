// The one react-dom/server function Play's tests use: rendering a screen as the host's server would, before the
// browser reads anything (the looks screens' busy frame, the phone layout's server pass). The kit pins react-dom
// but not its DefinitelyTyped types (a new outside package needs the maintainer's OK, tests/kit-ci.test.ts), so the
// signature is declared here, as react-dom 19 defines it.
declare module 'react-dom/server' {
  import type { ReactNode } from 'react'

  export function renderToString(node: ReactNode): string
}
