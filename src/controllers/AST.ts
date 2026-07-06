import type { ASTOptionalOptions, ASTJSON, DisplayRow } from '../types/ast'
import { GeneralDelimiters, InternalExpression, OriginExpression, ParameterDelimiters, RawTokens, type AllValues } from '../types/node'
import { AnsiColor, colorize, expressionKeyColorMap } from '../utils/colors'
import { colorizePath, renderTable } from '../utils/table'
import { parsePathWasm } from '../wasmBridge'
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

  constructor(input: Path, options?: ASTOptionalOptions) {
    this.input = input

    if (options?.nodes) {
      // Reconstruction path (e.g. fromBuffer): nodes are already parsed.
      this.nodes = options.nodes
    } else {
      // Engine path: parse in Rust/WASM and decode the shared-memory buffer.
      const result = parsePathWasm(input)
      this.nodes = result.nodes
      for (const error of result.errors) this.errors.push(error)
    }

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
   * Prints a formatted node table and colorizes the path segment of the output.
   */
  toString(nodes: Node[] = this.nodes, input: string = this.input): string {
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