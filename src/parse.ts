import { AST } from './controllers/AST'
import { Analyze } from './controllers/Analyze'
import type { AnalyzeChain, AnalyzeInstance } from './types/analyze'

/**
 * Parses a URL/template into an {@link AST} (parsing runs in Rust/WASM).
 *
 * @example
 * ```ts
 * import { parse } from 'url-ast'
 * const ast = parse('/users/[id]')
 * ```
 */
export function parse<const Path extends string>(input: Path): AST<Path> {
  return new AST(input)
}

/**
 * Parses and prepares analysis of a URL/template, returning an {@link Analyze}
 * instance backed by the Rust/WASM engine. Pass a `base` template to extract and
 * cast values from a concrete URL.
 *
 * @example
 * ```ts
 * import { parseAndAnalyze } from 'url-ast'
 * const template = parseAndAnalyze('/users/:id.number')
 * const parsed = parseAndAnalyze('/users/42', template)
 * parsed.getParams() // { id: 42 }
 * ```
 */
export function parseAndAnalyze<const Path extends string>(input: Path): AnalyzeInstance<Path, undefined>
export function parseAndAnalyze<const Path extends string, const Base extends AnalyzeChain>(
  input: Path,
  base: Base
): AnalyzeInstance<Path, Base>
export function parseAndAnalyze(
  input: string,
  base?: AnalyzeChain
): AnalyzeInstance<string, AnalyzeChain | undefined> {
  return base ? Analyze.create(input, base) : Analyze.create(input)
}
