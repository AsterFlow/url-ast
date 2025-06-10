// tests/analyze.origin.test.ts

import { expect, describe, it } from 'bun:test'
import { Analyze } from '../src'

describe('Analyze: Origin and Base Path', () => {
  describe('getProtocol()', () => {
    it('should extract "http" from a URL', () => {
      const analyzer = new Analyze('http://example.com/path')
      expect(analyzer.getProtocol()).toBe('http')
    })

    it('should extract "https" from a URL', () => {
      const analyzer = new Analyze('https://sub.example.co.uk?q=1')
      expect(analyzer.getProtocol()).toBe('https')
    })

    it('should return undefined for a path-only URL', () => {
      const analyzer = new Analyze('/some/path/here')
      expect(analyzer.getProtocol()).toBeUndefined()
    })
  })

  describe('getHostname()', () => {
    it('should extract a simple hostname', () => {
      const analyzer = new Analyze('https://example.com/path')
      expect(analyzer.getHostname()).toBe('example.com')
    })

    it('should extract a hostname with subdomains', () => {
      const analyzer = new Analyze('http://api.v1.example.co.uk:8080')
      expect(analyzer.getHostname()).toBe('api.v1.example.co.uk')
    })

    it('should return undefined for a path-only URL', () => {
      const analyzer = new Analyze('/path/only')
      expect(analyzer.getHostname()).toBeUndefined()
    })
  })

  describe('getPort()', () => {
    it('should extract a port number', () => {
      const analyzer = new Analyze('http://localhost:8080/path')
      expect(analyzer.getPort()).toBe('8080')
    })

    it('should return undefined when no port is specified', () => {
      const analyzer = new Analyze('https://example.com/path')
      expect(analyzer.getPort()).toBeUndefined()
    })
  })

  describe('getPathname()', () => {
    it('should extract a simple path', () => {
      const analyzer = new Analyze('https://example.com/users/list')
      expect(analyzer.getPathname()).toBe('/users/list')
    })

    it('should return "/" for a root URL', () => {
      const analyzer = new Analyze('https://example.com')
      expect(analyzer.getPathname()).toBe('/')
    })

    it('should ignore query strings and fragments', () => {
      const analyzer = new Analyze('/path/to/resource?query=1#hash')
      expect(analyzer.getPathname()).toBe('/path/to/resource')
    })

    it('should reconstruct template paths with :param', () => {
      const analyzer = new Analyze('/users/:id/posts')
      expect(analyzer.getPathname()).toBe('/users/:id/posts')
    })

    it('should reconstruct template paths with [param]', () => {
      const analyzer = new Analyze('/users/[id]/posts')
      expect(analyzer.getPathname()).toBe('/users/[id]/posts')
    })

    it('should reconstruct template paths with [...slug]', () => {
      const analyzer = new Analyze('/files/[...files]/view')
      expect(analyzer.getPathname()).toBe('/files/[...files]/view')
    })
  })
})