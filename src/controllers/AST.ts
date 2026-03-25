import type { ASTOptionalOptions, ASTJSON, DisplayRow } from '../types/ast'
import { CatchAllExpression, CONTENT_TYPE_MAP, ContentTypes, DynamicVariableDelimiters, GeneralDelimiters, grammarTokens, InternalExpression, Operators, OriginExpression, ParameterDelimiters, RawTokens, type AllValues } from '../types/node'
import { AnsiColor, colorize, expressionKeyColorMap } from '../utils/colors'
import { colorizePath, renderTable } from '../utils/table'
import { ErrorLog } from './Error'
import { Node } from './Node'

/**
 * Scannerless parsing: there is no separate lexer; lexing and parsing happen together
 * while the AST is constructed.
 */
export class AST<const Path extends string> {
  readonly expressions: Set<number> = new Set()
  readonly input: Path
  readonly errors: ErrorLog[] = []
  readonly nodes: Node[]
  readonly flatNodes: Node[] = []

  private nodeIdCounter = 0

  constructor(input: Path, options?: ASTOptionalOptions) {
    this.input = input
    this.nodes = options?.nodes ?? this.parser()
    this.flatten(this.nodes)
  }

  /**
   * Finds a node by numeric index or by matching its string content.
   */
  getNode(idOrName: string | number, input?: string): Node | undefined {
    if (typeof idOrName === 'number') return this.flatNodes[idOrName]

    return this.flatNodes.find(node => this.getContent(node, input) === idOrName)
  }

  /**
   * Returns the nth node that matches the given expression type.
   */
  getNodeByType(type: AllValues, position: number = 0): Node | undefined {
    let elementsCount = 0
    for (const node of this.flatNodes) {
      if (node && node.expression === type) {
        if (elementsCount === position) return node
        elementsCount++
      }
    }
  }

  /**
   * Gets the declared type of the value token that follows a parameter or variable node.
   */
  getType(idOrName: string | number, input?: string) {
    return this.getNode(idOrName, input)?.type
  }

  /**
   * Returns the raw substring between a node's start and end offsets.
   */
  getContent(node: Node, input: string = this.input): string {
    return input.slice(node.start, node.end)
  }

  /**
   * Returns the raw value substring after a parameter or variable node.
   */
  getValue(idOrName: string | number, input?: string): string | undefined {
    const propertyNode = this.getNode(idOrName, input)

    if (
      !propertyNode
      || (propertyNode.expression !== InternalExpression.Parameter && propertyNode.expression !== InternalExpression.Variable)
    ) return

    // Tentar encontrar o nó de valor (Type ou Parameter) nos nós flat após o propertyNode
    const allFlat = Object.values(this.flatNodes)
    const idx = allFlat.indexOf(propertyNode)
    if (idx !== -1 && idx + 1 < allFlat.length) {
      const nextNode = allFlat[idx + 1]!
      if (
        nextNode.expression === InternalExpression.Type
        || nextNode.expression === InternalExpression.Default
        || nextNode.expression === InternalExpression.Parameter
      ) {
        return this.getContent(nextNode, input)
      }
    }

    return
  }

  /**
   * Prints a formatted node table and colorizes the path segment of the output.
   */
  display(nodes: Node[] = this.nodes, input: string = this.input): string {
    const displayRows: DisplayRow[] = []

    const buildDisplayRows = (currentNodes: Node[], currentDepth: number) => {
      for (const listNode of currentNodes) {
        const indentString = currentDepth > 0 ? '  '.repeat(currentDepth - 1) + '└─ ' : ''
        const rawString = input.slice(listNode.start, listNode.end)

        displayRows.push({
          idx: String(listNode.id + 1),
          symbol: colorize(indentString + rawString, expressionKeyColorMap[listNode.expression] ?? AnsiColor.White),
          expr: RawTokens[listNode.expression] ?? 'Unknown',
          type: RawTokens[listNode.type] ?? '',
          optional: listNode.optional ? 'Yes' : '-',
          start: String(listNode.start),
          end: String(listNode.end),
        })

        if (listNode.body.length > 0) {
          buildDisplayRows(listNode.body, currentDepth + 1)
        }
      }
    }

    buildDisplayRows(nodes, 0)

    const tableHeaders = {
      idx: 'Id',
      symbol: 'Symbol',
      expr: 'Expression',
      type: 'Type',
      optional: 'Optional',
      start: 'Start',
      end: 'End',
    } as const

    return renderTable(displayRows, tableHeaders) + '\n\nPath: ' + colorizePath(input, nodes)
  }

