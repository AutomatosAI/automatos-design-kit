/** 'bodyA' as 'body-a': a custom property's name is lower-case. Pure. */
export function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
