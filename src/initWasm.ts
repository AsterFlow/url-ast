import __wbg_init from 'wasm/wasm'
import { isWasmAvailable, setWasmAvailable } from './wasmState'

export { isWasmAvailable }

/** Accepted sources for {@link initWasm}. */
export type WasmInput =
  | string
  | URL
  | Request
  | Response
  | BufferSource
  | WebAssembly.Module

/**
 * Asynchronously initialises the Rust/WASM engine for environments without
 * synchronous filesystem access (browsers, edge runtimes).
 *
 * Pass the location or bytes of `wasm_bg.wasm`:
 * - a URL/string the runtime can `fetch` (e.g. a bundler `?url` import),
 * - a `Response`/`BufferSource`, or a pre-compiled `WebAssembly.Module`.
 *
 * With no argument it defaults to `new URL('wasm_bg.wasm', import.meta.url)`,
 * which works when the binary is served next to the bundle.
 *
 * Must be awaited before using `Analyze`, `AST`, `parse` or `parseAndAnalyze`.
 * Safe to call repeatedly — subsequent calls resolve immediately.
 *
 * @example
 * ```ts
 * import { initWasm, Analyze } from 'url-ast/browser'
 * import wasmUrl from 'url-ast/wasm/wasm_bg.wasm?url'
 *
 * await initWasm(wasmUrl)
 * new Analyze('/users/:id.number')
 * ```
 */
export async function initWasm(input?: WasmInput): Promise<boolean> {
  if (isWasmAvailable) return true
  await __wbg_init(input === undefined ? undefined : { module_or_path: input })
  setWasmAvailable(true)
  return true
}