  /**
   * Main parser implementation, split into focused responsibility blocks.
   */
  private parser(state?: AllValues, startIndex: number = 0, isRootLevel = true, isInsideDynamic = false): Node[] {
    const nodes: Node[] = []
    state ??= InternalExpression.None

    let tokenStart = startIndex
    let tokenEnd = startIndex
    let isOptional = state === InternalExpression.DynamicOptionalCatchAll

    const pushSimpleNode = (endIndex: number) => {
      nodes.push(new Node(
        this.nodeIdCounter++,
        state!,
        tokenStart,
        endIndex,
        this.input.slice(tokenStart, endIndex),
        undefined,
        isOptional)
      )
      tokenStart = endIndex
      state = InternalExpression.None
      isOptional = false
    }

    const parseDelimitedExpression = (
      expressionState: AllValues,
      delimiterType: AllValues,
      nodeType: InternalExpression.None | ContentTypes,
      startOffset: number = 1,
      endOffset: number = 0,
      isInsideDynamic = false
    ): number => {
      this.expressions.add(delimiterType)

      const parentId = this.nodeIdCounter++
      const result = this.parser(
        expressionState,
        tokenStart + startOffset,
        false,
        isInsideDynamic
      )

      const endIndex = result.length > 0 ? result[result.length - 1]!.end : tokenStart + startOffset
      const hasOptional = result.some((node) => node.optional)

      nodes.push(new Node(
        parentId,
        delimiterType,
        tokenStart,
        endIndex + endOffset,
        this.input.slice(tokenStart, endIndex + endOffset),
        nodeType,
        hasOptional || isOptional
      ).setBody(result))

      state = InternalExpression.None
      tokenStart = endIndex + endOffset
      isOptional = false

      return tokenStart - 1
    }

    for (let index = startIndex; index < this.input.length; index++) {
      const charCode = this.input.charCodeAt(index)
      const nextCharCode = this.input.charCodeAt(index + 1)
      const currentCharacter = this.input.charAt(index)

      this.expressions.add(state)

      // No hostname e em segmentos de path estáticos, `.` é literal (example.com, report.pdf, 99.99).
      // Em `:name.type`, o estado é Variable e `.` continua sendo o operador de anotação.
      const isDotLiteralOutsideVar =
        (state === OriginExpression.Hostname || state === InternalExpression.Path)
        && charCode === Operators.TypeAnnotation
      const isGrammarToken =
        (grammarTokens.includes(charCode) || charCode === CatchAllExpression.Asterisk)
        && !isDotLiteralOutsideVar

      const hasCatchAllSegment = this.expressions.has(InternalExpression.DynamicCatchAll) ||
        this.expressions.has(InternalExpression.DynamicOptionalCatchAll) ||
        this.expressions.has(InternalExpression.Wildcard)

      // Validações Sintáticas e de Erros
      if (hasCatchAllSegment && charCode === GeneralDelimiters.Slash) {
        this.errors.push(new ErrorLog(
          'E_INVALID_SYNTAX',
          'Unexpected route segment. No further path segments are allowed after a catch-all segment.',
          index,
          index + 1
        ))
      }

      if (
        state === InternalExpression.Path
        && charCode === GeneralDelimiters.Slash
        && (state as unknown as OriginExpression) !== OriginExpression.Hostname
      ) {
        this.errors.push(new ErrorLog(
          'E_CONSECUTIVE_SLASHES',
          'Consecutive slashes are not allowed in the path.',
          index,
          index + 1
        ))
      }

      // Processamento de Conteúdo de Texto
      if (!isGrammarToken) {
        const isDelimiterCode =
          !nextCharCode
          || Number.isNaN(nextCharCode)
          || (
            grammarTokens.includes(nextCharCode)
            && !(
              (state === OriginExpression.Hostname || state === InternalExpression.Path)
              && nextCharCode === Operators.TypeAnnotation
            )
          )

        // Validações adicionais específicas de delimitadores de texto
        if (
          (state === InternalExpression.Path || state === InternalExpression.Variable)
          && (
            nextCharCode === ParameterDelimiters.Ampersand
            || nextCharCode === DynamicVariableDelimiters.Colon
          )
        ) {
          this.errors.push(new ErrorLog(
            'E_INVALID_SYNTAX',
            `Unexpected token '${this.input[index + 1]}'. A path segment or variable cannot be followed by '${RawTokens[nextCharCode] ?? ''}'.`,
            index + 1,
            index + 2
          ))
        }

        if (isInsideDynamic && ((isGrammarToken || isDelimiterCode) && nextCharCode !== DynamicVariableDelimiters.RightBracket)) {
          this.errors.push(new ErrorLog(
            'E_INVALID_SYNTAX',
            `Unexpected delimiter '${currentCharacter}' inside a dynamic segment '[${this.input.slice(tokenEnd, index + 1)}]'.`,
            index,
            index + 1
          ))
        }

        if (
          state === InternalExpression.Parameter
          && (
            nextCharCode === DynamicVariableDelimiters.Colon
            || nextCharCode === GeneralDelimiters.Slash
            || nextCharCode === ParameterDelimiters.Query
          )
        ) {
          const isColonToken = nextCharCode === DynamicVariableDelimiters.Colon
          this.errors.push(new ErrorLog(
            'E_INVALID_SYNTAX',
            isColonToken
              ? 'A search parameter cannot be followed by a variable (\':\'). Use \'.\' to define a type or value.'
              : `Unexpected token '${this.input[index + 1]}'. A search parameter cannot be followed by '${RawTokens[nextCharCode] ?? ''}'.`,
            index + 1,
            index + 2
          ))
        }

        if (!isDelimiterCode) continue

        switch (state) {
        case OriginExpression.Hostname: {
          nodes.push(new Node(
            this.nodeIdCounter++, state,
            tokenStart,
            index + 1,
            this.input.slice(tokenStart, index + 1))
          )
          tokenStart = index + 1

          if (nextCharCode === DynamicVariableDelimiters.Colon) {
            index += 2
            tokenStart = index
            state = OriginExpression.Port
            continue
          }

          state = InternalExpression.None
          continue
        }
        case OriginExpression.Port:
        case InternalExpression.Fragment:
        case InternalExpression.Path: {
          pushSimpleNode(index + 1)
          continue
        }
        case InternalExpression.None: {
          tokenEnd = tokenEnd <= tokenStart ? (index + 1) : tokenEnd

          const hasSchemeSeparator =
              nextCharCode === DynamicVariableDelimiters.Colon &&
              this.input.charCodeAt(index + 2) === GeneralDelimiters.Slash &&
              this.input.charCodeAt(index + 3) === GeneralDelimiters.Slash

          if (hasSchemeSeparator) {
            nodes.push(new Node(
              this.nodeIdCounter++,
              OriginExpression.Protocol,
              tokenStart,
              tokenEnd,
              this.input.slice(tokenStart, tokenEnd))
            )
            index = tokenEnd + 2
            tokenStart = index + 1
            state = OriginExpression.Hostname
            continue
          }

          if (nextCharCode !== DynamicVariableDelimiters.Colon && nextCharCode !== GeneralDelimiters.Slash) {
            nodes.push(new Node(
              this.nodeIdCounter++,
              InternalExpression.Parameter,
              tokenStart,
              tokenEnd,
              this.input.slice(tokenStart, tokenEnd))
            )
            tokenStart = tokenEnd
            continue
          }

          nodes.push(new Node(
            this.nodeIdCounter++,
            OriginExpression.Hostname,
            tokenStart,
            tokenEnd,
            this.input.slice(tokenStart, tokenEnd)
          ))

          if (nextCharCode === DynamicVariableDelimiters.Colon) {
            index += 2
            tokenStart = index
            state = OriginExpression.Port
          }

          continue
        }
        default: {
          tokenEnd = index + 1
          let content = this.input.slice(tokenStart, tokenEnd)

          const mappedContentType = state === InternalExpression.Type ? CONTENT_TYPE_MAP[content] : undefined

          if (
            state === InternalExpression.Type
              && mappedContentType === ContentTypes.Enum
              && nextCharCode === DynamicVariableDelimiters.LeftBracket
          ) {
            let depth = 1
            let j = index + 2
            while (j < this.input.length && depth > 0) {
              const c = this.input.charCodeAt(j)
              if (c === DynamicVariableDelimiters.LeftBracket) depth++
              else if (c === DynamicVariableDelimiters.RightBracket) depth--
              j++
            }
            if (depth !== 0) {
              this.errors.push(new ErrorLog(
                'E_INVALID_SYNTAX',
                'Unclosed \'[\' in enum type annotation.',
                index + 1,
                this.input.length
              ))
            }
            tokenEnd = j
            content = this.input.slice(tokenStart, tokenEnd)
          }

          if (mappedContentType !== undefined && nodes.length > 0) {
            const targetNode = (nodes[nodes.length - 1]!.body[0] ?? nodes[nodes.length - 1])
            if (targetNode) {
              targetNode.setType(mappedContentType)
              targetNode.end = tokenEnd
            }
          } else {
            nodes.push(new Node(
              this.nodeIdCounter++,
              state,
              tokenStart,
              tokenEnd,
              content,
              undefined,
              isOptional
            ))
          }

          if (!isRootLevel &&
              (state === InternalExpression.Parameter || state === InternalExpression.Type || state === InternalExpression.Default || state === InternalExpression.Variable) &&
              (nextCharCode !== ParameterDelimiters.Ampersand) &&
              (nextCharCode === GeneralDelimiters.Hash || nextCharCode === GeneralDelimiters.Slash || nextCharCode === ParameterDelimiters.Query)
          ) {
            isOptional = false
            return nodes
          }

          tokenStart = tokenEnd
          state = InternalExpression.None
          isOptional = false
          index = tokenEnd - 1
          continue
        }
        }
      }

      // Processamento de Tokens Gramaticais
      switch (charCode as AllValues) {
      case Operators.Not: {
        isOptional = true
        tokenStart = index + 1
        continue
      }

      case DynamicVariableDelimiters.Colon: {
        index = parseDelimitedExpression(InternalExpression.Variable, InternalExpression.Dynamic, InternalExpression.None)
        continue
      }

      case ParameterDelimiters.Query: {
        index = parseDelimitedExpression(InternalExpression.Parameter, ParameterDelimiters.Query, InternalExpression.None, 1, 0, false)
        continue
      }

      case GeneralDelimiters.Hash: {
        index = parseDelimitedExpression(InternalExpression.Fragment, GeneralDelimiters.Hash, ContentTypes.String)
        continue
      }

      case CatchAllExpression.Asterisk:
        nodes.push(new Node(
          this.nodeIdCounter++,
          InternalExpression.Wildcard,
          index,
          index + 1,
          currentCharacter
        ))
        break

      case DynamicVariableDelimiters.LeftBracket: {
        const isDoubleBracketOpen = this.input.charCodeAt(index + 1) === DynamicVariableDelimiters.LeftBracket
        const innerStartIndex = index + (isDoubleBracketOpen ? 2 : 1)

        let ellipsisDotCount = 0
        let ellipsisindex = innerStartIndex
        while (this.input.charAt(ellipsisindex) === '.') {
          ellipsisDotCount++
          ellipsisindex++
        }

        const isCatchAllSegment = ellipsisDotCount === 3

        if (ellipsisDotCount > 0 && ellipsisDotCount !== 3) {
          this.errors.push(new ErrorLog(
            'E_INVALID_CATCH_ALL',
            'Invalid catch-all syntax. Expected ‘...’ but found an incomplete sequence.',
            index,
            ellipsisindex
          ))
        }

        let blockStartOffset = isDoubleBracketOpen ? 2 : 1
        const blockEndOffset = isDoubleBracketOpen ? 2 : 1

        if (isCatchAllSegment) {
          blockStartOffset += 3
        } else if (ellipsisDotCount > 0) {
          blockStartOffset += ellipsisDotCount
        }

        if (isDoubleBracketOpen) isOptional = true

        const dynamicExpression = isCatchAllSegment
          ? (isDoubleBracketOpen ? InternalExpression.DynamicOptionalCatchAll : InternalExpression.DynamicCatchAll)
          : InternalExpression.Dynamic

        index = parseDelimitedExpression(InternalExpression.Variable, dynamicExpression, ContentTypes.String, blockStartOffset, blockEndOffset, true)
        continue
      }

      case DynamicVariableDelimiters.RightBracket: {
        const isDoubleBracketClose = this.input.charCodeAt(index + 1) === DynamicVariableDelimiters.RightBracket

        if (!isRootLevel) return nodes

        if (isDoubleBracketClose) index++
        break
      }
      }

      state = this.getState(charCode)
      tokenStart = index + 1
    }

    return nodes
  }

