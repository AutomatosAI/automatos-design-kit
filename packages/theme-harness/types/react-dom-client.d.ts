// The one react-dom/client function the harness app uses: mounting the mock host into the page (app/main.tsx).
// The kit pins react-dom but not its DefinitelyTyped types (a new outside package needs the maintainer's OK,
// tests/kit-ci.test.ts), so the signature is declared here, as react-dom 19 defines it.
declare module 'react-dom/client' {
  import type { ReactNode } from 'react'

  export interface Root {
    render(children: ReactNode): void
    unmount(): void
  }

  export function createRoot(container: Element | DocumentFragment): Root
}
