import type {
  AnalyzeChain,
  AnalyzeConstructor,
  AnalyzeFragmentResult,
  AnalyzeInstance,
  AnalyzeNewOptions,
  AnalyzeParamsResult,
  AnalyzeSearchParamsResult,
  PathSegment,
} from '../types/analyze'
import {
  ContentTypes,
  DynamicVariableDelimiters,
  GeneralDelimiters,
  InternalExpression,
  Operators,
  ParameterDelimiters,
  contentTypeFromAnnotation,
  parseEnumVariantsFromAnnotation,
  typeAnnotationAfterDot,
} from '../types/node'
import decodeURIComponentUTF8 from '../utils/decodeURL'
import { AST } from './AST'
import { ErrorLog } from './Error'
import type { Node } from './Node'

/**
 * Parses and analyzes a URL template or real URL, extracting parameters, variables,
 * path segments, search params, fragment, and origin components (protocol, hostname, port).
 * Provides helper methods to retrieve and cast values according to defined types.
 *
 * @example
 * ```ts
 * import { Analyze } from '@asterflow/url-parser'
 *
 * // Template with typed parameter declaration and defaults
 * const template = 'http://example.com/users/:id=number?active=boolean'
 * const parser = new Analyze(template)
 * 
 * // Display internal node table
 * console.log(parser.ast.display())
 * console.log(parser.getPathname()) // '/users/:id'
 * console.log(parser.getParams()) // ['id']
 * console.log(parser.getSearchParams()) // Map(1) { "active": "boolean" }
 * 
 * // Parse an actual URL
 * const url = 'http://example.com/users/42?active=true'
 * const parsed = new Analyze(url, parser)
 * 
 * console.log(parsed.getPathname()) // '/users/42'
 * console.log(parsed.getParams()) // { id: 42 }
 * console.log(parsed.getSearchParams()) // { active: true }
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

  private getPathSegments(ast: AST<string>): PathSegment[] {
    const segments: PathSegment[] = []
    const current = ast.getPathNodes()

    if (current.length === 0) return segments

    let segNodes: Node[] = [current[0]!]

    for (let i = 1; i < current.length; i++) {
      const prev = current[i - 1]!
      const node = current[i]!
      const gap = ast.input.slice(prev.end, node.start)
      let hasSlash = false
      for (let c = 0; c < gap.length; c++) {
        if (gap.charCodeAt(c) === GeneralDelimiters.Slash) { hasSlash = true; break }
      }

      if (hasSlash) {
        segments.push({ nodes: segNodes, start: segNodes[0]!.start, end: segNodes[segNodes.length - 1]!.end })
        segNodes = [node]
      } else {
        segNodes.push(node)
      }
    }

    if (segNodes.length > 0) {
      segments.push({ nodes: segNodes, start: segNodes[0]!.start, end: segNodes[segNodes.length - 1]!.end })
    }

    return segments
  }

  private getSegmentContent(ast: AST<string>, seg: PathSegment): string {
    return ast.input.slice(seg.start, seg.end)
  }

  private findDynamicInSegment(seg: PathSegment): Node | undefined {
    return seg.nodes.find(n =>
      n.expression === InternalExpression.Dynamic ||
      n.expression === InternalExpression.DynamicCatchAll ||
      n.expression === InternalExpression.DynamicOptionalCatchAll
    )
  }

  private getNodeName(node: Node, ast: AST<string>): string {
    if (node.value) return node.value
    let content = ast.getContent(node)
    if (content.charCodeAt(0) === Operators.Not) content = content.slice(1)
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === Operators.TypeAnnotation || content.charCodeAt(i) === Operators.Default) return content.slice(0, i)
    }
    return content
  }

  getParams(): AnalyzeParamsResult {
    if (this.base) {
      const params: Record<string, string | number | boolean | string[]> = {}
      const baseSegs = this.getPathSegments(this.base.ast)
      const instSegs = this.getPathSegments(this.ast)

      let instIdx = 0
      for (let baseIdx = 0; baseIdx < baseSegs.length; baseIdx++) {
        const baseSeg = baseSegs[baseIdx]!
        const dynamicNode = this.findDynamicInSegment(baseSeg)

        if (dynamicNode) {
          const isCatchAll =
            dynamicNode.expression === InternalExpression.DynamicCatchAll ||
            dynamicNode.expression === InternalExpression.DynamicOptionalCatchAll

          const varNode = dynamicNode.body.find(n => n.expression === InternalExpression.Variable)
          if (!varNode) { instIdx++; continue }

          const key = this.getNodeName(varNode, this.base.ast)
          const { type, enumVariants } = this.resolveTypeInfo(varNode, dynamicNode)

          if (isCatchAll) {
            const staticAfter = baseSegs.slice(baseIdx + 1).filter(s => !this.findDynamicInSegment(s)).length
            const endSlice = staticAfter > 0 ? instSegs.length - staticAfter : instSegs.length
            const catchAllSegs = instSegs.slice(instIdx, endSlice)
            params[key] = catchAllSegs.map(seg => {
              const raw = this.getSegmentContent(this.ast, seg)
              return decodeURIComponentUTF8(raw) ?? raw
            })
            instIdx += catchAllSegs.length
          } else {
            const instSeg = instSegs[instIdx]
            if (instSeg) {
              const rawContent = this.getSegmentContent(this.ast, instSeg)
              const raw = decodeURIComponentUTF8(rawContent) ?? rawContent
              params[key] = this.castValue(raw, type, instSeg.start, instSeg.end, enumVariants)
            }
            instIdx++
          }
        } else {
          instIdx++
        }
      }
      return params
    }

    const params = new Set<string>()
    if (!this.ast.expressions.has(InternalExpression.Variable)) return Array.from(params.values())

    for (const node of this.ast.flatNodes) {
      if (!node || node.expression !== InternalExpression.Variable) continue

      const variable = decodeURIComponentUTF8(this.getNodeName(node, this.ast))
      if (variable === null) {
        this.errors.push(new ErrorLog('E_DECODE_URI', 'Failed to decode URI component for a variable.', node.start, node.end))
        continue
      }
      if (params.has(variable)) {
        this.errors.push(new ErrorLog('E_DUPLICATE_PARAM', `Duplicate parameter name found: "${variable}".`, node.start, node.end))
      }
      params.add(variable)
    }

    return Array.from(params.values())
  }

  getSearchParams(): AnalyzeSearchParamsResult {
    if (this.base) {
      const params: Record<string, string | number | boolean | string[]> = {}
      const definitionMap = this.buildQueryDefinitions(this.base.ast)
      const instancePairs = this.extractQueryPairsRaw(this.input)

      for (const pair of instancePairs) {
        const def = definitionMap.get(pair.key)
        if (!def) continue
        params[pair.key] = this.castValue(pair.val, def.type, pair.keyStart, pair.valEnd, def.enumVariants)
      }

      return params
    }

    const params = new Map<string, string | string[]>()
    const pairs = this.extractQueryPairs(this.ast, this.input)

    for (const pair of pairs) {
      const decodedKey = decodeURIComponentUTF8(pair.key)
      if (decodedKey === null) {
        this.errors.push(new ErrorLog('E_DECODE_URI', 'Failed to decode URI component for a search parameter.', pair.keyStart, pair.valEnd))
        continue
      }
      const decodedVal = decodeURIComponentUTF8(pair.val)
      if (decodedVal === null) {
        this.errors.push(new ErrorLog('E_DECODE_URI', 'Failed to decode URI component for a search parameter value.', pair.keyStart, pair.valEnd))
        continue
      }
      this.appendParam(params, decodedKey, decodedVal)
    }

    return params
  }

  private buildQueryDefinitions(ast: AST<string>): Map<string, { type: ContentTypes, enumVariants?: string[] }> {
    const map = new Map<string, { type: ContentTypes, enumVariants?: string[] }>()
    const queryNode = ast.getQueryNode()
    if (!queryNode || queryNode.body.length === 0) return map

    for (const node of queryNode.body) {
      if (node.expression !== InternalExpression.Parameter) continue

      const paramName = this.getNodeName(node, ast)
      let type = ContentTypes.String

      if (node.type !== InternalExpression.None && node.type !== ContentTypes.String) {
        type = node.type
      } else {
        const typeNode = queryNode.body.find(n =>
          n.id > node.id && n.expression === InternalExpression.Type
        )
        if (typeNode) {
          const typeContent = typeNode.value || ast.getContent(typeNode)
          const mapped = contentTypeFromAnnotation(typeContent)
          if (mapped !== undefined) type = mapped
        }
      }

      let enumVariants: string[] | undefined
      if (type === ContentTypes.Enum) {
        enumVariants = this.enumVariantsFromTemplateNode(node, ast)
        if (enumVariants === undefined) {
          const typeNode = queryNode.body.find(n =>
            n.id > node.id && n.expression === InternalExpression.Type
          )
          if (typeNode) {
            const typeContent = typeNode.value || ast.getContent(typeNode)
            enumVariants = parseEnumVariantsFromAnnotation(typeContent)
          }
        }
      }

      map.set(paramName, enumVariants !== undefined ? { type, enumVariants } : { type })
    }

    return map
  }

  private enumVariantsFromTemplateNode(node: Node, ast: AST<string>): string[] | undefined {
    const after = typeAnnotationAfterDot(ast.getContent(node))
    if (after === undefined) return undefined
    return parseEnumVariantsFromAnnotation(after)
  }

  private extractQueryPairsRaw(input: string): { key: string, val: string, keyStart: number, valEnd: number }[] {
    const pairs: { key: string, val: string, keyStart: number, valEnd: number }[] = []

    let qPos = -1
    for (let i = 0; i < input.length; i++) {
      if (input.charCodeAt(i) === ParameterDelimiters.Query) { qPos = i; break }
    }
    if (qPos === -1) return pairs

    let hashPos = input.length
    for (let i = qPos + 1; i < input.length; i++) {
      if (input.charCodeAt(i) === GeneralDelimiters.Hash) { hashPos = i; break }
    }

    const querySection = input.slice(qPos + 1, hashPos)
    const queryOffset = qPos + 1
    const segments = this.splitByChar(querySection, ParameterDelimiters.Ampersand)

    let offset = 0
    for (const seg of segments) {
      const absStart = queryOffset + offset

      let eqIdx = -1
      for (let i = 0; i < seg.length; i++) {
        if (seg.charCodeAt(i) === Operators.Default) { eqIdx = i; break }
      }

      if (eqIdx !== -1) {
        const key = seg.slice(0, eqIdx)
        const val = seg.slice(eqIdx + 1)
        const decodedKey = decodeURIComponentUTF8(key)
        const decodedVal = decodeURIComponentUTF8(val)
        pairs.push({
          key: decodedKey ?? key,
          val: decodedVal ?? val,
          keyStart: absStart,
          valEnd: absStart + seg.length
        })
      } else {
        const decodedKey = decodeURIComponentUTF8(seg)
        pairs.push({
          key: decodedKey ?? seg,
          val: '',
          keyStart: absStart,
          valEnd: absStart + seg.length
        })
      }

      offset += seg.length + 1
    }

    return pairs
  }

  private extractQueryPairs(ast: AST<string>, input: string): { key: string, val: string, keyStart: number, valEnd: number }[] {
    const pairs: { key: string, val: string, keyStart: number, valEnd: number }[] = []
    const queryNode = ast.getQueryNode()
    if (!queryNode || queryNode.body.length === 0) return pairs

    const body = queryNode.body
    let i = 0
    while (i < body.length) {
      const node = body[i]!

      if (node.expression === InternalExpression.Parameter) {
        const key = this.getNodeName(node, ast)
        const keyStart = node.start
        let valEnd = node.end

        let j = i + 1
        if (
          j < body.length
          && (body[j]!.expression === InternalExpression.Type || body[j]!.expression === InternalExpression.Default)
        ) {
          const valStart = body[j]!.start

          while (j < body.length && body[j]!.expression !== InternalExpression.Parameter) {
            valEnd = body[j]!.end
            j++
          }

          const val = input.slice(valStart, valEnd)
          pairs.push({ key, val, keyStart, valEnd })
        } else {
          pairs.push({ key, val: '', keyStart, valEnd })
        }

        i = j
      } else {
        i++
      }
    }

    return pairs
  }

  getFragment(): AnalyzeFragmentResult {
    const hashNode = this.ast.getFragmentNode()

    if (this.base) {
      const output: Record<string, string> = {}
      const baseHashNode = this.base.ast.getFragmentNode()

      if (baseHashNode && hashNode && hashNode.body.length > 0 && baseHashNode.body.length > 0) {
        const key = this.readFragmentBody(baseHashNode, this.base.input)
        const val = this.readFragmentBody(hashNode, this.input)
        if (key && val) output[key] = val
      }
      return output
    }

    if (!hashNode || hashNode.body.length === 0) return undefined
    const val = this.readFragmentBody(hashNode, this.input)
    if (val === null) return undefined
    return val
  }

  private readFragmentBody(hashNode: Node, input: string): string | null {
    if (hashNode.body.length === 0) return null
    const start = hashNode.body[0]!.start
    const end = hashNode.body[hashNode.body.length - 1]!.end
    return decodeURIComponentUTF8(input.slice(start, end))
  }

  getStaticProps(): Record<string, string | string[]> {
    const props: Record<string, string | string[]> = {}
    if (!this.base) return props

    const baseSegs = this.getPathSegments(this.base.ast)
    const instSegs = this.getPathSegments(this.ast)

    let instIdx = 0
    for (let baseIdx = 0; baseIdx < baseSegs.length; baseIdx++) {
      const baseSeg = baseSegs[baseIdx]!
      const dynamicNode = this.findDynamicInSegment(baseSeg)

      if (dynamicNode) {
        const isCatchAll =
          dynamicNode.expression === InternalExpression.DynamicCatchAll ||
          dynamicNode.expression === InternalExpression.DynamicOptionalCatchAll

        const varNode = dynamicNode.body.find(n => n.expression === InternalExpression.Variable)
        if (!varNode) { instIdx++; continue }

        const varName = this.getNodeName(varNode, this.base.ast)

        if (isCatchAll) {
          const staticAfter = baseSegs.slice(baseIdx + 1).filter(s => !this.findDynamicInSegment(s)).length
          const endSlice = staticAfter > 0 ? instSegs.length - staticAfter : instSegs.length
          const catchAllSegs = instSegs.slice(instIdx, endSlice)
          props[varName] = catchAllSegs.map(seg => {
            const raw = this.getSegmentContent(this.ast, seg)
            return decodeURIComponentUTF8(raw) ?? raw
          })
          instIdx += catchAllSegs.length
        } else {
          const instSeg = instSegs[instIdx]
          if (!instSeg) return {}
          const rawContent = this.getSegmentContent(this.ast, instSeg)
          props[varName] = decodeURIComponentUTF8(rawContent) ?? rawContent
          instIdx++
        }
      } else {
        const instSeg = instSegs[instIdx]
        if (!instSeg) return {}
        const baseRaw = decodeURIComponentUTF8(this.getSegmentContent(this.base.ast, baseSeg)) ?? this.getSegmentContent(this.base.ast, baseSeg)
        const instRaw = decodeURIComponentUTF8(this.getSegmentContent(this.ast, instSeg)) ?? this.getSegmentContent(this.ast, instSeg)
        if (baseRaw !== instRaw) return {}
        instIdx++
      }
    }

    if (instIdx !== instSegs.length) return {}
    return props
  }

  getPathname(): string {
    const segments = this.getPathSegments(this.ast)
    if (segments.length === 0) return '/'

    const parts: string[] = []
    for (const seg of segments) {
      const dynamicNode = this.findDynamicInSegment(seg)
      if (dynamicNode) {
        const prefix = this.ast.input.charAt(dynamicNode.start)
        const isBracket =
          dynamicNode.start < this.ast.input.length
          && this.ast.input.charCodeAt(dynamicNode.start) === DynamicVariableDelimiters.LeftBracket
        if (isBracket) {
          parts.push(this.ast.input.slice(dynamicNode.start, dynamicNode.end))
        } else {
          const varNode = dynamicNode.body.find(n => n.expression === InternalExpression.Variable)
          if (varNode) {
            parts.push(prefix + this.getNodeName(varNode, this.ast))
          } else {
            parts.push(this.ast.input.slice(seg.start, seg.end))
          }
        }
      } else {
        parts.push(this.ast.input.slice(seg.start, seg.end))
      }
    }

    return '/' + parts.join('/')
  }

  getPort(): string | undefined {
    const { port } = this.ast.getOriginNodes()
    if (!port) return
    return this.ast.getContent(port)
  }

  getHostname(): string | undefined {
    const { hostname } = this.ast.getOriginNodes()
    if (!hostname) return
    return this.ast.getContent(hostname)
  }

  getProtocol(): string | undefined {
    const { protocol } = this.ast.getOriginNodes()
    if (!protocol) return
    return this.ast.getContent(protocol)
  }

  setParser<S extends AnalyzeChain>(base: S): AnalyzeInstance<string, S> {
    this.base = base
    return this as unknown as AnalyzeInstance<string, S>
  }

  hasErrors(errors: ErrorLog[] = this.errors): boolean {
    return errors.length > 0
  }

  displayErrors(errors: ErrorLog[] = this.errors): string {
    if (!this.hasErrors(errors)) return 'No errors found.'
    return errors.map(e => e.display(this.input)).join('\n\n')
  }

  private resolveType(varNode: Node, parentNode: Node): ContentTypes {
    if (varNode.type !== InternalExpression.None && varNode.type !== ContentTypes.String) {
      return varNode.type
    }

    if (parentNode.type !== InternalExpression.None && parentNode.type !== ContentTypes.String) {
      return parentNode.type
    }

    for (const sibling of parentNode.body) {
      if (sibling.expression === InternalExpression.Type) {
        const content = sibling.value || this.base!.ast.getContent(sibling)
        const mapped = contentTypeFromAnnotation(content)
        if (mapped !== undefined) return mapped
      }
    }

    return ContentTypes.String
  }

  private resolveTypeInfo(
    varNode: Node,
    parentNode: Node
  ): { type: ContentTypes, enumVariants?: string[] } {
    const type = this.resolveType(varNode, parentNode)
    if (type !== ContentTypes.Enum) return { type }

    const enumVariants = this.enumVariantsFromTemplateNode(varNode, this.base!.ast)
    return enumVariants !== undefined ? { type, enumVariants } : { type }
  }

  private castValue(
    raw: string,
    type: ContentTypes | InternalExpression.None,
    start: number,
    end: number,
    enumVariants?: string[]
  ): string | number | boolean | string[] {
    switch (type) {
    case ContentTypes.Boolean: {
      const lower = this.toLower(raw)
      if (lower === 'true' || lower === '1') return true
      if (lower === 'false' || lower === '0') return false
      throw new Error(this.displayErrors([new ErrorLog('E_CAST_BOOLEAN', `Invalid boolean value: "${raw}". Expected 'true', 'false', '1', or '0'.`, start, end)]))
    }
    case ContentTypes.Number: {
      const n = Number(raw)
      if (Number.isNaN(n) || raw === '') {
        throw new Error(this.displayErrors([new ErrorLog('E_CAST_NUMBER', `Invalid numeric value: "${raw}".`, start, end)]))
      }
      return n
    }
    case ContentTypes.Array: {
      return this.splitByChar(raw, 44)
    }
    case ContentTypes.Enum: {
      if (enumVariants === undefined) {
        return this.splitByChar(raw, 44)
      }

      const parts = this.splitByChar(raw, 44).map(s => s.trim())

      if (enumVariants.length === 0) {
        if (parts.some(p => p.length > 0)) {
          throw new Error(this.displayErrors([new ErrorLog(
            'E_CAST_ENUM',
            'No values are allowed for this enum (declaration is enum[]).',
            start,
            end
          )]))
        }
        return []
      }

      for (const p of parts) {
        if (p.length === 0) {
          throw new Error(this.displayErrors([new ErrorLog(
            'E_CAST_ENUM',
            `Empty segment is not allowed. Allowed: ${enumVariants.map(v => JSON.stringify(v)).join(', ')}.`,
            start,
            end
          )]))
        }
        if (!enumVariants.includes(p)) {
          throw new Error(this.displayErrors([new ErrorLog(
            'E_CAST_ENUM',
            `Value ${JSON.stringify(p)} is not allowed. Allowed: ${enumVariants.map(v => JSON.stringify(v)).join(', ')}.`,
            start,
            end
          )]))
        }
      }

      return parts
    }
    case InternalExpression.None:
    case ContentTypes.String:
    default:
      return raw
    }
  }

  private toLower(input: string): string {
    let result = ''
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i)
      result += (code >= 65 && code <= 90) ? String.fromCharCode(code + 32) : input[i]
    }
    return result
  }

  private splitByChar(input: string, charCode: number): string[] {
    const result: string[] = []
    let start = 0

    for (let i = 0; i < input.length; i++) {
      if (input.charCodeAt(i) === charCode) {
        result.push(input.slice(start, i))
        start = i + 1
      }
    }

    result.push(input.slice(start))
    return result
  }

  private appendParam(
    map: Map<string, string | string[]>,
    variable: string,
    content: string
  ) {
    const prev = map.get(variable)
    switch (typeof prev) {
    case 'string': { map.set(variable, [prev, content]); return }
    case 'undefined': { map.set(variable, content); return }
    default: { map.set(variable, [...prev ?? [], content]); return }
    }
  }

  getBuffer(): Buffer {
    const astBuffer = this.ast.getBuffer()
    const baseBuffer = this.base?.getBuffer()

    const baseLength = baseBuffer?.length ?? 0
    const totalSize = 4 + astBuffer.length + 1 + (baseLength ? 4 + baseLength : 0)
    const buffer = Buffer.alloc(totalSize)

    let cursor = 0
    buffer.writeUInt32LE(astBuffer.length, cursor)
    cursor += 4

    astBuffer.copy(buffer, cursor)
    cursor += astBuffer.length

    buffer.writeUInt8(baseBuffer ? 1 : 0, cursor)
    cursor += 1

    if (baseBuffer) {
      buffer.writeUInt32LE(baseLength, cursor)
      cursor += 4
      baseBuffer.copy(buffer, cursor)
    }

    return buffer
  }

  static create<const P extends string>(input: P): AnalyzeInstance<P, undefined>
  static create<const P extends string, const B extends AnalyzeChain>(input: P, base: B): AnalyzeInstance<P, B>
  static create(input: string, base?: AnalyzeChain): AnalyzeInstance<string, AnalyzeChain | undefined> {
    return new AnalyzeImpl(input, base)
  }

  static fromBuffer(buffer: Buffer): AnalyzeChain {
    let cursor = 0

    const astLength = buffer.readUInt32LE(cursor)
    cursor += 4

    const ast = AST.fromBuffer(buffer.subarray(cursor, cursor + astLength))
    cursor += astLength

    const hasBase = buffer.readUInt8(cursor) === 1
    cursor += 1

    let base: AnalyzeChain | undefined
    if (hasBase) {
      const baseLength = buffer.readUInt32LE(cursor)
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
