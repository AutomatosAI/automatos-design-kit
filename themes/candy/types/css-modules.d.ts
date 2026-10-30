// A CSS module's default export: its class names, as the build renames them (candy-<local>-<hash>).
declare module '*.module.css' {
  const classes: { readonly [name: string]: string }
  export default classes
}