  getState(charCode: number): AllValues {
    switch (charCode) {
    case GeneralDelimiters.Slash: return InternalExpression.Path
    case Operators.TypeAnnotation: return InternalExpression.Type
    case Operators.Default: return InternalExpression.Default
    case ParameterDelimiters.Ampersand:
    case ParameterDelimiters.Semicolon: return InternalExpression.Parameter
    case CatchAllExpression.Asterisk: return InternalExpression.Wildcard
    case GeneralDelimiters.Comma: return InternalExpression.Dynamic
    case DynamicVariableDelimiters.LeftBracket:
    case ParameterDelimiters.Query:
    case GeneralDelimiters.Hash:
    case DynamicVariableDelimiters.Colon:
    case DynamicVariableDelimiters.RightBracket:
    default: return InternalExpression.None
    }
  }

  /**
   * Flattens the AST into `flatNodes` for faster subsequent lookups.
   */
  private flatten(nodes: Node[]) {
    for (const node of nodes) {
      this.flatNodes[node.id] = node
      this.expressions.add(node.expression)
      if (node.body.length > 0) this.flatten(node.body)
    }
  }

  /**
   * Returns nodes that belong to the origin layer (Protocol, Hostname, Port).
   */
  getOriginNodes(): { protocol?: Node, hostname?: Node, port?: Node } {
    let protocol: Node | undefined
    let hostname: Node | undefined
    let port: Node | undefined

    for (const node of this.nodes) {
      switch (node.expression) {
      case OriginExpression.Protocol: protocol = node; break
      case OriginExpression.Hostname: hostname = node; break
      case OriginExpression.Port: port = node; break
      }
    }

    return { protocol, hostname, port }
  }

