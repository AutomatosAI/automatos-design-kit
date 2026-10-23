/**
 * The command table (PRD-261 B-03b): every planned command is named, each with its own module and the
 * story that builds it. A command whose module isn't written yet exits 2 naming that story and sends
 * nothing; once its module is there, the command runs the function the module exports.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COMMANDS, moduleRunner, run, USAGE, type CommandDeps, type CommandRunner, type PlannedCommand } from '../src/cli-main.ts'

const SRC = new URL('../src/', import.meta.url)
const PLANNED = ['pack', 'submit', 'check', 'install', 'new', 'clone', 'brief', 'shots', 'previews', 'dev']
const STORY = /^PRD-261 [A-C]-\d{2}[a-z0-9]*$/
const RUNNER_EXIT = 7

interface Ran {
  readonly code: number
  readonly out: readonly string[]
  readonly err: readonly string[]
  readonly sent: number
}

function moduleThere(command: PlannedCommand): boolean {
  return existsSync(fileURLToPath(new URL(command.module, SRC)))
}

/** run() with a fetch that counts what would have been sent; `commands` defaults to the real table. */
async function ran(argv: readonly string[], commands?: readonly PlannedCommand[]): Promise<Ran> {
  const out: string[] = []
  const err: string[] = []
  const calls: unknown[] = []
  const fetchStub = (async (...args: unknown[]) => {
    calls.push(args)
    throw new Error('this test sends nothing')
  }) as typeof fetch
  const deps: CommandDeps = { env: {}, fetch: fetchStub, cwd: process.cwd() }
  const code = await run(argv, { out: (line) => out.push(line), err: (line) => err.push(line) }, deps, commands)
  return { code, out, err, sent: calls.length }
}

describe('the command table', () => {
  it('names every planned command, in order, each with its own module and story', () => {
    expect(COMMANDS.map((command) => command.name)).toEqual(PLANNED)
    expect(new Set(COMMANDS.map((command) => command.module)).size).toBe(COMMANDS.length)
    COMMANDS.forEach((command) => expect(command.story, command.name).toMatch(STORY))
  })

  it('lists every command in the usage', () => {
    expect(USAGE).toContain(`commands: ${PLANNED.join(', ')}`)
  })

  it('pack and submit are built: their modules are there', () => {
    const built = COMMANDS.filter((command) => command.name === 'pack' || command.name === 'submit')
    expect(built.map(moduleThere)).toEqual([true, true])
  })

  it('a command whose module is not written yet exits 2 naming its story, and sends nothing', async () => {
    const unbuilt = COMMANDS.filter((command) => !moduleThere(command))
    for (const command of unbuilt) {
      const result = await ran([command.name, 'themes/play'])
      expect(result.code, command.name).toBe(2)
      expect(result.err, command.name).toEqual([`automatos-theme ${command.name}: not built yet (${command.story}).`])
      expect(result.out, command.name).toEqual([])
      expect(result.sent, command.name).toBe(0)
    }
  })

  it.each([[[]], [['build']], [['--help']], [['Pack', 'x']]])('%j names no command: the usage, exit 2', async (argv) => {
    const result = await ran(argv)
    expect(result.code).toBe(2)
    expect(result.err).toEqual([USAGE])
    expect(result.sent).toBe(0)
  })
})

describe('a command runs through its row', () => {
  it('gets the whole argument list and the deps, and its exit code is the exit code', async () => {
    const seen: unknown[] = []
    const runner: CommandRunner = (argv, _output, deps) => {
      seen.push([...argv], deps.cwd)
      return RUNNER_EXIT
    }
    const table: PlannedCommand[] = [{ name: 'echo', module: './echo.ts', story: 'PRD-261 B-03b', load: async () => runner }]
    const result = await ran(['echo', 'a', '--b'], table)
    expect(result.code).toBe(RUNNER_EXIT)
    expect(seen).toEqual([['echo', 'a', '--b'], process.cwd()])
  })

  it('loads the runner a module exports once the module is there', async () => {
    const runner = await moduleRunner('./submit.ts', 'submitCommand')()
    expect(typeof runner).toBe('function')
    expect(runner?.name).toBe('submitCommand')
  })

  it('finds no runner while the module is not there', async () => {
    await expect(moduleRunner('./not-written-yet.ts', 'notWrittenCommand')()).resolves.toBeNull()
  })

  it('refuses a module without the runner its row names, with one sentence', async () => {
    await expect(moduleRunner('./submit.ts', 'missingCommand')()).rejects.toThrow('./submit.ts does not export the runner missingCommand.')
  })
})
