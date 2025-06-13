/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ParsePath } from '../types/analyze'
import { ContentTypes, Delimiters, delimitersValues, EncodingSymbols, InternalExpression, OriginExpression } from '../types/node'
import decodeURIComponentUTF8 from '../utils/decodeURL'
import { AST } from './AST'
import { ErrorLog } from './Error'
import { Node } from './Node'

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
 * console.log(parser.display())
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
export class Analyze<
  const Path extends string,
  const TypedPath extends ParsePath<Path> = ParsePath<Path>,
  const Parser extends Analyze<string> | undefined = undefined
>{
  readonly input: Path
  readonly errors: ErrorLog[]
  readonly ast: AST<Path>

  base?: Parser
  isParser: Parser extends undefined ? true : false

  constructor(input: Path, base?: Parser) {
    this.input = input
    this.errors = []
    
    if (base) {
      this.base = base
      this.isParser = false as Parser extends undefined ? true : false
    } else {
      this.isParser = true as Parser extends undefined ? true : false
    }
  
    this.ast = new AST(this.input, this.errors)
    this.errors.push(...this.ast.errors)
  }

  /**
   * Returns an array of parameter names declared in the template (without values).
   * @returns {string[]} List of parameter names.
   * @throws {Error} If duplicate parameter names are detected.
   * @example
   * ```ts
   * const analyzer = new Analyze('http://localhost:3000/:a/:b')
   * console.log(analyzer.getParams()) // ['a','b']
   * ```
   */
  getParams(this: Analyze<Path, TypedPath, undefined>): string[]
  getParams<P extends Analyze<any>>(this: Analyze<Path, TypedPath, P>): P extends Analyze<infer _TemplatePath, infer TemplateTypedPath> ? TemplateTypedPath['params'] : never
  getParams(): string[] | (Parser extends Analyze<infer _P, infer T> ? T['params'] : never) {
    /**
     * Caso seja expecificado um parser na variavel this.parser
     */
    if (this.base && this.base.isParser) {
      const params: Record<string, string | number | boolean | string[]> = {}

      if (this.base.ast.expressions.has(InternalExpression.Variable)) {
        const slashs = this.base.ast.nodes.filter((node) => node.expression === Delimiters.Slash)
    
        for (let idx = 0; idx < slashs.length; idx ++) {
          const variable = this.base.ast.getNode(slashs[idx]!.id + 2)
          if (variable?.expression !== InternalExpression.Variable) continue
    
          const type = this.base.ast.getType(variable.id + 2) ?? ContentTypes.String
    
          const nodeSlash = this.ast.getNodeByType(Delimiters.Slash, idx)
          if (!nodeSlash) continue
    
          const nextValue = this.ast.getNode(nodeSlash?.id + 1)
          if (nextValue?.expression !== InternalExpression.Path) continue
    
          const key = this.base.ast.getContent(variable)
          const raw = this.ast.getContent(nextValue)
    
          params[key] = this.castValue(raw, type, nextValue.start, nextValue.end)
        }
      }

      return params as any
    }
  
    const params = new Set<string>()
    if (!this.ast.expressions.has(InternalExpression.Variable)) return Array.from(params.values())
    
    for (let index = 0; index < this.ast.nodes.length; index++) {
      const node = this.ast.nodes[index]
      if (!node || node?.expression !== InternalExpression.Variable) continue
      
      const variable = decodeURIComponentUTF8(this.ast.getContent(node))
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

  /**
   * Returns a Map of search parameters and their values (string or string[] for multiples).
   * @returns {Map<string, string | string[]>} The search parameters map.
   * @example
   * ```ts
   * const analyzer = new Analyze('?a=1&a=2&b=xyz')
   * console.log(analyzer.getSearchParams().get('a')) // ['1','2']
   * console.log(analyzer.getSearchParams().get('b')) // 'xyz'
   * ```
   */
  getSearchParams(this: Analyze<Path, TypedPath, undefined>): Map<string, string | number | boolean | string[]>
  getSearchParams<P extends Analyze<any>>(this: Analyze<Path, TypedPath, P>): P extends Analyze<infer _TemplatePath, infer TemplateTypedPath> ? TemplateTypedPath['searchParams'] : never
  getSearchParams (): Map<string, string | number | boolean | string[]> | (Parser extends Analyze<infer _P, infer T> ? T['searchParams'] : never) {
    /**
     * Caso seja expecificado um parser na variavel this.parser
     */
    if (this.base && this.base.isParser) {
      const params: Record<string, string | number | boolean | string[]> = {}
      if (!this.base.ast.expressions.has(InternalExpression.Parameter)) return params as any
    
      const definitionMap = this.base.ast.nodes.reduce(
        (map, n) => {
          if (n.expression !== InternalExpression.Parameter) return map
    
          const content = this.base!.ast.getContent(n)
          const type =
            n.type !== InternalExpression.Null
              ? n.type
              : this.base!.ast.getNode(n.id + 1)?.expression === EncodingSymbols.Equal
                ? this.base!.ast.getType(n.id + 2) ?? ContentTypes.String
                : ContentTypes.String
    
          map.set(content, type as ContentTypes)
          return map
        },
        new Map<string, ContentTypes>()
      )
    
      for (const node of this.ast.nodes) {
        if (node.expression !== InternalExpression.Parameter) continue
    
        const name = this.ast.getContent(node, this.input)
        const type = definitionMap.get(name)
        if (!type) continue
    
        const valueNode = this.ast.getNode(node.id + 2)
        const raw = this.ast.getValue(node.id) ?? ''
        params[name] = this.castValue(raw, type, valueNode?.start ?? node.start, valueNode?.end ?? node.end)
      }
    
      return params as any
    }
    const params = new Map<string, string | string[]>()
    if (!this.ast.expressions.has(InternalExpression.Parameter)) return params
    
    for (let index = 0; index < this.ast.nodes.length; index++) {
      const node = this.ast.nodes[index]
      if (!node || node?.expression !== InternalExpression.Parameter) continue
      
      const variable = decodeURIComponentUTF8(this.ast.getContent(node))
      if (variable === null) {
        this.errors.push(new ErrorLog('E_DECODE_URI', 'Failed to decode URI component for a search parameter.', node.start, node.end))
        continue
      }

      index++
      const nextSymbol = this.ast.nodes[index]
      if (!nextSymbol || nextSymbol.expression !== EncodingSymbols.Equal) {
        this.appendParam(params, variable, '')
        continue
      }

      index++
      const nextNode = this.ast.nodes[index]
      if (!nextNode || delimitersValues.includes(nextNode.type as number)
      ) {
        this.appendParam(params, variable, '')
        continue
      }

      const content = this.ast.getContent(nextNode)
      if (content === null) {
        this.errors.push(new ErrorLog('E_DECODE_URI', 'Failed to decode URI component for a search parameter value.', nextNode.start, nextNode.end))
        continue
      }

      this.appendParam(params, variable, content)
    }

    return params
  }


  /**
   * Retrieves the fragment identifier from the input URL or template.
   *
   * @remarks
   * The fragment identifier (part after '#') is not sent to the server in HTTP requests
   * because browsers strip it before sending. This method extracts and returns that fragment
   * on the client side only.
   *
   * @returns {string | undefined | Record<string,string | string>}  
   * - When called on a template without a base, returns the fragment string (without '#'), or undefined if none.
   * - When called on a template with a base AST, returns a record mapping the fragment key to its value.
   *
   * @example
   * ```ts
   * const analyzer = new Analyze('http://localhost:3000/page#section1');
   * console.log(analyzer.getFragment()); // 'section1'
   * ```
   */
  getFragment(this: Analyze<Path, TypedPath, undefined>): string | undefined
  getFragment<P extends Analyze<any>>(this: Analyze<Path, TypedPath, P>): P extends Analyze<infer _TemplatePath, infer TemplateTypedPath> ? TemplateTypedPath['fragment'] : never
  getFragment (): string | undefined | Record<string, string> {
    if (this.base) {
      const output: Record<string, string> = {}

      if (
        this.base.ast.expressions.has(InternalExpression.Fragment)
        && this.ast.expressions.has(InternalExpression.Fragment)
      ) {
        const key = this.base.ast.getNodeByType(InternalExpression.Fragment)
        const fragment = this.ast.getNodeByType(InternalExpression.Fragment)
    
        if (fragment && key) {
          const keyString = this.base.ast.getContent(key)
          const fragmentValue = this.ast.getContent(fragment)

          output[keyString] = fragmentValue
        }
      }

      return output as any
    }

    if (!this.ast.expressions.has(InternalExpression.Fragment)) return
    
    for (let index = 0; index < this.ast.nodes.length; index++) {
      const node = this.ast.nodes[index]
      if (!node || node?.expression !== InternalExpression.Fragment) continue
      
      const variable = decodeURIComponentUTF8(this.ast.getContent(node))
      if (variable === null) {
        this.errors.push(new ErrorLog('E_DECODE_URI', 'Failed to decode URI component for the fragment.', node.start, node.end))
        return
      }
      return variable
    }
  }

  /**
   * Extracts dynamic route parameters by navigating the base AST and finding corresponding
   * values in the instance AST. It supports `[id]` and `[...slug]` formats.
   *
   * @returns {Record<string, string | string[]>} An object mapping parameter names to their extracted values.
   */
  getStaticProps(): Record<string, string | string[]> {
    const props: Record<string, string | string[]> = {}
    if (!this.base) {
      return props
    }

    // Get all actual path value nodes from the instance URL.
    const instanceValueNodes = this.ast.nodes.filter(n => n.expression === InternalExpression.Path)
    let instanceSegmentIndex = 0

    // Iterate through the base template's nodes to find definitions.
    for (let i = 0; i < this.base.ast.nodes.length; i++) {
      const baseNode = this.base.ast.nodes[i]
      if (!baseNode) continue

      // A. Handle Static Segments: Verify they match
      if (baseNode.expression === InternalExpression.Path) {
        const instanceNode = instanceValueNodes[instanceSegmentIndex]
        if (!instanceNode || this.base.ast.getContent(baseNode) !== this.ast.getContent(instanceNode)) {
          // Mismatch found, the URL does not match the template.
          return {}
        }
        instanceSegmentIndex++
        continue
      }
      
      // B. Handle Dynamic Segments: Find a `[` delimiter
      if (baseNode.expression === Delimiters.LeftBracket) {
        const nextBaseNode = this.base.ast.nodes[i + 1]
        if (!nextBaseNode) continue

        // Case 1: Catch-All segment `[...slug]`
        if (nextBaseNode.expression === InternalExpression.Ellipsis) {
          const nameNode = this.base.ast.nodes[i + 2]
          const endNode = this.base.ast.nodes[i + 3]
          if (!nameNode || nameNode.expression !== InternalExpression.Slug || !endNode || endNode.expression !== Delimiters.RightBracket) continue
          
          const varName = this.base.ast.getContent(nameNode)

          // Find how many static segments appear *after* this catch-all in the template.
          const staticSegmentsAfter = this.base.ast.nodes
            .slice(i + 4)
            .filter(n => n.expression === InternalExpression.Path)
            .length

          // The value is the corresponding slice of instance nodes.
          const valueNodes = instanceValueNodes.slice(instanceSegmentIndex, instanceValueNodes.length - staticSegmentsAfter)
          props[varName] = valueNodes.map(n => this.ast.getContent(n))
          
          // A catch-all must be the last dynamic part, so we can stop.
          i += 3 // Advance index past `...`, `slug`, `]`
          break
        }

        // Case 2: Standard dynamic segment `[id]`
        if (nextBaseNode.expression === InternalExpression.Slug) {
          const endNode = this.base.ast.nodes[i + 2]
          if (!endNode || endNode.expression !== Delimiters.RightBracket) continue
          
          const varName = this.base.ast.getContent(nextBaseNode)
          const valueNode = instanceValueNodes[instanceSegmentIndex]

          if (valueNode) {
            props[varName] = this.ast.getContent(valueNode)
            instanceSegmentIndex++
          }
          i += 2 // Advance index past `slug`, `]`
        }
      }
    }
    
    // Final check: if we haven't consumed all instance segments (e.g. extra parts in URL), it's not a match
    const totalStaticSegmentsInBase = this.base.ast.nodes.filter(n => n.expression === InternalExpression.Path).length
    if (!Object.keys(props).some(k => Array.isArray(props[k])) && instanceSegmentIndex !== instanceValueNodes.length) {
      // This check is for non-catch-all routes.
      if(instanceValueNodes.length !== totalStaticSegmentsInBase + Object.keys(props).length) return {}
    }


    return props
  }


  /**
   * Retrieves the pathname (path + variables) from the parsed template.
   * @returns {string} The pathname (e.g., '/users/:id').
   * @example
   * ```ts
   * const analyzer = new Analyze('http://localhost:3000/users/:userId/profile')
   * console.log(analyzer.getPathname()) // '/users/:userId/profile'
   * ```
   */
  getPathname (): string {
    const startPathname = this.ast.nodes.find((node) => node.expression === Delimiters.Slash)
    let path = '/'
    if (!startPathname) return path

    for (let index = startPathname.id + 1; index < this.ast.nodes.length; index++) {
      const node = this.ast.nodes[index]!
      if ([Delimiters.Query, Delimiters.Hash].includes(node.expression as Delimiters)) {
        break
      }

      if ([
        Delimiters.Colon,
        Delimiters.Slash,
        Delimiters.LeftBracket,
        Delimiters.RightBracket,
        Delimiters.Asterisk,
        InternalExpression.Path,
        InternalExpression.Slug,
        InternalExpression.Ellipsis,
        InternalExpression.Variable,
      ].includes(node.expression as Delimiters | InternalExpression)) {
        path += this.ast.getContent(node)
      }
    }

    return path
  }

  /**
   * Retrieves the port from the input URL, if present.
   * @returns {string | undefined} The port string, or undefined if none.
   * @example
   * ```ts
   * const analyzer = new Analyze('http://localhost:8080')
   * console.log(analyzer.getPort()) // '8080'
   * ```
   */
  getPort (): string | undefined {
    const node = this.ast.nodes.find((node) => node.expression ===  OriginExpression.Port)
    if (!node) return
    
    return this.ast.getContent(node)
  }

  /**
   * Retrieves the hostname from the input URL.
   * @returns {string | undefined} The hostname, or undefined if not found.
   * @example
   * ```ts
   * const analyzer = new Analyze('https://example.com/path')
   * console.log(analyzer.getHostname()) // 'example.com'
   * ```
   */
  getHostname (): string | undefined {
    const node = this.ast.nodes.find((node) => node.expression === OriginExpression.Hostname)
    if (!node) return
    
    return this.ast.getContent(node)
  }

  /**
   * Retrieves the protocol (http or https) from the input URL.
   * @returns {string | undefined} The protocol, or undefined if not found.
   * @example
   * ```ts
   * const analyzer = new Analyze('https://site.org')
   * console.log(analyzer.getProtocol()) // 'https'
   * ```
   */
  getProtocol (): string | undefined {
    const node = this.ast.nodes.find((node) => node.expression === OriginExpression.Protocol)
    if (!node) return

    return this.ast.getContent(node)
  }

  setParser (base: Parser) {
    this.base = base
    this.isParser = true as Parser extends undefined ? true : false
  }

  /**
   * Serializes the internal Node array into a Buffer representation.
   * @returns {Buffer} The Buffer containing node data.
   */
  getBuffer(): Buffer {
    const buf = Buffer.alloc(this.ast.nodes.length * Node.SIZE)
    this.ast.nodes.forEach((node, i) => node.writeToBuffer(buf, i * Node.SIZE))
    return buf
  }

  /**
   * Checks if any errors were found during parsing.
   * @returns {boolean} True if errors exist.
   */
  hasErrors(errors: ErrorLog[] = this.errors): boolean {
    return errors.length > 0
  }

  /**
   * Returns a formatted string of all parsing errors.
   * @returns {string} The formatted error report.
   */
  displayErrors(errors: ErrorLog[] = this.errors): string {
    if (!this.hasErrors(errors)) return 'No errors found.'
    return errors.map(e => e.display(this.input)).join('\n\n')
  }

  /**
   * Casts a raw string value to the given content type.
   * Logs an error if casting fails.
   */
  private castValue(raw: string, type: ContentTypes | InternalExpression.Null, start: number, end: number): string | number | boolean | string[] {
    switch (type) {
    case ContentTypes.Boolean:
      if (/^(?:true|1)$/i.test(raw)) return true
      if (/^(?:false|0)$/i.test(raw)) return false
      throw this.displayErrors([new ErrorLog('E_CAST_BOOLEAN', `Invalid boolean value: "${raw}". Expected 'true', 'false', '1', or '0'.`, start, end)])
    case ContentTypes.Number: {
      const n = Number(raw)
      if (Number.isNaN(n)) {
        throw this.displayErrors([new ErrorLog('E_CAST_NUMBER', `Invalid numeric value: "${raw}".`, start, end)])
      }
      return n
    }
    case ContentTypes.Array: {
      return raw.split(',')
    }
    case ContentTypes.String:
    default:
      return raw
    }
  }

  /**
   * Adds or appends a parameter value into the map, handling duplicates.
   * 
   * @private
   * @param {Map<string, string | string[]>} map - The map to populate.
   * @param {string} variable - Parameter name.
   * @param {string} content - Parameter value.
   */
  private appendParam (
    map: Map<string, string | string[]>,
    variable: string,
    content: string
  ) {
    const prev = map.get(variable)

    switch (typeof prev) {
    case 'string': {
      map.set(variable, [prev, content])
      return
    }
    case 'undefined': {
      map.set(variable, content)
      return
    }
    default: {
      map.set(variable, [...prev ?? [], content])
      return
    }
    }
  }

  withParser<P extends Analyze<Path, TypedPath, any>>(parser: P): Analyze<Path, TypedPath, P> {
    return new Analyze<Path, TypedPath, P>(this.input, parser)
  }
}