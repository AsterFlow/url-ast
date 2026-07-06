import type {
  AnalyzeChain,
  AnalyzeConstructor,
  AnalyzeFragmentResult,
  AnalyzeInstance,
  AnalyzeNewOptions,
  AnalyzeParamsResult,
  AnalyzeSearchParamsResult,
} from '../types/analyze'
import {
  analyzeFragmentInstanceWasm,
  analyzeFragmentWasm,
  analyzeHostnameWasm,
  analyzeParamsInstanceWasm,
  analyzeParamsTemplateWasm,
  analyzePathnameWasm,
  analyzePortWasm,
  analyzeProtocolWasm,
  analyzeSearchInstanceWasm,
  analyzeSearchTemplateWasm,
  analyzeStaticPropsWasm,
} from '../wasmBridge'
import { toView } from '../utils/binary'
import { AST } from './AST'
import { ErrorLog } from './Error'

/**
 * Parses and analyzes a URL template or real URL, extracting parameters, variables,
 * path segments, search params, fragment, and origin components (protocol, hostname, port).
 *
 * This class is a thin abstraction over the Rust/WASM engine: parsing and all
 * analysis run in WASM (`src/wasmBridge.ts` shared-memory bridge); the class only
 * marshals results into the JavaScript shapes (Map / Record / array) and rethrows
 * casting errors with the original formatted message.
 *
 * @example
 * ```ts
 * import { Analyze } from 'url-ast'
 *
 * const template = new Analyze('http://example.com/users/:id.number?active.boolean')
 * console.log(template.getPathname())     // '/users/:id'
 * console.log(template.getParams())       // ['id']
 *
 * const parsed = new Analyze('http://example.com/users/42?active=true', template)
 * console.log(parsed.getParams())         // { id: 42 }
 * console.log(parsed.getSearchParams())   // { active: true }
 * ```
 */
const AnalyzeImpl = class Analyze {
  readonly input: string
  readonly errors: ErrorLog[]
  readonly ast: AST<string>
  base?: AnalyzeChain

  constructor(input: string, options?: AnalyzeChain | AnalyzeNewOptions<string>) {
    this.input = input
    if (options instanceof Analyze) {
      this.base = options
      this.ast = new AST(this.input)
    } else if (options && typeof options === 'object') {
      const o = options as AnalyzeNewOptions<string>
      this.base = o.base
      this.ast = o.ast ?? new AST(this.input)
    } else {
      this.ast = new AST(this.input)
    }
    this.errors = this.ast.errors
  }

  getParams(): AnalyzeParamsResult {
    if (this.base) {
      const result = analyzeParamsInstanceWasm(this.base.input, this.input)
      if (!result.ok) throw new Error(this.formatErrors([result.error]))
      const params: Record<string, string | number | boolean | string[]> = {}
      for (const [key, value] of result.entries) params[key] = value
      return params
    }

    const { names, errors } = analyzeParamsTemplateWasm(this.input)
    for (const error of errors) this.errors.push(error)
    return names
  }

  getSearchParams(): AnalyzeSearchParamsResult {
    if (this.base) {
      const result = analyzeSearchInstanceWasm(this.base.input, this.input)
      if (!result.ok) throw new Error(this.formatErrors([result.error]))
      const params: Record<string, string | number | boolean | string[]> = {}
      for (const [key, value] of result.entries) params[key] = value
      return params
    }

    const { entries, errors } = analyzeSearchTemplateWasm(this.input)
    for (const error of errors) this.errors.push(error)
    const map = new Map<string, string | string[]>()
    for (const [key, value] of entries) map.set(key, value)
    return map
  }

  getFragment(): AnalyzeFragmentResult {
    if (this.base) {
      const entries = analyzeFragmentInstanceWasm(this.base.input, this.input)
      const output: Record<string, string> = {}
      for (const [key, value] of entries) output[key] = value
      return output
    }

    return analyzeFragmentWasm(this.input)
  }

  getStaticProps(): Record<string, string | string[]> {
    if (!this.base) return {}

    const entries = analyzeStaticPropsWasm(this.base.input, this.input)
    const props: Record<string, string | string[]> = {}
    for (const [key, value] of entries) props[key] = value
    return props
  }

  getPathname(): string {
    return analyzePathnameWasm(this.input)
  }

  getPort(): string | undefined {
    return analyzePortWasm(this.input)
  }

  getHostname(): string | undefined {
    return analyzeHostnameWasm(this.input)
  }

  getProtocol(): string | undefined {
    return analyzeProtocolWasm(this.input)
  }

  setParser<S extends AnalyzeChain>(base: S): AnalyzeInstance<string, S> {
    this.base = base
    return this as unknown as AnalyzeInstance<string, S>
  }

  hasErrors(errors: ErrorLog[] = this.errors): boolean {
    return errors.length > 0
  }

  formatErrors(errors: ErrorLog[] = this.errors): string {
    if (!this.hasErrors(errors)) return 'No errors found.'
    return errors.map(e => e.toString(this.input)).join('\n\n')
  }

  /**
   * Serializes the Analyze instance (its AST and optional base) into a binary Buffer.
   *
   * Layout: `u32 astLength`, AST data, `u8 hasBase`, then optional `u32 baseLength` + base data.
   */
  getBuffer(): Uint8Array {
    const astBuffer = this.ast.getBuffer()
    const baseBuffer = this.base?.getBuffer()

    const baseLength = baseBuffer?.length ?? 0
    const totalSize = 4 + astBuffer.length + 1 + (baseLength ? 4 + baseLength : 0)
    const buffer = new Uint8Array(totalSize)
    const view = toView(buffer)

    let cursor = 0
    view.setUint32(cursor, astBuffer.length, true)
    cursor += 4

    buffer.set(astBuffer, cursor)
    cursor += astBuffer.length

    view.setUint8(cursor, baseBuffer ? 1 : 0)
    cursor += 1

    if (baseBuffer) {
      view.setUint32(cursor, baseLength, true)
      cursor += 4
      buffer.set(baseBuffer, cursor)
    }

    return buffer
  }

  static create<const P extends string>(input: P): AnalyzeInstance<P, undefined>
  static create<const P extends string, const B extends AnalyzeChain>(input: P, base: B): AnalyzeInstance<P, B>
  static create(input: string, base?: AnalyzeChain): AnalyzeInstance<string, AnalyzeChain | undefined> {
    return new AnalyzeImpl(input, base)
  }

  static fromBuffer(buffer: Uint8Array): AnalyzeChain {
    const view = toView(buffer)
    let cursor = 0

    const astLength = view.getUint32(cursor, true)
    cursor += 4

    const ast = AST.fromBuffer(buffer.subarray(cursor, cursor + astLength))
    cursor += astLength

    const hasBase = view.getUint8(cursor) === 1
    cursor += 1

    let base: AnalyzeChain | undefined
    if (hasBase) {
      const baseLength = view.getUint32(cursor, true)
      cursor += 4
      base = Analyze.fromBuffer(buffer.subarray(cursor, cursor + baseLength))
    }

    return new AnalyzeImpl(ast.input, { base, ast }) as AnalyzeChain
  }
}

/** Constructor with generic call signatures; the runtime implementation class is `AnalyzeImpl`. */
export const Analyze: AnalyzeConstructor = AnalyzeImpl as unknown as AnalyzeConstructor

export type Analyze<
  Path extends string = string,
  Parser extends AnalyzeChain | undefined = undefined
> = AnalyzeInstance<Path, Parser>
