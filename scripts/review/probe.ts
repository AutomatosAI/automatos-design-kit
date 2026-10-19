/**
 * Proof that the review runs with no network: a fetch to an outside host and one to the npm
 * registry must both fail. The workflow runs the review in `docker run --network none`; when a
 * fetch gets through anyway, the review stops before it reads the package.
 */

export const PROBE_URLS: readonly string[] = ['https://example.com/', 'https://registry.npmjs.org/']
const PROBE_TIMEOUT_MS = 5_000

export interface ProbeResult {
  /** True when no probe reached its host. */
  readonly isolated: boolean
  /** One plain line per probe: what happened. */
  readonly lines: readonly string[]
}

export type Fetcher = (url: string, init: { signal: AbortSignal }) => Promise<unknown>

async function probeOne(url: string, fetcher: Fetcher): Promise<{ reached: boolean; line: string }> {
  try {
    await fetcher(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    return { reached: true, line: `${url}: reached (the job has network access)` }
  } catch (error) {
    const cause = (error as { cause?: { code?: unknown } }).cause?.code
    const why = typeof cause === 'string' ? cause : error instanceof Error ? error.name : 'failed'
    return { reached: false, line: `${url}: failed (${why})` }
  }
}

/** Tries every probe URL; isolated only when none was reached. */
export async function probeNetwork(fetcher: Fetcher = (url, init) => fetch(url, init)): Promise<ProbeResult> {
  const results = await Promise.all(PROBE_URLS.map((url) => probeOne(url, fetcher)))
  return { isolated: results.every((result) => !result.reached), lines: results.map((result) => result.line) }
}
