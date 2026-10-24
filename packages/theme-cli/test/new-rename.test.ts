/**
 * The full template's de-branding (PRD-261 B-03f): templates/full/template.json read and checked, its renames on
 * the shapes Play's names take (its class, its variables, its file names, its components, hooks and constants, its
 * name in words), the words that only look like Play's left alone (display, autoplay, a clip's player, the verb in
 * "Play the motion"), one pass for a theme whose own name holds "play", and the guards against two names or two
 * paths merging. The renames over Play itself, built, packed and checked, are the kit's tests/template-full.test.ts.
 */
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readFullTemplate } from '../src/new/full-spec.ts'
import { FULL_TEMPLATE_DIR } from '../src/new/full.ts'
import { KIT_ROOT } from '../src/new/index.ts'
import { manifestWithoutMascot, relativeSpecifier } from '../src/new/no-mascot.ts'
import { themeNames } from '../src/new/placeholders.ts'
import { pathCollisions, renameCollisions, renamer } from '../src/new/rename.ts'

const template = readFullTemplate(join(KIT_ROOT, FULL_TEMPLATE_DIR))
const bright = renamer(template, themeNames('acme/bright'))

describe("templates/full/template.json", () => {
  it('takes from Play, and leaves the mascot out in its own way', () => {
    expect(template.from).toBe('themes/play')
    expect(template.copy).toEqual(expect.arrayContaining(['src', 'theme.json', 'package.json']))
    expect(template.copy).not.toContain('assets/previews')
    expect(template.noMascot.package).toBe('@automatos/mascot')
    expect(template.noMascot.drop).toEqual(expect.arrayContaining(['assets/mascot']))
  })
})

describe('the renames, for acme/bright', () => {
  it.each([
    ['automatos/play', 'acme/bright'],
    ['automatos.play-1.1.1.autotheme', 'acme.bright-1.1.1.autotheme'],
    ['"name": "@automatos/theme-play"', '"name": "@acme/theme-bright"'],
    ["htmlClass: 'play'", "htmlClass: 'bright'"],
    ['html.play .x, :global(html.play) .y, html.play:is(html.play)', 'html.bright .x, :global(html.bright) .y, html.bright:is(html.bright)'],
    ['var(--pl-ground-bg)', 'var(--bright-ground-bg)'],
    ["font-family: 'play-instrument-serif'", "font-family: 'bright-instrument-serif'"],
    [':not(#play-none)', ':not(#bright-none)'],
    ["import './app/play-theme.css'", "import './app/bright-theme.css'"],
    ["from '../../play/chat/labels'", "from '../../bright/chat/labels'"],
    ["from './use-play-look'", "from './use-bright-look'"],
    ['{ "id": "nav-play-looks" }', '{ "id": "nav-looks" }'],
    ['PlayFrame, usePlayLook, buildPlayNav, toPlayItem', 'BrightFrame, useBrightLook, buildBrightNav, toBrightItem'],
    ['PLAY_LOOK_SPEC, LOOKS_PLAY_ONLY_NOTE', 'BRIGHT_LOOK_SPEC, LOOKS_BRIGHT_ONLY_NOTE'],
    ['playLook, playResult', 'brightLook, brightResult'],
    ["Play's sidebar, the Play theme, Play-only", "Bright's sidebar, the Bright theme, Bright-only"],
    ['Automatos <span className={styles.wordmarkPlay}>Play</span>', 'Automatos <span className={styles.wordmarkName}>Bright</span>'],
    ["'automatos-interface-look/v1'", "'bright-look/v1'"],
    ["'automatos-play-tone'", "'bright-tone'"],
  ])('%s', (from, to) => {
    expect(bright.text(from)).toBe(to)
  })

  it.each([
    'display: grid; --pl-display-family',
    "video.play(); autoplay; autoPlay; playsInline; AUTOPLAY_BLOCKED",
    'MascotPlayer, useMascotPlayer, setPlayer, startPlayer, use-mascot-player',
    "wantsPlay, setWantsPlay, data-playing, hello-played, Playful, playbook, Playbook, displayName",
    "PLAY_STATES = \"Play Auto's states\"; PLAY_MOTION = 'Play the motion'",
  ])('leaves alone what only looks like Play: %s', (text) => {
    const renamed = bright.text(text)
    expect(renamed.replaceAll('--bright-', '--pl-')).toBe(text)
  })

  it("renames paths as the imports name them", () => {
    expect([
      'src/components/play/shell/play-frame.tsx', 'src/hooks/use-play-turn.ts', 'src/play-slots.tsx',
      'src/stores/play-chat-store.ts', 'src/hooks/use-mascot-player.ts',
    ].map(bright.text)).toEqual([
      'src/components/bright/shell/bright-frame.tsx', 'src/hooks/use-bright-turn.ts', 'src/bright-slots.tsx',
      'src/stores/bright-chat-store.ts', 'src/hooks/use-mascot-player.ts',
    ])
  })
})

describe('the renames, for other names', () => {
  it('give a name of two words each form code needs', () => {
    const owl = renamer(template, themeNames('acme/night-owl'))
    expect(owl.text('PlayFrame PLAY_TONES playLook html.play --pl-x Play')).toBe(
      'NightOwlFrame NIGHT_OWL_TONES nightOwlLook html.night-owl --night-owl-x Night Owl',
    )
  })

  it('read the text once: a name that holds "play" is not renamed again', () => {
    const replay = renamer(template, themeNames('acme/replay'))
    expect(replay.text('PlayFrame html.play play-theme.css components/play/x Play')).toBe(
      'ReplayFrame html.replay replay-theme.css components/replay/x Replay',
    )
  })
})

describe('the guards', () => {
  it('name two of Play\'s code names a rename would merge, and nothing else', () => {
    expect(renameCollisions(['PlayChat', 'BrightChat', 'PlayFrame', 'video.play()'], bright)).toEqual(['PlayChat → BrightChat'])
    expect(renameCollisions(['PlayChat', 'Bright', "'Play'"], bright)).toEqual([])
  })

  it('name two of Play\'s paths that would land on one', () => {
    expect(pathCollisions(['src/play-x.ts', 'src/bright-x.ts', 'src/y.ts'], bright)).toEqual(['src/play-x.ts, src/bright-x.ts → src/bright-x.ts'])
  })
})

describe('--mascot none', () => {
  it("points an import at the theme's own copy of the module, from wherever the file is", () => {
    expect(relativeSpecifier('src/hooks/use-auto-mascot.ts', 'src/lib/auto/events')).toBe('../lib/auto/events')
    expect(relativeSpecifier('src/lib/looks/style.ts', 'src/lib/auto/ring')).toBe('../auto/ring')
    expect(relativeSpecifier('src/lib/auto/x.ts', 'src/lib/auto/types')).toBe('./types')
  })

  it('leaves the mascot block out, and the phone draws none', () => {
    const manifest = { id: 'x/y', mascot: { states: ['idle'] }, mobile: { fromLooks: true, mascot: 'clips' } }
    expect(manifestWithoutMascot(manifest)).toEqual({ id: 'x/y', mobile: { fromLooks: true } })
  })
})
