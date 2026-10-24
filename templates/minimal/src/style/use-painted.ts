import { useEffect, useState } from 'react'

/**
 * The values `variables` have on <html> now, read again whenever `key` changes (the active look's choices): the
 * host paints a look there, so this is the look the person sees. Empty until the page has drawn (the server, a
 * first render) and for a variable the look leaves unset.
 */
export function usePainted(variables: readonly string[], key: string): Readonly<Record<string, string>> {
  const [painted, setPainted] = useState<Readonly<Record<string, string>>>({})
  const names = variables.join(' ')
  useEffect(() => {
    const style = window.getComputedStyle(document.documentElement)
    setPainted(Object.fromEntries(names.split(' ').map((name) => [name, style.getPropertyValue(name).trim()])))
  }, [names, key])
  return painted
}
