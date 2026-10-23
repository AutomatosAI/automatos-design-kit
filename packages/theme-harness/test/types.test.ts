// @vitest-environment node
// PRD-261 B-02b: the fake SDK is typed as the vendored SDK types it. tsc (the harness's typecheck) holds the
// lines below: every vendored value name is in the fake with a type assignable to the SDK's, and the fake has
// no name the SDK lacks. Each area module also declares each fake `satisfies` its SDK name, so a change to a
// vendored signature fails tsc at the fake that no longer matches. At run time this test only confirms what
// tsc checked is the module the tests get.
import { describe, expect, it } from 'vitest'
import * as fake from '../src/sdk/index.ts'

type Sdk = typeof import('@automatos/theme-sdk')
type Fake = typeof fake

/** Every SDK name, each typed as the SDK types it: a missing name or a drifted type fails tsc here. */
const asTheSdk: Sdk = fake
/** A fake name the SDK lacks makes this `false`, and the assignment below fails tsc. */
type NoExtraNames = [Exclude<keyof Fake, keyof Sdk>] extends [never] ? true : false
const noExtraNames: NoExtraNames = true
/** Each name one by one: the fake's value satisfies typeof import('@automatos/theme-sdk')[name]. */
const eachName: { readonly [K in keyof Sdk]: Sdk[K] } = { ...fake }

describe("the fake SDK's types", () => {
  it('are the vendored SDK types (checked by tsc), on the module the tests import', () => {
    expect(noExtraNames).toBe(true)
    expect(asTheSdk).toBe(fake)
    expect(Object.keys(eachName).sort()).toEqual(Object.keys(fake).sort())
  })
})
