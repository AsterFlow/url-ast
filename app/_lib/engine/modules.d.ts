/**
 * Ambient declarations for the two url-ast release lines the docs load at runtime.
 *
 * `url-ast` resolves to the `^v4` line (Rust/WASM). Its `/browser` subpath is the
 * async-init entry used in the browser; `url-ast-v3` is the legacy `^v3` line
 * installed under an npm alias. Kept loose on purpose — the engine facade adds the
 * real typing, and these only need to resolve so `import()` type-checks.
 */

declare module 'url-ast/browser' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Analyze: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const AST: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const ErrorLog: any
  export function initWasm(input?: unknown): Promise<unknown>
}

declare module 'url-ast-v3' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Analyze: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const AST: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const ErrorLog: any
}
