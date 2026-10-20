/**
 * Where the command line writes, and the wrapper that keeps a secret out of it.
 */

export interface Output {
  readonly out: (line: string) => void
  readonly err: (line: string) => void
}

/** What a secret is printed as, wherever it would have appeared. */
export const SECRET_MASK = '[AUTOMATOS_API_TOKEN]'

/** `output` with every occurrence of `secret` replaced by SECRET_MASK; `output` itself when there is none. */
export function redacting(output: Output, secret: string | null): Output {
  if (secret === null || secret === '') return output
  const scrub = (line: string): string => line.split(secret).join(SECRET_MASK)
  return {
    out: (line) => output.out(scrub(line)),
    err: (line) => output.err(scrub(line)),
  }
}
