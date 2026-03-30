import type { NodeJSON } from '../types/ast'
import { ContentTypes, InternalExpression, SemanticTokens, type AllValues } from '../types/node'

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
   * @param {Buffer} buffer Target buffer.
   * @param {number} currentOffset Current write offset.
   * @returns {number} Next offset after this subtree has been written.
   */
  writeToBuffer(buffer: Buffer, currentOffset: number): number {
    buffer.writeUInt8(this.id, currentOffset)
    buffer.writeUInt8(this.expression, currentOffset + 1)
    buffer.writeUInt16LE(this.start, currentOffset + 2)
    buffer.writeUInt16LE(this.end, currentOffset + 4)
    buffer.writeUInt8(this.type, currentOffset + 6)
    buffer.writeUInt8(this.optional ? 1 : 0, currentOffset + 7)
    buffer.writeUInt16LE(this.body.length, currentOffset + 8)

    let nextOffset = currentOffset + Node.SIZE

    for (const childNode of this.body) {
      nextOffset = childNode.writeToBuffer(buffer, nextOffset)
    }

    return nextOffset
  }

  /**
   * Recursively reads nodes and their children from a binary buffer.
   *
   * @param {Buffer} buffer Source buffer.
   * @param {number} currentOffset Starting offset.
   * @param {number} nodeCount Number of sibling nodes to read at this level.
   * @returns {{ nodes: Node[], newOffset: number }} Parsed nodes and the offset after them.
   */
  static fromBuffer(buffer: Buffer, currentOffset: number = 0, nodeCount: number): { nodes: Node[], newOffset: number } {
    const parsedNodes: Node[] = []
    let nextOffset = currentOffset

    for (let index = 0; index < nodeCount; index++) {
      const nodeId = buffer.readUInt8(nextOffset)
      const nodeExpression = buffer.readUInt8(nextOffset + 1)
      const nodeStart = buffer.readUInt16LE(nextOffset + 2)
      const nodeEnd = buffer.readUInt16LE(nextOffset + 4)
      const nodeType = buffer.readUInt8(nextOffset + 6)
      const nodeOptional = buffer.readUInt8(nextOffset + 7) === 1
      const childrenCount = buffer.readUInt16LE(nextOffset + 8)
  
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