  /**
   * Returns nodes that belong to the path layer (static and dynamic segments).
   */
  getPathNodes(): Node[] {
    const pathNodes: Node[] = []

    for (const node of this.nodes) {
      if (node.expression === ParameterDelimiters.Query || node.expression === GeneralDelimiters.Hash) break
      if (
        node.expression === OriginExpression.Protocol ||
        node.expression === OriginExpression.Hostname ||
        node.expression === OriginExpression.Port
      ) continue

      if (
        node.expression === InternalExpression.Path ||
        node.expression === InternalExpression.Dynamic ||
        node.expression === InternalExpression.DynamicCatchAll ||
        node.expression === InternalExpression.DynamicOptionalCatchAll ||
        node.expression === InternalExpression.Wildcard
      ) {
        pathNodes.push(node)
      }
    }

    return pathNodes
  }

  /**
   * Returns the query delimiter node (`ParameterDelimiters.Query`, 63) whose `body` holds query parameters.
   */
  getQueryNode(): Node | undefined {
    return this.nodes.find(n => n.expression === ParameterDelimiters.Query)
  }

  /**
   * Returns the fragment delimiter node (`GeneralDelimiters.Hash`, 35) whose `body` holds the hash payload.
   */
  getFragmentNode(): Node | undefined {
    return this.nodes.find(n => n.expression === GeneralDelimiters.Hash)
  }

