import { expect, describe, it } from 'bun:test'
import { Node } from '../src/controllers/Node'
import { ContentTypes, InternalExpression } from '../src/types/node'

describe('Controller: Node', () => {
  it('should create a new Node with default values', () => {
    const node = new Node(1)
    expect(node.id).toBe(1)
    expect(node.expression).toBe(InternalExpression.Null)
    expect(node.start).toBe(0)
    expect(node.end).toBe(0)
    expect(node.type).toBe(InternalExpression.Null)
  })

  it('should update expression and return this when using setExpression()', () => {
    const node = new Node(1)
    const result = node.setExpression(InternalExpression.Path)
    expect(node.expression).toBe(InternalExpression.Path)
    expect(result).toBe(node)
  })

  it('should update type and return this when using setType()', () => {
    const node = new Node(1)
    const result = node.setType(ContentTypes.Number)
    expect(node.type).toBe(ContentTypes.Number)
    expect(result).toBe(node)
  })

  it('should update start and end and return this when using setPosition()', () => {
    const node = new Node(1)
    const result = node.setPosition(10, 20)
    expect(node.start).toBe(10)
    expect(node.end).toBe(20)
    expect(result).toBe(node)
  })

  it('should work correctly when using writeToBuffer and fromBuffer', () => {
    const node1 = new Node(1, InternalExpression.Path, 10, 20, InternalExpression.Null)
    const node2 = new Node(2, InternalExpression.Value, 25, 30, ContentTypes.Number)
    
    const buffer = Buffer.alloc(Node.SIZE * 2)
    node1.writeToBuffer(buffer, 0)
    node2.writeToBuffer(buffer, Node.SIZE)

    const nodes = Node.fromBuffer(buffer)
    expect(nodes).toHaveLength(2)
    
    expect(nodes[0]!.id).toBe(1)
    expect(nodes[0]!.expression).toBe(InternalExpression.Path)
    expect(nodes[0]!.start).toBe(10)
    expect(nodes[0]!.end).toBe(20)
    expect(nodes[0]!.type).toBe(InternalExpression.Null)

    expect(nodes[1]!.id).toBe(2)
    expect(nodes[1]!.expression).toBe(InternalExpression.Value)
    expect(nodes[1]!.start).toBe(25)
    expect(nodes[1]!.end).toBe(30)
    expect(nodes[1]!.type).toBe(ContentTypes.Number)
  })
})
