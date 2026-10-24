/**
 * One step of a watch (PRD-261 B-02i), run as its own process while the watch goes on: a Node script (the harness's
 * Vite build) or an npm script (the theme's own build), with the terminal as its output. Each resolves to the exit
 * code, so the watch can print a failed step and wait for the next change.
 */
import { spawn } from 'node:child_process'

const EXIT_FAILED = 1
/** npm is npm.cmd on Windows, which Node starts only through the shell; the arguments are fixed words. */
const NPM = 'npm'
const NPM_NEEDS_SHELL = process.platform === 'win32'

export interface StepOptions {
  readonly cwd: string
  readonly env: NodeJS.ProcessEnv
}

/** Starts `command` with `args`; resolves to its exit code (1 when a signal ended it), rejects when it can't start. */
export function runStep(
  command: string, args: readonly string[], options: StepOptions & { readonly shell?: boolean },
): Promise<number> {
  return new Promise((resolve, reject) => {
    const { cwd, env } = options
    const child = spawn(command, [...args], { cwd, env, stdio: 'inherit', shell: options.shell ?? false })
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? EXIT_FAILED))
  })
}

/** A Node script with this Node, as `shots` runs its steps. */
export function runNodeScript(script: string, args: readonly string[], options: StepOptions): Promise<number> {
  return runStep(process.execPath, [script, ...args], options)
}

/** `npm run <name>` in `options.cwd`. */
export function runNpmScript(name: string, options: StepOptions): Promise<number> {
  return runStep(NPM, ['run', name], { ...options, shell: NPM_NEEDS_SHELL })
}