  /**
   * Converts the AST to hierarchical JSON grouped by URL semantic layers.
   *
   * Shape:
   * - `type`: Always `"URLDeclaration"`
   * - `input`: Original input string
   * - `origin?`: `{ protocol?, hostname?, port? }` — origin components
   * - `path?`: `{ body: [...] }` — path segments
   * - `query?`: `{ body: [...] }` — query parameters
   * - `fragment?`: `{ body: [...] }` — fragment / hash
   *
   * @param {boolean} [humanReadable=false] When `true`, emits string labels for `kind` and `type` instead of numeric codes.
   *
   * @example
   * ```ts
   * ast.toJSON()             // kind: 251, type: 249
   * ast.toJSON(true)         // kind: "Path", type: "Number"
   * ```
   */
  toJSON(humanReadable: boolean = false): ASTJSON {
    const hr = humanReadable
    const result: ASTJSON = {
      type: 'URLDeclaration',
      input: this.input
    }

    const { protocol, hostname, port } = this.getOriginNodes()
    if (protocol || hostname || port) {
      const first = protocol ?? hostname ?? port!
      const last = port ?? hostname ?? protocol!
      result.origin = {
        type: 'OriginExpression',
        value: this.input.slice(first.start, last.end),
        loc: {
          start: { line: 1, column: first.start },
          end: { line: 1, column: last.end }
        }
      }
      if (protocol) result.origin.protocol = protocol.toJSON(hr)
      if (hostname) result.origin.hostname = hostname.toJSON(hr)
      if (port) result.origin.port = port.toJSON(hr)
    }

    const pathNodes = this.getPathNodes()
    if (pathNodes.length > 0) {
      const firstPath = pathNodes[0]!
      const lastPath = pathNodes[pathNodes.length - 1]!
      result.path = {
        type: 'PathExpression',
        value: this.input.slice(firstPath.start, lastPath.end),
        loc: {
          start: { line: 1, column: firstPath.start },
          end: { line: 1, column: lastPath.end }
        },
        body: pathNodes.map(n => n.toJSON(hr))
      }
    }

    const queryNode = this.getQueryNode()
    if (queryNode && queryNode.body.length > 0) {
      result.query = {
        type: 'QueryExpression',
        value: this.getContent(queryNode),
        loc: {
          start: { line: 1, column: queryNode.start },
          end: { line: 1, column: queryNode.end }
        },
        body: queryNode.body.map(n => n.toJSON(hr))
      }
    }

    const fragmentNode = this.getFragmentNode()
    if (fragmentNode && fragmentNode.body.length > 0) {
      result.fragment = {
        type: 'FragmentExpression',
        value: this.getContent(fragmentNode),
        loc: {
          start: { line: 1, column: fragmentNode.start },
          end: { line: 1, column: fragmentNode.end }
        },
        body: fragmentNode.body.map(n => n.toJSON(hr))
      }
    }

    return result
  }

