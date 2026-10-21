/**
 * PRD-261 B-02a: the harness's setup, run before every test file (vitest-preset.ts names it first).
 *
 * The harness leaves vitest's globals off, so Testing Library cannot register its own hooks: this file
 * does what it does with them. React's act environment flag is on for the whole file, so an update
 * outside act() warns, as under Testing Library's own hooks; whatever a test rendered is unmounted after it;
 * and the jest-dom matchers (toBeInTheDocument, toHaveAttribute, ...) are added to expect. A file that
 * runs in node gets the same hooks, which then have nothing to do.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'

/** The global React reads to know it runs under a test's act(). */
export const ACT_ENVIRONMENT_FLAG = 'IS_REACT_ACT_ENVIRONMENT'

let previousActEnvironment: unknown

beforeAll(() => {
  previousActEnvironment = Reflect.get(globalThis, ACT_ENVIRONMENT_FLAG)
  Reflect.set(globalThis, ACT_ENVIRONMENT_FLAG, true)
})

afterAll(() => {
  Reflect.set(globalThis, ACT_ENVIRONMENT_FLAG, previousActEnvironment)
})

afterEach(() => {
  cleanup()
})
