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
    const template = new Analyze('?age.number')
    const instance = new Analyze('?age=twenty', template)
    // O erro é lançado como exceção durante a chamada a getSearchParams
    expect(() => instance.getSearchParams()).toThrow()
  })

  it('should return a formatted error string from formatErrors()', () => {
    const analyzer = new Analyze('/:id:extra') // Erro de sintaxe no parser
    expect(analyzer.formatErrors()).toContain('Error [E_INVALID_SYNTAX]')
  })

  it('should detect unexpected tokens in the path', () => {
    const analyzer = new Analyze('/users/:id:other')
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors[0]?.code).toBe('E_INVALID_SYNTAX')
  })

  it('should detect unexpected token after catch-all', () => {
    // Current parser checks for Slash after catch-all
    const analyzer = new Analyze('/[...slug]/extra')
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.some(e => e.code === 'E_INVALID_SYNTAX')).toBe(true)
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
    expect(analyzer.errors.some(e => e.code === 'E_INVALID_SYNTAX' && e.message.includes("Use '.' to define a type"))).toBe(true)
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

  it('should detect E_DECODE_URI for incomplete 2-byte Latin sequence', () => {
    const analyzer = new Analyze('/:name%C3')
    analyzer.getParams()
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.some(e => e.code === 'E_DECODE_URI')).toBe(true)
  })

  it('should detect E_DECODE_URI for incomplete 3-byte CJK sequence', () => {
    const analyzer = new Analyze('/:text%E4%BD')
    analyzer.getParams()
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.some(e => e.code === 'E_DECODE_URI')).toBe(true)
  })

  it('should detect E_DECODE_URI for incomplete 4-byte emoji sequence', () => {
    const analyzer = new Analyze('/:emoji%F0%9F%8E')
    analyzer.getParams()
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.some(e => e.code === 'E_DECODE_URI')).toBe(true)
  })

  it('should detect E_DECODE_URI for invalid continuation byte in Latin', () => {
    const analyzer = new Analyze('/:word%C3%FF')
    analyzer.getParams()
    expect(analyzer.hasErrors()).toBe(true)
    expect(analyzer.errors.some(e => e.code === 'E_DECODE_URI')).toBe(true)
  })

  describe('Enum type annotation (bracket syntax) errors', () => {
    it('should report E_INVALID_SYNTAX when enum `[` is not closed in query', () => {
      const analyzer = new Analyze('?role.enum[Admin,User')
      expect(analyzer.hasErrors()).toBe(true)
      expect(
        analyzer.errors.some(
          e =>
            e.code === 'E_INVALID_SYNTAX'
            && e.message.includes("Unclosed '[' in enum type annotation")
        )
      ).toBe(true)
    })

    it('should report E_INVALID_SYNTAX when enum `[` is not closed in path', () => {
      const analyzer = new Analyze('/items/:status.enum[active,pending')
      expect(analyzer.hasErrors()).toBe(true)
      expect(
        analyzer.errors.some(
          e =>
            e.code === 'E_INVALID_SYNTAX'
            && e.message.includes("Unclosed '[' in enum type annotation")
        )
      ).toBe(true)
    })

    it('should report E_INVALID_SYNTAX for `enum[` with no closing bracket', () => {
      const analyzer = new Analyze('?flag.enum[')
      expect(analyzer.hasErrors()).toBe(true)
      expect(
        analyzer.errors.some(
          e =>
            e.code === 'E_INVALID_SYNTAX'
            && e.message.includes("Unclosed '[' in enum type annotation")
        )
      ).toBe(true)
    })

    it('should throw E_CAST_ENUM when query value is not listed in the template enum', () => {
      const template = new Analyze('/users/?role.enum[Admin,User]')
      const instance = new Analyze('/users/?role=Guest', template)
      expect(() => instance.getSearchParams()).toThrow(/E_CAST_ENUM/)
    })

    it('should throw E_CAST_ENUM when path value is not listed in the template enum', () => {
      const template = new Analyze('/items/:status.enum[active,pending]')
      const instance = new Analyze('/items/archived', template)
      expect(() => instance.getParams()).toThrow(/E_CAST_ENUM/)
    })

    it('should throw E_CAST_ENUM when one comma-separated value is not allowed', () => {
      const template = new Analyze('?tags.enum[a,b,c]')
      const instance = new Analyze('?tags=a,z', template)
      expect(() => instance.getSearchParams()).toThrow(/E_CAST_ENUM/)
    })

    it('should throw E_CAST_ENUM when template declares enum[] but instance sends a value', () => {
      const template = new Analyze('?x.enum[]')
      const instance = new Analyze('?x=any', template)
      expect(() => instance.getSearchParams()).toThrow(/E_CAST_ENUM/)
    })
  })
})
