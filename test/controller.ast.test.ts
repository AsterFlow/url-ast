import { expect, describe, it } from 'bun:test'
import { AST } from '../src/controllers/AST'
import { ContentTypes, InternalExpression } from '../src/types/node'

describe('Controller: AST', () => {
  it('should return the correct node when using getNode by index', () => {
    const ast = new AST('/users/[id]')
    const node = ast.getNode(1)
    expect(node).toBeDefined()
    expect(ast.getContent(node!)).toBe('users')
  })

  it('should return the correct node when using getNode by name', () => {
    const ast = new AST('/users/[id]')
    const node = ast.getNode('users')
    expect(node).toBeDefined()
    expect(node?.id).toBe(1)
  })

  it('should return undefined when using getNode with non-existent id', () => {
    const ast = new AST('/users/[id]')
    const node = ast.getNode(99)
    expect(node).toBeUndefined()
  })

  it('should return undefined when using getNode with non-existent name', () => {
    const ast = new AST('/users/[id]')
    const node = ast.getNode('nonexistent')
    expect(node).toBeUndefined()
  })

  it('should return the correct occurrence when using getNodeByType', () => {
    const ast = new AST('/users/[id]/posts/[postId]')
    // InternalExpression.Path is 'users', 'posts', etc.
    // In '/users/[id]/posts/[postId]':
    // Node 0: '/' (Slash)
    // Node 1: 'users' (Path) - start: 1
    // Node 2: '/' (Slash)
    // Node 3: '[' (LeftBracket)
    // Node 4: 'id' (Slug)
    // Node 5: ']' (RightBracket)
    // Node 6: '/' (Slash)
    // Node 7: 'posts' (Path) - start: 12
    const firstPath = ast.getNodeByType(InternalExpression.Path, 0)
    const secondPath = ast.getNodeByType(InternalExpression.Path, 1)
    
    expect(firstPath).toBeDefined()
    expect(secondPath).toBeDefined()
    expect(firstPath?.start).toBe(1)
    expect(secondPath?.start).toBe(12)
  })

  it('should return the content type of a value node when using getType', () => {
    const ast = new AST('/search?q=123')
    // Node with '123' is the Value node.
    const valueNode = ast.getNode('123')
    expect(valueNode).toBeDefined()
    expect(valueNode?.expression).toBe(InternalExpression.Value)

    const type = ast.getType(valueNode!.id)
    expect(type).toBe(ContentTypes.String) // Default for Value is String
  })

  it('should return the content type of a variable value node when using getType', () => {
    const ast = new AST('/:search')
    const variableNode = ast.getNode('search')
    expect(variableNode).toBeDefined()
    expect(variableNode?.expression).toBe(InternalExpression.Variable)

    const type = ast.getType(variableNode!.id)
    expect(type).toBe(ContentTypes.String)
  })

  it('should work for value nodes when using getType by name', () => {
    const ast = new AST('/search?q=true')
    const type = ast.getType('true')
    expect(type).toBe(ContentTypes.String)
  })

  it('should return InternalExpression.Null when using getType for non-value node', () => {
    const ast = new AST('/users')
    const type = ast.getType('users')
    expect(type).toBe(InternalExpression.Null)
  })

  it('should extract the correct substring when using getContent', () => {
    const ast = new AST('/users/123')
    const node = ast.nodes[1] // 'users'
    expect(ast.getContent(node!)).toBe('users')
  })

  it('should return the value after a parameter when using getValue', () => {
    const ast = new AST('/search?q=hello')
    const value = ast.getValue('q')
    expect(value).toBe('hello')
  })

  it('should return undefined when using getValue for non-parameter node', () => {
    const ast = new AST('/users/123')
    const value = ast.getValue('users')
    expect(value).toBeUndefined()
  })

  it('should return undefined when using getValue for parameter without value', () => {
    const ast = new AST('/search?q')
    const value = ast.getValue('q')
    expect(value).toBeUndefined()
  })

  it('should return a string when using display()', () => {
    const ast = new AST('/users/[id]')
    const output = ast.display()
    expect(typeof output).toBe('string')
    expect(output).toContain('Id')
    expect(output).toContain('Symbol')
    expect(output).toContain('Path:')
  })
})
