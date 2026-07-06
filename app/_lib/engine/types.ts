/**
 * Shared types for the version-agnostic engine layer.
 *
 * The docs can run either url-ast release line: `^v4` (Rust/WASM, async init) or
 * `^v3` (legacy pure-TypeScript, sync). These types describe the small surface the
 * documentation components depend on, so neither the components nor the engine
 * facade branch on which version is loaded.
 */

export type EngineVersion = 'v3' | 'v4'

/** Parse-time error shape, identical across both release lines. */
export interface EngineError {
  code: string
  message: string
  start: number
  end: number
}

/** The subset of an `Analyze` instance the docs touch (both versions expose it). */
export interface AnalyzeLike {
  ast: { toJSON: (labeled?: boolean) => unknown }
  hasErrors: () => boolean
  errors: EngineError[]
  getParams: () => unknown
  getSearchParams: () => unknown
  [key: string]: unknown
}

export interface AnalyzeConstructor {
  new (input: string, base?: unknown): AnalyzeLike
}

/** The three classes the interactive playground injects into evaluated code. */
export interface RuntimeClasses {
  Analyze: AnalyzeConstructor
  AST: unknown
  ErrorLog: unknown
}

/** Raw module shape loaded from a url-ast version. */
export interface EngineModule extends RuntimeClasses {
  /** Present only on the `^v4` browser entry: async WASM initialization. */
  initWasm?: (input?: unknown) => Promise<unknown>
}