  /**
   * Serializes the AST to a binary buffer.
   *
   * Buffer layout:
   * 1. Root node count (2 bytes, LE): number of root nodes.
   * 2. URL byte length (4 bytes, LE): UTF-8 byte length of the input string.
   * 3. Node data (variable): binary payload for each `Node` and its children, written recursively.
   * 4. URL string (`urlLength` bytes): original input encoded as UTF-8.
   *
   * @returns {Buffer} Buffer containing the serialized AST.
   */
  getBuffer(): Buffer {
    const urlBufferData = Buffer.from(this.input, 'utf-8')
    const rootNodeCount = this.nodes.length

    const calculateNodesSize = (nodesList: Node[]): number => {
      let totalSize = 0
      for (const node of nodesList) {
        totalSize += Node.SIZE + calculateNodesSize(node.body)
      }
      return totalSize
    }

    const totalNodesLength = calculateNodesSize(this.nodes)

    const finalBuffer = Buffer.alloc(2 + 4 + totalNodesLength + urlBufferData.length)
    let currentOffset = 0

    finalBuffer.writeUInt16LE(rootNodeCount, currentOffset)
    currentOffset += 2

    finalBuffer.writeUInt32LE(urlBufferData.length, currentOffset)
    currentOffset += 4

    for (const node of this.nodes) {
      currentOffset = node.writeToBuffer(finalBuffer, currentOffset)
    }

    urlBufferData.copy(finalBuffer, currentOffset)

    return finalBuffer
  }

  /**
   * Rebuilds an AST instance from a binary buffer produced by `getBuffer()`.
   *
   * Reads the root-count and URL-length headers, parses nodes recursively via `Node.fromBuffer`,
   * then decodes the trailing UTF-8 input string.
   *
   * @param {Buffer} buffer Buffer containing serialized AST data.
   * @returns {AST<string>} A new AST instance.
   */
  static fromBuffer(buffer: Buffer): AST<string> {
    let currentOffset = 0

    const rootNodeCount = buffer.readUInt16LE(currentOffset)
    currentOffset += 2

    const urlStringLength = buffer.readUInt32LE(currentOffset)
    currentOffset += 4

    const parsedData = Node.fromBuffer(buffer, currentOffset, rootNodeCount)
    const rootNodesList = parsedData.nodes
    currentOffset = parsedData.newOffset

    const sourceInputString = buffer.toString('utf-8', currentOffset, currentOffset + urlStringLength)

    return new AST(sourceInputString, { nodes: rootNodesList })
  }
}