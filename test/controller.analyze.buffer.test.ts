import { expect, describe, it } from 'bun:test'
import { Analyze } from '../src'

describe('Controller: Analyze (Buffer Serialization)', () => {
  it('should return a Buffer with the correct structure', () => {
    const analyzer = new Analyze('/some/path')
    const buffer = analyzer.getBuffer()
    expect(buffer).toBeInstanceOf(Buffer)
    
    // Format: 4 (astLength) + astBuffer + 1 (hasBase)
    const astBufferLength = buffer.readUInt32LE(0)
    expect(buffer.length).toBe(4 + astBufferLength + 1)
  })

  it('should serialize and reconstruct a basic static URL', () => {
    const original = new Analyze('https://example.com/path/to/page')
    const buffer = original.getBuffer()
    const reconstructed = Analyze.fromBuffer(buffer)

    expect(reconstructed.input).toBe(original.input)
    expect(reconstructed.getProtocol()).toBe('https')
    expect(reconstructed.getHostname()).toBe('example.com')
    expect(reconstructed.getPathname()).toBe('/path/to/page')
    expect(reconstructed.ast.nodes.length).toBe(original.ast.nodes.length)
  })

  it('should serialize and reconstruct a template with path parameters', () => {
    const original = new Analyze('/users/:id=number/posts/:postId')
    const buffer = original.getBuffer()
    const reconstructed = Analyze.fromBuffer(buffer)

    expect(reconstructed.input).toBe(original.input)
    expect(reconstructed.getParams()).toEqual(['id', 'postId'])
    expect(reconstructed.getPathname()).toBe('/users/:id/posts/:postId')
  })

  it('should serialize and reconstruct an instance with a base parser (Recursive)', () => {
    const template = new Analyze('http://localhost:3000/api/:version/users/:id=number?active=boolean')
    const original = new Analyze('http://localhost:3000/api/v1/users/42?active=true', template)
    
    const buffer = original.getBuffer()
    const reconstructed = Analyze.fromBuffer(buffer)

    expect(reconstructed.input).toBe(original.input)
    expect(reconstructed.base).toBeDefined()
    expect(reconstructed.base?.input).toBe(template.input)
    expect(reconstructed.getParams()).toEqual({ version: 'v1', id: 42 })
    expect(reconstructed.getSearchParams()).toEqual({ active: true })
  })

  it('should serialize and reconstruct URLs with fragments', () => {
    const template = new Analyze('/docs#section')
    const original = new Analyze('/docs#introduction', template)
    
    const buffer = original.getBuffer()
    const reconstructed = Analyze.fromBuffer(buffer)

    expect(reconstructed.getFragment()).toEqual({ section: 'introduction' })
  })

  it('should handle complex URLs with nested base parsers', () => {
    const deepBase = new Analyze('https://:sub.example.com')
    const midBase = new Analyze('https://api.example.com/:resource', deepBase)
    const original = new Analyze('https://api.example.com/users', midBase)

    const buffer = original.getBuffer()
    const reconstructed = Analyze.fromBuffer(buffer)

    expect(reconstructed.base?.input).toBe(midBase.input)
    expect(reconstructed.base?.base?.input).toBe(deepBase.input)
    expect(reconstructed.getParams()).toEqual({ resource: 'users' })
  })

  it('should handle error state (errors are NOT serialized)', () => {
    const original = new Analyze('/invalid/path/consecutive//slashes')
    expect(original.errors.length).toBeGreaterThan(0)

    const buffer = original.getBuffer()
    const reconstructed = Analyze.fromBuffer(buffer)

    expect(reconstructed.input).toBe(original.input)
    expect(reconstructed.errors.length).toBe(0)
  })

  it('should serialize and reconstruct catch-all segments', () => {
    const template = new Analyze('/files/[...path]')
    const original = new Analyze('/files/images/vacation/summer.jpg', template)
    
    const buffer = original.getBuffer()
    const reconstructed = Analyze.fromBuffer(buffer)

    expect(reconstructed.getStaticProps()).toEqual({
      path: ['images', 'vacation', 'summer.jpg']
    })
  })
})
