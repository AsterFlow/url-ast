import { expect, describe, it } from 'bun:test'
import { AST } from '../src/controllers/AST'
import { ContentTypes, InternalExpression } from '../src/types/node'

describe('Controller: AST', () => {
  it('should return the correct node when using getNode by index', () => {
    const ast = new AST('/users/[id]')
    const node = ast.getNode(0)
    expect(node).toBeDefined()
    expect(ast.getContent(node!)).toBe('users')
  })

  it('should return the correct node when using getNode by name', () => {
    const ast = new AST('/users/[id]')
    const node = ast.getNode('users')
    expect(node).toBeDefined()
    expect(node?.id).toBe(0)
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
    const firstPath = ast.getNodeByType(InternalExpression.Path, 0)
    const secondPath = ast.getNodeByType(InternalExpression.Path, 1)

    expect(firstPath).toBeDefined()
    expect(firstPath!.start).toBe(1)

    expect(secondPath).toBeDefined()
    expect(secondPath!.start).toBe(12)
  })

  it('should return the content type of a parameter node when using getType', () => {
    const ast = new AST('/search?q=123')
    // Node with 'q' is a Parameter node.
    const paramNode = ast.getNode('q')
    expect(paramNode).toBeDefined()
    expect(paramNode?.expression).toBe(InternalExpression.Parameter)

    const type = ast.getType(paramNode!.id)
    expect(type).toBe(ContentTypes.String) // Default for Parameter is String
  })

  it('should return the content type of a variable node when using getType', () => {
    const ast = new AST('/:search')
    const variableNode = ast.getNode('search')
    expect(variableNode).toBeDefined()
    expect(variableNode?.expression).toBe(InternalExpression.Variable)

    const type = ast.getType(variableNode!.id)
    expect(type).toBe(ContentTypes.String)
  })

  it('should work for parameter nodes when using getType by name', () => {
    const ast = new AST('/search?q=true')
    const type = ast.getType('q')
    expect(type).toBe(ContentTypes.String)
  })

  it('should return InternalExpression.None when using getType for non-value/variable node', () => {
    const ast = new AST('/users')
    const type = ast.getType('users')
    expect(type).toBe(InternalExpression.None)
  })

  it('should extract the correct substring when using getContent', () => {
    const ast = new AST('/users/123')
    const node = ast.nodes[0] // 'users'
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
    // In current AST, if there is no '=', there is no value node following the parameter.
    expect(value).toBeUndefined()
  })

  it('should return a string when using toString()', () => {
    const ast = new AST('/users/[id]')
    const output = ast.toString()
    expect(typeof output).toBe('string')
    expect(output).toContain('Id')
    expect(output).toContain('Symbol')
    expect(output).toContain('Path:')
  })

  it('should serialize toJSON with origin, path, query, and fragment layers', () => {
    const input = 'https://example.com:8080/users/1?x=1&y=2#section'
    const ast = new AST(input)
    const json = ast.toJSON()

    expect(json.type).toBe('URLDeclaration')
    expect(json.input).toBe(input)
    expect(json.origin).toBeDefined()
    expect(json.origin?.protocol).toBeDefined()
    expect(json.origin?.hostname).toBeDefined()
    expect(json.origin?.port).toBeDefined()
    expect(json.path?.body?.length).toBeGreaterThan(0)
    expect(json.query?.body?.length).toBeGreaterThan(0)
    expect(json.fragment?.body?.length).toBeGreaterThan(0)
  })

  it('should serialize toJSON with human-readable kind and type labels', () => {
    const ast = new AST('/a?b=1')
    const raw = ast.toJSON(false)
    const hr = ast.toJSON(true)

    expect(typeof (raw.path?.body?.[0] as { kind: unknown }).kind).toBe('number')
    expect(typeof (hr.path?.body?.[0] as { kind: unknown }).kind).toBe('string')
  })
})
