/// <reference types="@testing-library/jest-dom/vitest" />
// Play's own setup, run after the harness's (packages/theme-harness/src/setup.ts, which adds the jest-dom
// matchers the reference above types). Play's look code writes onto <html> (inline custom properties,
// src/lib/looks/document.ts) and tests set the host's data attributes, which Testing Library's cleanup leaves alone:
// each test gets back the <html> attributes it started with. A test file that runs in node has no document.
import { afterEach, beforeEach } from 'vitest'

type Attribute = readonly [name: string, value: string]

let rootAtStart: readonly Attribute[] = []

function attributesOf(element: Element): Attribute[] {
  return Array.from(element.attributes, (attribute): Attribute => [attribute.name, attribute.value])
}

beforeEach(() => {
  if (typeof document === 'undefined') return
  rootAtStart = attributesOf(document.documentElement)
})

afterEach(() => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  attributesOf(root).forEach(([name]) => root.removeAttribute(name))
  rootAtStart.forEach(([name, value]) => root.setAttribute(name, value))
})
