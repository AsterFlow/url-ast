// tests/analyze.errors.test.ts

import { expect, describe, it } from 'bun:test'
import { Analyze } from '../src'

describe('Analyze: Error Handling and Validation', () => {
  it('should have no errors for a valid URL', () => {
    const analyzer = new Analyze('/users/[id]?active=true')
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

  it('displayErrors() should return a formatted error string', () => {
    const analyzer = new Analyze('/[:id]') // Erro de sintaxe no parser
    expect(analyzer.displayErrors()).toContain('Error [E_INVALID_SYNTAX]')
  })

  it('should detect unexpected tokens in the path', () => {
    const analyzer = new Analyze('/users/:id:other')
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors[0]?.code).toBe('E_INVALID_SYNTAX')
  })

  it('should detect unexpected consecutive slashes in the path', () => {
    const analyzer = new Analyze('//users')
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors[0]?.code).toBe('E_CONSECUTIVE_SLASHES')
  })
})