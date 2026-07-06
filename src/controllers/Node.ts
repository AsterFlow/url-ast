import type { NodeJSON } from '../types/ast'
import { ContentTypes, InternalExpression, SemanticTokens, type AllValues } from '../types/node'
import { toView } from '../utils/binary'

export class Node {
  static readonly SIZE = 10 as const

  public body: Node[] = []

  constructor(
    /**
     * 1 Byte
     */
    public readonly id: number,
    /**
     * 1 Byte
     */
    public expression: AllValues = InternalExpression.None,
    /**
     * 2 Bytes
     */
    public start: number = 0,
    /**
     * 2 Bytes
     */
    public end: number = 0,
    /**
     * String value carried by the node.
     */
    public value: string = '',
    /**
     * 1 Byte
     */
    public type: ContentTypes | InternalExpression.None = 
    [InternalExpression.Parameter, InternalExpression.Variable].includes(expression as number)
      ? ContentTypes.String
      : InternalExpression.None,
    /**
     * 1 Byte
     */
    public optional: boolean = false
  ) {}

  setExpression(expression: AllValues) {
    this.expression = expression
    return this
  }

  setType(type: ContentTypes) {
    this.type = type
    return this
  }

  setPosition(start: number, end: number) {
    this.start = start
    this.end = end

    return this
  }

  setValue(value: string) {
    this.value = value

    return this
  }

  setBody(body: Node[]) {
    this.body = body

    return this
  }

  setOptional(isOptional: boolean) {
    this.optional = isOptional
    return this
  }

  toJSON(humanReadable: boolean = false): NodeJSON {
    const resolveToken = (code: number): number | string =>
      humanReadable ? (SemanticTokens[code] ?? code) : code

    return {
      id: this.id,
      kind: resolveToken(this.expression),
      value: this.value,
      optional: this.optional === false ? undefined : this.optional,
      type: this.type === 0 ? undefined : resolveToken(this.type),
      body: this.body.length === 0 ? undefined : this.body.map((child) => child.toJSON(humanReadable)),
      loc: {
        start: { line: 1, column: this.start },
        end: { line: 1, column: this.end }
      }
    }
  }

  /**
   * Recursively writes this node and its descendants into a binary buffer.
   *
   * @param {Uint8Array} buffer Target buffer (a Node `Buffer` is also accepted).
   * @param {number} currentOffset Current write offset.
   * @returns {number} Next offset after this subtree has been written.
   */
  writeToBuffer(buffer: Uint8Array, currentOffset: number): number {
    const view = toView(buffer)
    view.setUint8(currentOffset, this.id)
    view.setUint8(currentOffset + 1, this.expression)
    view.setUint16(currentOffset + 2, this.start, true)
    view.setUint16(currentOffset + 4, this.end, true)
    view.setUint8(currentOffset + 6, this.type)
    view.setUint8(currentOffset + 7, this.optional ? 1 : 0)
    view.setUint16(currentOffset + 8, this.body.length, true)

    let nextOffset = currentOffset + Node.SIZE

    for (const childNode of this.body) {
      nextOffset = childNode.writeToBuffer(buffer, nextOffset)
    }

    return nextOffset
  }

  /**
   * Recursively reads nodes and their children from a binary buffer.
   *
   * @param {Uint8Array} buffer Source buffer (a Node `Buffer` is also accepted).
   * @param {number} currentOffset Starting offset.
   * @param {number} nodeCount Number of sibling nodes to read at this level.
   * @returns {{ nodes: Node[], newOffset: number }} Parsed nodes and the offset after them.
   */
  static fromBuffer(buffer: Uint8Array, currentOffset: number = 0, nodeCount: number): { nodes: Node[], newOffset: number } {
    const view = toView(buffer)
    const parsedNodes: Node[] = []
    let nextOffset = currentOffset

    for (let index = 0; index < nodeCount; index++) {
      const nodeId = view.getUint8(nextOffset)
      const nodeExpression = view.getUint8(nextOffset + 1)
      const nodeStart = view.getUint16(nextOffset + 2, true)
      const nodeEnd = view.getUint16(nextOffset + 4, true)
      const nodeType = view.getUint8(nextOffset + 6)
      const nodeOptional = view.getUint8(nextOffset + 7) === 1
      const childrenCount = view.getUint16(nextOffset + 8, true)

      nextOffset += Node.SIZE

      const currentNode = new Node(nodeId, nodeExpression, nodeStart, nodeEnd, '', nodeType, nodeOptional)

      if (childrenCount > 0) {
        const childrenData = Node.fromBuffer(buffer, nextOffset, childrenCount)
        currentNode.setBody(childrenData.nodes)
        nextOffset = childrenData.newOffset
      }

      parsedNodes.push(currentNode)
    }

    return { nodes: parsedNodes, newOffset: nextOffset }
  }
}