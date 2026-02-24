import { CatchAllExpression, ContentTypes, Delimiters, delimitersValues, EncodingSymbols, InternalExpression, OriginExpression, RawTokens, type AllValues } from '../types/node'
import { AnsiColor, colorize, expressionKeyColorMap } from '../utils/colors'
import { colorizePath, renderTable } from '../utils/table'
import { ErrorLog } from './Error'
import { Node } from './Node'

export class AST<const Path extends string>{
  readonly expressions: Set<number>
  readonly input: Path
  readonly nodes: Node[]

  constructor(input: Path, readonly errors: ErrorLog[] = []) {
    this.input = input
  
    const { expressions, nodes } = this.parser(this.input, this.errors)
    this.nodes = nodes
    this.expressions = expressions
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
   */
  getType(idOrName: string | number, nodes: Node[] = this.nodes, input?: string) {
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

  parser (input: string, errors: ErrorLog[]) {
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
      const isGrammarToken =
        code === Delimiters.Hash
        || code === Delimiters.Slash
        || code === Delimiters.Ampersand
        || code === Delimiters.Semicolon
        || code === Delimiters.Query
        || code === Delimiters.Colon
        || code === Delimiters.Asterisk
        || code === Delimiters.LeftBracket
        || code === Delimiters.RightBracket
        || code === EncodingSymbols.Equal

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

      if (!isGrammarToken) {
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
}