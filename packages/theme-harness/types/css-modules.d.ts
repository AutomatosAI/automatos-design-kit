// A CSS module's default export: its class names. The templates' code the harness's tests run
// (test/template-*.test.tsx) imports CSS modules, as a theme's does; vitest leaves their CSS out.
declare module '*.module.css' {
  const classes: { readonly [name: string]: string }
  export default classes
}
