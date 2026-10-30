/// <reference types="@testing-library/jest-dom/vitest" />
// Candy's own setup, after Arcade's (themes/arcade/test/setup.ts), itself after HUD's, run after the harness's: each test gets back
// the <html> attributes it started with, and every spy is put back. A test file that runs in node has no document.
import { afterEach, beforeEach, vi } from 'vitest'

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
  vi.restoreAllMocks()
  if (typeof document === 'undefined') return
  const root = document.documentElement
  attributesOf(root).forEach(([name]) => root.removeAttribute(name))
  rootAtStart.forEach(([name, value]) => root.setAttribute(name, value))
})
