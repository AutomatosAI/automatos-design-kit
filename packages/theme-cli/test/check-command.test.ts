/**
 * `automatos-theme check <theme folder>`: one line per check at its level, the core commit named
 * first, the verdict last; exit 1 on any error, 2 for a usage error; `--json` prints core's report
 * shape; `--rebuild` adds the reproducible build (the review job's rebuild, stood in for here; the
 * real build is check-rebuild.test.ts). Nothing is sent anywhere.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { run, type CommandDeps } from '../src/cli-main.ts'
import { CHECK_USAGE, loadRebuilder, type Rebuilder } from '../src/check/index.ts'
import { CORE_SHA, LLM_SERVER_ONLY, REPORT_SCHEMA } from '../src/check/report.ts'
import { NO_SOURCE_WARNING } from '../src/source.ts'
import { entryImporting, helloFolder, ranCheck, removeTempFolders, tempFolder } from './check-support.ts'

const ORDER = ['sizes', 'cssScope', 'looks', 'uses', 'clonedFrom', 'previews', 'jsRules', 'contrast', 'llm']
const WITH_BUILD = ['sizes', 'cssScope', 'looks', 'uses', 'clonedFrom', 'previews', 'jsRules', 'reproducibleBuild', 'contrast', 'llm']
const LINE = /^(\S+)\s+(pass|warning|error|not_measured)\s+\S/

afterEach(removeTempFolders)

/** The check lines' names and levels, in order (item lines are indented and left out). */
function checkLines(out: readonly string[]): Array<[string, string]> {
  return out.slice(1, -1).filter((line) => !line.startsWith(' ')).map((line) => {
    const match = LINE.exec(line)
    if (match === null) throw new Error(`not a check line: ${line}`)
    return [match[1], match[2]]
  })
}

function lineOf(out: readonly string[], name: string): string {
  return out.find((line) => line.startsWith(`${name} `)) ?? ''
}

/** The review job's rebuild with its build stood in: `dist` is what the rebuild of source/ gives. */
async function rebuildGiving(dist: (files: ReadonlyMap<string, Uint8Array>) => ReadonlyMap<string, Uint8Array> | string): Promise<Rebuilder> {
  const real = await loadRebuilder()
  return {
    compareDist: real.compareDist,
    rebuildDist: async (files) => {
      const built = dist(files)
      return typeof built === 'string' ? { ok: false, error: built } : { ok: true, entry: 'src/entry.ts', dist: built }
    },
  }
}

function distOf(files: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  return new Map(Array.from(files).filter(([path]) => path.startsWith('dist/')))
}

