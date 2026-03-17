import { expect, describe, it } from 'bun:test'
import { Analyze } from '../src'

describe('Controller: Analyze (Errors)', () => {
  it('should have no errors for a valid URL', () => {
    const analyzer = new Analyze('/users/[id]?active=true')
    expect(analyzer.hasErrors()).toBe(false)
  })

  it('should have no errors when calling hasErrors without arguments', () => {
    const analyzer = new Analyze('/')
    expect(analyzer.hasErrors()).toBe(false)
  })

  it('should detect and report duplicate `:param` errors', () => {
    const analyzer = new Analyze('/users/:id/posts/:id')
    // O erro é registrado durante a chamada a getParams
    analyzer.getParams()
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.length).toBe(1)
    expect(analyzer.errors[0]?.code).toBe('E_DUPLICATE_PARAM')
  })

  it('should detect and report invalid catch-all syntax `[..slug]`', () => {
    const analyzer = new Analyze('/files/[..slug]')
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors[0]?.code).toBe('E_INVALID_CATCH_ALL')
  })

  it('should detect and report casting errors', () => {
    const template = new Analyze('?age=number')
    const instance = new Analyze('?age=twenty', template)
    // O erro é lançado como exceção durante a chamada a getSearchParams
    expect(() => instance.getSearchParams()).toThrow()
  })

  it('should return a formatted error string from displayErrors()', () => {
    const analyzer = new Analyze('/[:id]') // Erro de sintaxe no parser
    expect(analyzer.displayErrors()).toContain('Error [E_INVALID_SYNTAX]')
  })

  it('should detect unexpected tokens in the path', () => {
    const analyzer = new Analyze('/users/:id:other')
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors[0]?.code).toBe('E_INVALID_SYNTAX')
  })

  it('should detect unexpected token after catch-all', () => {
    const analyzer = new Analyze('/[...slug]*extra')
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.some(e => e.code === 'E_UNEXPECTED_TOKEN')).toBe(true)
  })

  it('should detect invalid syntax inside dynamic segment', () => {
    // Parser triggers E_INVALID_SYNTAX when it finds a delimiter inside []
    const analyzer = new Analyze('/[id/extra]')
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.some(e => e.code === 'E_INVALID_SYNTAX')).toBe(true)
  })

  it('should detect invalid syntax after path segment', () => {
    const analyzer = new Analyze('/user&')
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.some(e => e.code === 'E_INVALID_SYNTAX')).toBe(true)
  })

  it('should detect invalid syntax after search parameter', () => {
    const analyzer = new Analyze('?q/')
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.some(e => e.code === 'E_INVALID_SYNTAX')).toBe(true)
  })

  it('should detect and report error when search parameter is followed by a variable (colon)', () => {
    const analyzer = new Analyze('?q:number=123')
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.some(e => e.code === 'E_INVALID_SYNTAX' && e.message.includes('variable (\':\')'))).toBe(true)
  })

  it('should detect unexpected consecutive slashes in the path', () => {
    const analyzer = new Analyze('//users')
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.some(e => e.code === 'E_CONSECUTIVE_SLASHES')).toBe(true)
  })

  it('should detect and report E_DECODE_URI errors', () => {
    // getParams decodes variables. :q%ZZ should fail to decode %ZZ.
    const analyzer = new Analyze('/:q%ZZ')
    analyzer.getParams()
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.some(e => e.code === 'E_DECODE_URI')).toBe(true)
  })
})
