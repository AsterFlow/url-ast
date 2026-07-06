/**
 * Browser / edge entry point.
 *
 * Unlike the default (Node) entry, this build does **not** import `node:fs` and
 * does not auto-initialise the engine. Call `initWasm()` and await it once before
 * using `Analyze`, `AST`, `parse` or `parseAndAnalyze`.
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
export { initWasm, type WasmInput } from './initWasm'
export { isWasmAvailable } from './wasmState'

export { parse, parseAndAnalyze } from './parse'

export * from './controllers/AST'
export * from './controllers/Node'
export * from './controllers/Error'
export * from './controllers/Analyze'

export * from './types/ast'
export * from './types/node'
export * from './types/parser'
export * from './types/analyze'