describe('the lines', () => {
  it('names the core commit, gives one line per check in order, then the verdict, and exits 0', async () => {
    const ran = await ranCheck(['check', helloFolder()])
    expect(ran.code).toBe(0)
    expect(ran.out[0]).toContain(`AutomatosAI/automatos-ai at ${CORE_SHA}`)
    expect(ran.out[0]).toContain(REPORT_SCHEMA)
    expect(checkLines(ran.out).map(([name]) => name)).toEqual(ORDER)
    expect(ran.out.at(-1)).toBe('verdict: pass (6 pass, 0 warning, 0 error, 3 not_measured)')
    expect(lineOf(ran.out, 'llm')).toMatch(new RegExp(`not_measured\\s+${LLM_SERVER_ONLY}$`))
    expect(ran.err).toEqual([`warning: ${NO_SOURCE_WARNING}`])
  })

  it('exits 1 on an error, with the error line and its reason under it', async () => {
    const ran = await ranCheck(['check', helloFolder({ entry: entryImporting('defineTheme, stealSession') })])
    expect(ran.code).toBe(1)
    expect(checkLines(ran.out)).toContainEqual(['uses', 'error'])
    const at = ran.out.indexOf(lineOf(ran.out, 'uses'))
    expect(ran.out[at + 1]).toMatch(/^ {4}The theme imports names this host's SDK doesn't export, so its code can't load: stealSession\.$/)
    expect(ran.out.at(-1)).toMatch(/^verdict: blocked \(/)
  })

  it('exits 0 on a warning', async () => {
    const ran = await ranCheck(['check', helloFolder({ manifest: { uses: ['theme', 'telepathy'] } })])
    expect(ran.code).toBe(0)
    expect(checkLines(ran.out)).toContainEqual(['uses', 'warning'])
    expect(ran.out.at(-1)).toMatch(/^verdict: review_required \(/)
  })

  it("refuses a theme core's reader would refuse, with every reason, and runs no check", async () => {
    const ran = await ranCheck(['check', helloFolder({ manifest: { slots: ['frame@1', 'styleSheet@1'] } })])
    expect(ran.code).toBe(1)
    expect(ran.out).toEqual([])
    expect(ran.err[0]).toMatch(/can't be checked: the Automatos server would refuse it\.$/)
    expect(ran.err.slice(1).every((line) => line.startsWith('  '))).toBe(true)
    expect(ran.err.length).toBeGreaterThan(1)
  })
})

describe('--json', () => {
  it("prints core's report shape, naming the commit", async () => {
    const ran = await ranCheck(['check', helloFolder(), '--json'])
    expect(ran.code).toBe(0)
    const printed = JSON.parse(ran.out.join('\n')) as Record<string, unknown>
    expect(Object.keys(printed)).toEqual(['schema', 'stage', 'verdict', 'summary', 'checks', 'core'])
    expect(printed).toMatchObject({ schema: REPORT_SCHEMA, stage: 'C-02a', verdict: 'pass', core: { repo: 'AutomatosAI/automatos-ai', sha: CORE_SHA } })
    expect(Object.keys(printed.checks as object)).toEqual(ORDER)
  })
})

describe('--rebuild', () => {
  it('adds the reproducible build, a pass when the rebuild gives the same dist/', async () => {
    const ran = await ranCheck(['check', helloFolder(), '--rebuild'], () => rebuildGiving(distOf))
    expect(checkLines(ran.out)).toEqual(WITH_BUILD.map((name) => [name, name === 'reproducibleBuild' ? 'pass' : expect.any(String)]))
    expect(ran.code).toBe(0)
  })

  it('is an error listing each file that differs', async () => {
    const changed = (files: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> => (
      new Map([...distOf(files), ['dist/entry.js', new TextEncoder().encode('// rebuilt otherwise\n')]])
    )
    const ran = await ranCheck(['check', helloFolder(), '--rebuild'], () => rebuildGiving(changed))
    expect(ran.code).toBe(1)
    expect(checkLines(ran.out)).toContainEqual(['reproducibleBuild', 'error'])
    expect(ran.out).toContain('    differs: dist/entry.js')
  })

  it('is an error with the build failure when source/ does not build', async () => {
    const ran = await ranCheck(['check', helloFolder(), '--rebuild'], () => rebuildGiving(() => 'source/ has no entry module.'))
    expect(ran.code).toBe(1)
    expect(lineOf(ran.out, 'reproducibleBuild')).toMatch(/error\s+source\/ has no entry module\.$/)
  })

  it('is left out, and nothing is built, without --rebuild', async () => {
    let loaded = 0
    const ran = await ranCheck(['check', helloFolder()], async () => {
      loaded += 1
      return rebuildGiving(distOf)
    })
    expect(loaded).toBe(0)
    expect(checkLines(ran.out).map(([name]) => name)).toEqual(ORDER)
  })
})

describe('usage', () => {
  it.each([[['check']], [['check', 'a', 'b']], [['check', '.', '--fast']], [['check', '.', '--rebuild=yes']]])('%j: the usage, exit 2', async (argv) => {
    const ran = await ranCheck(argv)
    expect([ran.code, ran.err, ran.out]).toEqual([2, [CHECK_USAGE], []])
  })

  it('a path that is not a folder: exit 2, nothing checked', async () => {
    const ran = await ranCheck(['check', `${tempFolder()}/missing`])
    expect(ran.code).toBe(2)
    expect(ran.err[0]).toMatch(/is not a folder: check takes a built theme folder\.$/)
    expect(ran.out).toEqual([])
  })
})

describe('through the command table', () => {
  it('runs check from its module and sends nothing', async () => {
    const out: string[] = []
    const sent: unknown[] = []
    const deps: CommandDeps = {
      env: {},
      fetch: (async (...args: unknown[]) => {
        sent.push(args)
        throw new Error('check sends nothing')
      }) as typeof fetch,
      cwd: process.cwd(),
    }
    const code = await run(['check', helloFolder()], { out: (line) => out.push(line), err: () => undefined }, deps)
    expect(code).toBe(0)
    expect(out[0]).toContain(CORE_SHA)
    expect(sent).toEqual([])
  })
})
