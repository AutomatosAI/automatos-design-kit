// Theme voice (SDK 1.2.0): the voice stand-ins held to the vendored packages/theme-sdk/areas/voice.d.ts beyond what tsc
// checks (test/types.test.ts holds every name's type, test/surface.test.ts the names): the phases, the button's modes,
// presses and sizes are the declared unions, each taken and anything else refused; useVoice's snapshot has exactly the
// declared fields; and the button's root carries every data attribute, and its press every custom property, the
// declarations tell a theme to style it by. A static read of the declarations.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { useVoice, VoiceButton, type HostVoiceState, type VoiceButtonProps } from '@automatos/theme-sdk'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '../src/host.ts'
import { checkedVoiceButtonProps } from '../src/sdk/voice-button.tsx'
import { pressStyle, STATE_WORDS, VOICE_BUTTON_CSS_VARS } from '../src/sdk/voice-button-styles.ts'

const SDK_ROOT = dirname(createRequire(import.meta.url).resolve('@automatos/theme-sdk/package.json'))
const DECLARED = readFileSync(join(SDK_ROOT, 'areas', 'voice.d.ts'), 'utf8')
const QUOTED = /'([a-z]+)'/g
const DATA_ATTRIBUTE = /`(data-voice-[a-z]+)`/g
const CUSTOM_PROPERTY = /`(--voice-button-[a-z-]+)`/g
const FIELD = /^\s+readonly (\w+)/gm

/** The quoted members of one declared union type, in its order. */
function union(name: string): string[] {
  const line = DECLARED.split('\n').find((text) => text.startsWith(`export type ${name} =`)) ?? ''
  return Array.from(line.matchAll(QUOTED), (match) => match[1])
}

/** The fields of one declared interface, in its order. */
function fields(name: string): string[] {
  const start = DECLARED.indexOf(`export interface ${name} {`)
  const body = start < 0 ? '' : DECLARED.slice(start, DECLARED.indexOf('\n}', start))
  return Array.from(body.matchAll(FIELD), (match) => match[1])
}

const unique = (pattern: RegExp): string[] => Array.from(new Set(Array.from(DECLARED.matchAll(pattern), (match) => match[1])))

let snapshot: HostVoiceState | null = null

function Reader() {
  snapshot = useVoice()
  return null
}

beforeEach(() => {
  host.reset()
  snapshot = null
})

describe('the declarations, as this test reads them', () => {
  it('declare the unions, the state and the styling hooks', () => {
    expect(union('HostVoicePhase')).toEqual(['idle', 'connecting', 'listening', 'thinking', 'speaking', 'ended', 'error'])
    expect(union('VoiceButtonSize')).toEqual(['sm', 'md', 'lg'])
    expect(fields('HostVoiceState')).toContain('stop')
    expect(unique(DATA_ATTRIBUTE).length).toBeGreaterThan(0)
    expect(unique(CUSTOM_PROPERTY).length).toBeGreaterThan(0)
  })
})

describe('the voice stand-ins', () => {
  it('say a word for every declared phase, and no other', () => {
    expect(Object.keys(STATE_WORDS)).toEqual(union('HostVoicePhase'))
  })

  it.each([['mode', 'VoiceButtonMode'], ['press', 'VoiceButtonPress'], ['size', 'VoiceButtonSize']])(
    "take every declared %s and refuse anything else",
    (prop, type) => {
      const declared = union(type)
      expect(declared.length).toBeGreaterThan(1)
      declared.forEach((value) => expect(checkedVoiceButtonProps({ [prop]: value } as unknown as VoiceButtonProps)).toMatchObject({ [prop]: value }))
      expect(() => checkedVoiceButtonProps({ [prop]: 'other' } as unknown as VoiceButtonProps)).toThrow(`one of ${declared.join(', ')}`)
    },
  )

  it("answer useVoice with exactly HostVoiceState's fields, and the availability's", () => {
    render(<Reader />)
    expect(Object.keys(snapshot ?? {})).toEqual(fields('HostVoiceState'))
    expect(Object.keys(snapshot?.available ?? {})).toEqual(fields('HostVoiceAvailability'))
  })

  it('carry on the root every data attribute the declarations name, and take every custom property they name', () => {
    const { container } = render(<VoiceButton />)
    const root = container.querySelector('[data-voice-button="root"]')
    expect(unique(DATA_ATTRIBUTE).filter((name) => name !== 'data-voice-button' && !root?.hasAttribute(name))).toEqual([])
    expect([...VOICE_BUTTON_CSS_VARS].sort()).toEqual(unique(CUSTOM_PROPERTY).sort())
    const styled = JSON.stringify([pressStyle('md', false, false), pressStyle('md', true, false)])
    expect(VOICE_BUTTON_CSS_VARS.filter((name) => !styled.includes(`var(${name},`))).toEqual([])
  })
})
