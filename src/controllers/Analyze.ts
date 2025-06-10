import type { ParsePath } from '../types/analyze'
import { CatchAllExpression, ContentTypes, Delimiters, delimitersValues, EncodingSymbols, InternalExpression, OriginExpression, RawTokens, type AllValues } from '../types/node'
import { AnsiColor, colorize, expressionKeyColorMap } from '../utils/colors'
import decodeURIComponentUTF8 from '../utils/decodeURL'
import { colorizePath, renderTable } from '../utils/table'
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
  private readonly expressions: Set<number>
  readonly input: Path
  readonly nodes: Node[]
  readonly errors: ErrorLog[]

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
  
    const { expressions, nodes } = Analyze.parser(this.input, this.errors)
    this.nodes = nodes
    this.expressions = expressions
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

      if (this.base.expressions.has(InternalExpression.Variable)) {
        const slashs = this.base.nodes.filter((node) => node.expression === Delimiters.Slash)
    
        for (let idx = 0; idx < slashs.length; idx ++) {
          const variable = this.base.getNode(slashs[idx]!.id + 2)
          if (variable?.expression !== InternalExpression.Variable) continue
    
          const type = this.base.getType(variable.id + 2) ?? ContentTypes.String
    
          const nodeSlash = this.getNodeByType(Delimiters.Slash, idx)
          if (!nodeSlash) continue
    
          const nextValue = this.getNode(nodeSlash?.id + 1)
          if (nextValue?.expression !== InternalExpression.Path) continue
    
          const key = this.base.getContent(variable)
          const raw = this.getContent(nextValue)
    
          params[key] = this.castValue(raw, type, nextValue.start, nextValue.end)
        }
      }

      return params as any
    }
  
    const params: string[] = []
    if (!this.expressions.has(InternalExpression.Variable)) return params
    
    for (let index = 0; index < this.nodes.length; index++) {
      const node = this.nodes[index]
      if (!node || node?.expression !== InternalExpression.Variable) continue
      
      const variable = decodeURIComponentUTF8(this.getContent(node))
      if (variable === null) {
        this.errors.push(new ErrorLog('E_DECODE_URI', 'Failed to decode URI component for a variable.', node.start, node.end))
        continue
      }
      if (params.includes(variable)) {
        this.errors.push(new ErrorLog('E_DUPLICATE_PARAM', `Duplicate parameter name found: "${variable}".`, node.start, node.end))
      }
      params.push(variable)
    }

    return params
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
      if (!this.base.expressions.has(InternalExpression.Parameter)) return params as any
    
      const definitionMap = this.base.nodes.reduce(
        (map, n) => {
          if (n.expression !== InternalExpression.Parameter) return map
    
          const content = this.base!.getContent(n)
          const type =
            n.type !== InternalExpression.Null
              ? n.type
              : this.base!.getNode(n.id + 1)?.expression === EncodingSymbols.Equal
                ? this.base!.getType(n.id + 2) ?? ContentTypes.String
                : ContentTypes.String
    
          map.set(content, type)
          return map
        },
        new Map<string, ContentTypes>()
      )
    
      for (const node of this.nodes) {
        if (node.expression !== InternalExpression.Parameter) continue
    
        const name = this.getContent(node, this.input)
        const type = definitionMap.get(name)
        if (!type) continue
    
        const valueNode = this.getNode(node.id + 2)
        const raw = this.getValue(node.id) ?? ''
        params[name] = this.castValue(raw, type, valueNode?.start ?? node.start, valueNode?.end ?? node.end)
      }
    
      return params as any
    }
    const params = new Map<string, string | string[]>()
    if (!this.expressions.has(InternalExpression.Parameter)) return params
    
    for (let index = 0; index < this.nodes.length; index++) {
      const node = this.nodes[index]
      if (!node || node?.expression !== InternalExpression.Parameter) continue
      
      const variable = decodeURIComponentUTF8(this.getContent(node))
      if (variable === null) {
        this.errors.push(new ErrorLog('E_DECODE_URI', 'Failed to decode URI component for a search parameter.', node.start, node.end))
        continue
      }

      index++
      const nextSymbol = this.nodes[index]
      if (!nextSymbol || nextSymbol.expression !== EncodingSymbols.Equal) {
        this.appendParam(params, variable, '')
        continue
      }

      index++
      const nextNode = this.nodes[index]
      if (!nextNode || delimitersValues.includes(nextNode.type as number)
      ) {
        this.appendParam(params, variable, '')
        continue
      }

      const content = this.getContent(nextNode)
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
        this.base.expressions.has(InternalExpression.Fragment)
        && this.expressions.has(InternalExpression.Fragment)
      ) {
        const key = this.base.getNodeByType(InternalExpression.Fragment)
        const fragment = this.getNodeByType(InternalExpression.Fragment)
    
        if (fragment && key) {
          const keyString = this.base.getContent(key)
          const fragmentValue = this.getContent(fragment)

          output[keyString] = fragmentValue
        }
      }

      return output as any
    }

    if (!this.expressions.has(InternalExpression.Fragment)) return
    
    for (let index = 0; index < this.nodes.length; index++) {
      const node = this.nodes[index]
      if (!node || node?.expression !== InternalExpression.Fragment) continue
      
      const variable = decodeURIComponentUTF8(this.getContent(node))
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
    const instanceValueNodes = this.nodes.filter(n => n.expression === InternalExpression.Path)
    let instanceSegmentIndex = 0

    // Iterate through the base template's nodes to find definitions.
    for (let i = 0; i < this.base.nodes.length; i++) {
      const baseNode = this.base.nodes[i]
      if (!baseNode) continue

      // A. Handle Static Segments: Verify they match
      if (baseNode.expression === InternalExpression.Path) {
        const instanceNode = instanceValueNodes[instanceSegmentIndex]
        if (!instanceNode || this.base.getContent(baseNode) !== this.getContent(instanceNode)) {
          // Mismatch found, the URL does not match the template.
          return {}
        }
        instanceSegmentIndex++
        continue
      }
      
      // B. Handle Dynamic Segments: Find a `[` delimiter
      if (baseNode.expression === Delimiters.LeftBracket) {
        const nextBaseNode = this.base.nodes[i + 1]
        if (!nextBaseNode) continue

        // Case 1: Catch-All segment `[...slug]`
        if (nextBaseNode.expression === InternalExpression.Ellipsis) {
          const nameNode = this.base.nodes[i + 2]
          const endNode = this.base.nodes[i + 3]
          if (!nameNode || nameNode.expression !== InternalExpression.Slug || !endNode || endNode.expression !== Delimiters.RightBracket) continue
          
          const varName = this.base.getContent(nameNode)

          // Find how many static segments appear *after* this catch-all in the template.
          const staticSegmentsAfter = this.base.nodes
            .slice(i + 4)
            .filter(n => n.expression === InternalExpression.Path)
            .length

          // The value is the corresponding slice of instance nodes.
          const valueNodes = instanceValueNodes.slice(instanceSegmentIndex, instanceValueNodes.length - staticSegmentsAfter)
          props[varName] = valueNodes.map(n => this.getContent(n))
          
          // A catch-all must be the last dynamic part, so we can stop.
          i += 3 // Advance index past `...`, `slug`, `]`
          break
        }

        // Case 2: Standard dynamic segment `[id]`
        if (nextBaseNode.expression === InternalExpression.Slug) {
          const endNode = this.base.nodes[i + 2]
          if (!endNode || endNode.expression !== Delimiters.RightBracket) continue
          
          const varName = this.base.getContent(nextBaseNode)
          const valueNode = instanceValueNodes[instanceSegmentIndex]

          if (valueNode) {
            props[varName] = this.getContent(valueNode)
            instanceSegmentIndex++
          }
          i += 2 // Advance index past `slug`, `]`
        }
      }
    }
    
    // Final check: if we haven't consumed all instance segments (e.g. extra parts in URL), it's not a match
    const totalStaticSegmentsInBase = this.base.nodes.filter(n => n.expression === InternalExpression.Path).length
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
    const startPathname = this.nodes.find((node) => node.expression === Delimiters.Slash)
    let path = '/'
    if (!startPathname) return path

    for (let index = startPathname.id + 1; index < this.nodes.length; index++) {
      const node = this.nodes[index]!
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
      ].includes(node.expression as any)) {
        path += this.getContent(node)
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
    const node = this.nodes.find((node) => node.expression ===  OriginExpression.Port)
    if (!node) return
    
    return this.getContent(node)
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
    const node = this.nodes.find((node) => node.expression === OriginExpression.Hostname)
    if (!node) return
    
    return this.getContent(node)
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
    const node = this.nodes.find((node) => node.expression === OriginExpression.Protocol)
    if (!node) return

    return this.getContent(node)
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
    const buf = Buffer.alloc(this.nodes.length * Node.SIZE)
    this.nodes.forEach((node, i) => node.writeToBuffer(buf, i * Node.SIZE))
    return buf
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

  /**
   * Finds a Node by its index or its content string.
   * 
   * @param {string | number} idOrName - Node index or content to search.
   * @param {Node[]} [nodes=this.nodes] - Optional node array to search.
   * @param {?string} [input] - Optional input string context.
   * @returns {Node | undefined} The matching Node or undefined.
   */
  getNode(idOrName: string | number, nodes: Node[] = this.nodes, input?: string): Node | undefined {
    const getById = (id: number) => {
      const node = nodes[id]
      if (!node) return

      return node
    }

    switch (typeof idOrName) {
    case 'string': {
      const id = nodes.findIndex((node) => this.getContent(node, input) === idOrName)
      if (id === -1) return
  
      return getById(id)
    }
    case 'number': {
      return getById(idOrName)
    }
    }
  }

  /**
   * Finds the Nth Node of a given expression type.
   * 
   * @param {AllValues} type - Expression or delimiter type code.
   * @param {number} [position=0] - Zero-based occurrence index.
   * @param {Node[]} [nodes=this.nodes] - Optional node array to search.
   * @returns {Node | undefined} The matching Node or undefined.
   */
  getNodeByType(type: AllValues, position: number = 0, nodes: Node[] = this.nodes): Node | undefined {
    let elements = 0
    for (const node of nodes) {
      if (node.expression === type) {
        if (elements === position) return node
        elements++
      }
    }
  }

  /**
   * Retrieves the declared type of a Node's next value token.
   * 
   * @param {string | number} idOrName - Node index or content to search.
   * @param {Node[]} [nodes=this.nodes] - Optional node array to search.
   * @param {?string} [input] - Optional input string context.
   * @returns {ContentTypes | undefined} The content type code if present.
   */
  getType(idOrName: string | number, nodes: Node[] = this.nodes, input?: string): any {
    const getTypeById = (id: number) => {
      const valueNode = nodes[id]
      if (!valueNode || valueNode.expression !== InternalExpression.Value) return

      return valueNode.type
    }

    switch (typeof idOrName) {
    case 'string': {
      const result = this.getNode(idOrName, nodes, input)
      if (!result) return

      return getTypeById(result.id)
    }
    case 'number': {
      return getTypeById(idOrName)
    }
    }
  }

  /**
   * Extracts raw content string from a Node's start/end positions.
   * 
   * @param {Node} node - The Node to extract from.
   * @param {string} [input=this.input] - Optional input string context.
   * @returns {string} The substring for the node.
   */
  getContent (node: Node, input: string = this.input): string {
    return input.slice(node.start, node.end)
  }

  /**
   * Retrieves the raw value string following a parameter or variable Node.
   * 
   * @param {string | number} idOrName - Node index or content to search.
   * @param {Node[]} [nodes=this.nodes] - Optional node array to search.
   * @param {?string} [input] - Optional input string context.
   * @returns {string | undefined} The raw value, or undefined if absent.
   */
  getValue(idOrName: string | number, nodes: Node[] = this.nodes, input?: string): string | undefined {
    const property = this.getNode(idOrName, nodes, input)
    if (
      !property
      || ![InternalExpression.Parameter, InternalExpression.Variable].includes(property.expression as InternalExpression)
    ) return

    const value = this.getNode(property.id + 2, nodes, input)
    if (
      !value
      || value.expression !== InternalExpression.Value
    ) return

    return this.getContent(value, input)
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
   * Prints a formatted table of nodes and colors the path output.
   * 
   * @param {Node[]} [node=this.nodes] - Optional node array to display.
   * @param {string} [input=this.input] - Optional input context for coloring.
   */
  display(node: Node[] = this.nodes, input: string = this.input): string {
    type Row = {
      idx: string;
      symbol: string;
      expr: string;
      type: string;
      start: string;
      end: string;
    };

    // Build raw rows data
    const rows: Row[] = node.map((node, i) => {
      const raw = input.slice(node.start, node.end)
      const sym = colorize(raw, expressionKeyColorMap[node.expression] ?? AnsiColor.White)
      const expr = RawTokens[node.expression] ?? 'Unknown'
      const typ = RawTokens[node.type] ?? ''

      return {
        idx: String(i + 1),
        symbol: sym,
        expr,
        type: typ,
        start: String(node.start),
        end: String(node.end),
      }
    })

    // Define headers
    const headers = {
      idx: 'Id',
      symbol: 'Symbol',
      expr: 'Expression',
      type: 'Type',
      start: 'Start',
      end: 'End',
    } as const

    return renderTable(rows, headers) + '\n\nPath: ' + colorizePath(input, node)
  }

  static parser (input: string, errors: ErrorLog[]) {
    const nodes: Node[] = []
    const foundExpressions = new Set<number>()
    let state: AllValues = InternalExpression.Null
    let tokenStart = 0
    let tokenEnd = 0

    for (let index = 0; index < input.length; index++) {
      const code = input.charCodeAt(index)
      const next = input.charCodeAt(index + 1)
      const id = nodes.length
      const c = input.charAt(index)

      if (
        state === InternalExpression.Void
          && foundExpressions.has(InternalExpression.Ellipsis)
          && next !== undefined
      ) {
        errors.push(new ErrorLog(
          'E_UNEXPECTED_TOKEN', 
          'Unexpected token after catch-all \'[]\'. A catch-all must be the final element.',
          index + 1,
          input.length
        ))
        break
      }

      if (
        (state === InternalExpression.Slug || state === InternalExpression.Ellipsis)
        && (delimitersValues.includes(code) && code !== Delimiters.RightBracket)
      ) {
        errors.push(new ErrorLog(
          'E_INVALID_SYNTAX',
          `Unexpected delimiter '${c}' inside a dynamic segment '[]'.`,
          index,
          index + 1
        ))
      }

      if (
        state === InternalExpression.Path
        && code === Delimiters.Slash
        && (state as unknown as OriginExpression) !== OriginExpression.Hostname) {
        errors.push(new ErrorLog(
          'E_CONSECUTIVE_SLASHES',
          'Consecutive slashes are not allowed in the path.',
          index,
          index + 1
        ))
      }

      if (!RawTokens[code]) {
        const isDelimiter = !next
          || delimitersValues.includes(next)
          || next === EncodingSymbols.Equal
          // for LeftBracket
          || state === InternalExpression.Ellipsis

        if (
          (state === InternalExpression.Path || state === InternalExpression.Variable)
                  && (
                    next === Delimiters.Ampersand
                    || next === Delimiters.Colon
                    || (state !== InternalExpression.Variable && EncodingSymbols.Equal === next)
                  )
        ) {
          errors.push(new ErrorLog(
            'E_INVALID_SYNTAX',
            `Unexpected token '${input[index+1]}'. A path segment or variable cannot be followed by '${RawTokens[next]}'.`,
            index + 1,
            index + 2
          ))
        }

        if (state === InternalExpression.Parameter
            && (
              next === Delimiters.Colon
              || next === Delimiters.Slash
              || next === Delimiters.Query
            )) {
          errors.push(new ErrorLog(
            'E_INVALID_SYNTAX',
            `Unexpected token '${input[index+1]}'. A search parameter cannot be followed by '${RawTokens[next]}'.`,
            index + 1,
            index + 2
          ))
        }

        if (!isDelimiter) continue
        foundExpressions.add(state)
        
        switch (state) {
        case OriginExpression.Port:
        case InternalExpression.Fragment:
        case InternalExpression.Path:
        case InternalExpression.Slug:
        case InternalExpression.Variable: {
          nodes.push(new Node(id, state, tokenStart, index + 1))
          state = InternalExpression.Null
          continue
        }
        case InternalExpression.Null: {
          const content = input.slice(tokenEnd, index + 1)
          tokenEnd = tokenEnd <= tokenStart ? (index + 1) : tokenEnd

          switch (content) {
          case 'http': {
            nodes.push(new Node(id, OriginExpression.Protocol, tokenStart, tokenEnd))
            break
          }
          case 'https': {
            nodes.push(new Node(id, OriginExpression.Protocol, tokenStart, tokenEnd))
            break
          }
          default: {
            if (next !== Delimiters.Colon && next !== Delimiters.Slash) {
              nodes.push(new Node(id, InternalExpression.Parameter, tokenStart, tokenEnd))
              continue
            }
            nodes.push(new Node(id, OriginExpression.Hostname, tokenStart, tokenEnd))

            if (next === Delimiters.Colon) {
              // ignore : of localhost:3000
              index += 2
              tokenStart = index
              state = OriginExpression.Port
            }

            continue
          }
          }
          // ignore :// of http://localhost
          index += 4
          tokenStart = index
          state = OriginExpression.Hostname
          continue
        }
        case OriginExpression.Hostname: {
          nodes.push(new Node(id, state, tokenStart, index + 1))

          if (next === Delimiters.Colon) {
            // ignore : of localhost:3000
            index += 2
            tokenStart = index
            state = OriginExpression.Port
            continue
          }
          
          state = InternalExpression.Null
          continue
        }
        case InternalExpression.Ellipsis: {
          if (code !== CatchAllExpression.Point) {
            foundExpressions.delete(state)
            state = InternalExpression.Slug
            continue
          }

          const ellipsis = input.substring(index, index + 3)
          if (ellipsis !== '...') {
            errors.push(new ErrorLog(
              'E_INVALID_CATCH_ALL',
              `Invalid catch-all syntax. Expected '[...]' but found an incomplete sequence near '${ellipsis}'.`,
              tokenStart,
              index + ellipsis.length
            ))
            index += ellipsis.length -1
            state = InternalExpression.Void
            continue
          }
          
          index += 2
          nodes.push(new Node(id, state, tokenStart, index + 1))
          tokenStart = index + 1
          state = InternalExpression.Slug
          continue
        }
        default: {
          tokenEnd = tokenEnd <= tokenStart ? (index + 1) : tokenEnd
          const content = input.slice(tokenStart, tokenEnd)

          switch (content) {
          case 'number': {
            nodes.push(new Node(id, state, tokenStart, tokenEnd, ContentTypes.Number))
            break
          }
          case 'boolean': {
            nodes.push(new Node(id, state, tokenStart, tokenEnd, ContentTypes.Boolean))
            break
          }
          case 'string': {
            nodes.push(new Node(id, state, tokenStart, tokenEnd, ContentTypes.String))
            break
          }
          case 'array': {
            nodes.push(new Node(id, state, tokenStart, tokenEnd, ContentTypes.Array))
            break
          }
          default: {
            nodes.push(new Node(id, state, tokenStart, tokenEnd))
            break
          }
          }

          state = InternalExpression.Null
          continue
        }
        }
      }

      switch (code as AllValues) {
      case Delimiters.Hash: /* # */ {
        state = InternalExpression.Fragment
        break
      }
      case Delimiters.Slash: /* / */ {
        state = InternalExpression.Path
        break
      }
      case Delimiters.Ampersand: /* & */ {
        state = InternalExpression.Parameter
        break
      }
      case Delimiters.Semicolon: /* ; */ {
        state = InternalExpression.Parameter
        break
      }
      case Delimiters.Query: /* ? */ {
        state = InternalExpression.Parameter
        break
      }
      case Delimiters.Colon: /* : */ {
        state = InternalExpression.Variable
        break
      }
      case Delimiters.Asterisk: /* * */ {
        state = InternalExpression.Void
        break
      }
      case Delimiters.LeftBracket: /* [ */ {
        state = InternalExpression.Ellipsis
        break
      }
      case Delimiters.RightBracket: /* ] */ {
        state = InternalExpression.Null
        break
      }
      case EncodingSymbols.Equal: /* = */ {
        state = InternalExpression.Value
        break
      }
      }

      nodes.push(new Node(id, code, index, index + 1))
      tokenStart = index + 1
      foundExpressions.add(state)
    }

    return { nodes, expressions: foundExpressions }
  }

  withParser<P extends Analyze<Path, TypedPath, any>>(parser: P): Analyze<Path, TypedPath, P> {
    return new Analyze<Path, TypedPath, P>(this.input, parser)
  }
}