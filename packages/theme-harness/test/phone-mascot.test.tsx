// Auto on the phone view's First open, from the theme's mobile block (made-up data), as the app's media.ts picks his
// file on an iPhone: under `clips` his clip plays, with his still as its poster; under reduced motion (the setting, or
// the switch) and under `stills` his still shows; under `none`, and for a theme that brings no Auto, nothing is drawn
// (Studio shows none); a state with no still of the theme's keeps the app's own Auto, which the harness stands in for.
// A URL is given only for a file the theme holds, on the harness's files root.
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '../src/host.ts'
import { mascotShown } from '../src/phone/mascot.ts'
import { renderPhone, servedTheme, skinManifest, type Json } from './phone-support.tsx'

const PAPER = { '--background': '0 0% 100%', '--foreground': '210 16.67% 9.41%' }
const CLIP = 'assets/mascot/hello.mp4'
const STILL = 'assets/mascot/hello.png'
const BOTH = [CLIP, STILL]

function theme(mode: string | null) {
  const block: Json = mode === null ? { tokens: { light: PAPER } } : { tokens: { light: PAPER }, mascot: mode }
  return servedTheme({ manifest: skinManifest(block, { mascot: { states: ['hello', 'idle'] } }), presets: [], prepaint: null })
}

const shown = (): string | null => document.querySelector('[data-go-mascot]')?.getAttribute('data-go-mascot') ?? null
const videoSource = (): string | null => document.querySelector('[data-go-mascot] video')?.getAttribute('src') ?? null
const imageSource = (): string | null => document.querySelector('[data-go-mascot] img')?.getAttribute('src') ?? null

beforeEach(() => {
  host.reset()
})

describe("Auto on First open", () => {
  it('plays his clip under clips, his still its poster', () => {
    renderPhone(theme('clips'), BOTH, { screen: 'first-open' })
    expect([shown(), videoSource()]).toEqual(['clip', `/${CLIP}`])
    expect(document.querySelector('[data-go-mascot] video')).toHaveAttribute('poster', `/${STILL}`)
    expect(screen.getByRole('img', { name: 'Auto, saying hello' })).toBeInTheDocument()
  })

  it('shows his still under reduced motion, from the setting or the switch', () => {
    renderPhone(theme('clips'), BOTH, { screen: 'first-open', reducedMotion: true })
    expect([shown(), imageSource(), videoSource()]).toEqual(['still', `/${STILL}`, null])
    fireEvent.click(screen.getByLabelText('Reduced motion'))
    expect([shown(), videoSource()]).toEqual(['clip', `/${CLIP}`])
    fireEvent.click(screen.getByLabelText('Reduced motion'))
    expect([shown(), imageSource()]).toEqual(['still', `/${STILL}`])
  })

  it('shows his still under stills, motion or not', () => {
    renderPhone(theme('stills'), BOTH, { screen: 'first-open' })
    expect([shown(), imageSource(), videoSource()]).toEqual(['still', `/${STILL}`, null])
  })

  it('draws nothing under none, nor for a theme that brings no Auto', () => {
    const { unmount } = renderPhone(theme('none'), BOTH, { screen: 'first-open' })
    expect(shown()).toBeNull()
    unmount()
    renderPhone(theme(null), BOTH, { screen: 'first-open' })
    expect(shown()).toBeNull()
  })

  it("keeps the app's own Auto for a state the theme has no still for", () => {
    renderPhone(theme('clips'), [CLIP], { screen: 'first-open' })
    expect(shown()).toBe('bundled')
  })
})

describe('the file shown for a state', () => {
  const mascot = { mode: 'clips' as const, states: [{ name: 'hello', clip: '/c.mp4', still: '/s.png' }] }

  it("is media.ts's choice on an iPhone", () => {
    expect([mascotShown(mascot, 'hello', false), mascotShown(mascot, 'hello', true)]).toEqual([
      { kind: 'clip', clip: '/c.mp4', still: '/s.png' }, { kind: 'still', still: '/s.png' },
    ])
    expect([mascotShown(mascot, 'idle', false), mascotShown(null, 'hello', false)]).toEqual([{ kind: 'bundled' }, { kind: 'none' }])
  })
})
