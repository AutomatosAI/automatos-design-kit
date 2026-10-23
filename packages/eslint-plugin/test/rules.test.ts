/**
 * RuleTester, one run per rule: the valid line of its case reports nothing, and the invalid line reports
 * that code once, on its own line (the second of the file) from its first column, with the review's
 * message as the report's text.
 */
import { resolve } from 'node:path'
import { RuleTester } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../src/index.ts'
import { MESSAGE_ID, SETTINGS_KEY } from '../src/rules.ts'
import { textParser } from '../src/text-parser.ts'
import { CASES, type RuleCase } from './rule-cases.ts'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

/** A theme folder that need not exist: the rules read only the text they are given. */
const SOURCE_ROOT = resolve('/theme/src')
const ENTRY = 'entry.ts'
const PLAIN_LINE = 'const ready = true'
const FINDING_LINE = 2

const tester = new RuleTester({
  languageOptions: { parser: textParser },
  settings: { [SETTINGS_KEY]: { sourceRoot: SOURCE_ROOT } },
})

function testsOf(item: RuleCase): { valid: RuleTester.ValidTestCase[]; invalid: RuleTester.InvalidTestCase[] } {
  const filename = resolve(SOURCE_ROOT, item.file ?? ENTRY)
  return {
    valid: [{ code: `${PLAIN_LINE}\n${item.valid}`, filename }],
    invalid: [{
      code: `${PLAIN_LINE}\n${item.invalid}`,
      filename,
      errors: [{ messageId: MESSAGE_ID, line: FINDING_LINE, column: 1, endLine: FINDING_LINE }],
    }],
  }
}

describe('the cases', () => {
  it('give every rule a valid and an invalid case, and name no code without a rule', () => {
    expect(Object.keys(CASES).sort()).toEqual(Object.keys(plugin.rules).sort())
  })
})

describe('each rule', () => {
  Object.entries(plugin.rules).forEach(([code, rule]) => {
    const item = CASES[code]
    if (item !== undefined) tester.run(code, rule, testsOf(item))
  })
})
