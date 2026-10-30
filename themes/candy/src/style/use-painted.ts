import { useEffect, useState } from 'react'

/**
 * The values `variables` have on <html> now: the host paints the active look there, so this is the look the person
 * sees. They are read after each render whose `key` (the active look's knobs) changed, and again whenever the host
 * repaints <html> (its inline style or its class changes), since a repaint can land after this page's own effects
 * ran. Empty until the page has drawn (the server, a first render), and empty for a variable the look leaves unset.
 */

type Painted = Readonly<Record<string, string>>

const WATCHED = { attributes: true, attributeFilter: ['style', 'class'] }

function sameValues(was: Painted, now: Painted): boolean {
  const names = Object.keys(now)
  return names.length === Object.keys(was).length && names.every((name) => was[name] === now[name])
}

function readPainted(names: readonly string[]): Painted {
  const style = window.getComputedStyle(document.documentElement)
  return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]))
}

export function usePainted(variables: readonly string[], key: string): Painted {
  const [painted, setPainted] = useState<Painted>({})
  const names = variables.join(' ')
  useEffect(() => {
    const list = names.split(' ')
    const read = () => {
      const now = readPainted(list)
      setPainted((was) => (sameValues(was, now) ? was : now))
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, WATCHED)
    return () => observer.disconnect()
  }, [names, key])
  return painted
}
