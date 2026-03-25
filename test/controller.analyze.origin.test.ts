// tests/analyze.origin.test.ts

import { expect, describe, it } from 'bun:test'
import { Analyze } from '../src'

describe('Controller: Analyze (Origin)', () => {
  describe('getProtocol()', () => {
    it('should extract "http" from a URL', () => {
      const analyzer = new Analyze('http://example.com/path')
      expect(analyzer.getProtocol()).toBe('http')
    })

    it('should extract "https" from a URL', () => {
      const analyzer = new Analyze('https://sub.example.co.uk?q=1')
      expect(analyzer.getProtocol()).toBe('https')
    })

    it('should extract "ws" from a WebSocket URL', () => {
      const analyzer = new Analyze('ws://echo.websocket.org/chat')
      expect(analyzer.getProtocol()).toBe('ws')
    })

    it('should extract "wss" from a secure WebSocket URL', () => {
      const analyzer = new Analyze('wss://secure.example.com:443/stream')
      expect(analyzer.getProtocol()).toBe('wss')
    })

    it('should extract "ftp" from an FTP URL', () => {
      const analyzer = new Analyze('ftp://files.example.com/docs/report.pdf')
      expect(analyzer.getProtocol()).toBe('ftp')
    })

    it('should extract "mqtt" from an MQTT URL', () => {
      const analyzer = new Analyze('mqtt://broker.hivemq.com:1883')
      expect(analyzer.getProtocol()).toBe('mqtt')
    })

    it('should extract "redis" from a Redis URL', () => {
      const analyzer = new Analyze('redis://localhost:6379')
      expect(analyzer.getProtocol()).toBe('redis')
    })

    it('should extract "postgresql" from a PostgreSQL URL', () => {
      const analyzer = new Analyze('postgresql://db.host:5432/mydb')
      expect(analyzer.getProtocol()).toBe('postgresql')
    })

    it('should return undefined for protocol when using a path-only URL', () => {
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

    it('should extract hostname from ws:// URL', () => {
      const analyzer = new Analyze('ws://echo.websocket.org/chat')
      expect(analyzer.getHostname()).toBe('echo.websocket.org')
    })

    it('should extract hostname from ftp:// URL', () => {
      const analyzer = new Analyze('ftp://files.example.com/docs')
      expect(analyzer.getHostname()).toBe('files.example.com')
    })

    it('should extract IPv4 address as hostname', () => {
      const analyzer = new Analyze('http://192.168.1.1:8080/admin')
      expect(analyzer.getHostname()).toBe('192.168.1.1')
    })

    it('should extract IPv4 loopback as hostname', () => {
      const analyzer = new Analyze('http://127.0.0.1:3000/health')
      expect(analyzer.getHostname()).toBe('127.0.0.1')
    })

    it('should extract private network IPv4 as hostname', () => {
      const analyzer = new Analyze('http://10.0.0.1/api/v1')
      expect(analyzer.getHostname()).toBe('10.0.0.1')
    })

    it('should return undefined for hostname when using a path-only URL', () => {
      const analyzer = new Analyze('/path/only')
      expect(analyzer.getHostname()).toBeUndefined()
    })
  })

  describe('getPort()', () => {
    it('should extract a port number', () => {
      const analyzer = new Analyze('http://localhost:8080/path')
      expect(analyzer.getPort()).toBe('8080')
    })

    it('should extract port from wss:// URL', () => {
      const analyzer = new Analyze('wss://secure.example.com:443/stream')
      expect(analyzer.getPort()).toBe('443')
    })

    it('should extract port from mqtt:// URL', () => {
      const analyzer = new Analyze('mqtt://broker.hivemq.com:1883')
      expect(analyzer.getPort()).toBe('1883')
    })

    it('should extract port from redis:// URL', () => {
      const analyzer = new Analyze('redis://localhost:6379')
      expect(analyzer.getPort()).toBe('6379')
    })

    it('should extract port from IPv4 URL', () => {
      const analyzer = new Analyze('http://192.168.1.1:8080/admin')
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

  describe('Full Origin Extraction (protocol + hostname + port + path)', () => {
    it('should parse a complete ws:// URL', () => {
      const analyzer = new Analyze('ws://echo.websocket.org/chat')
      expect(analyzer.getProtocol()).toBe('ws')
      expect(analyzer.getHostname()).toBe('echo.websocket.org')
      expect(analyzer.getPort()).toBeUndefined()
      expect(analyzer.getPathname()).toBe('/chat')
    })

    it('should parse a complete wss:// URL with port', () => {
      const analyzer = new Analyze('wss://secure.example.com:443/stream')
      expect(analyzer.getProtocol()).toBe('wss')
      expect(analyzer.getHostname()).toBe('secure.example.com')
      expect(analyzer.getPort()).toBe('443')
      expect(analyzer.getPathname()).toBe('/stream')
    })

    it('should parse a complete ftp:// URL with deep path', () => {
      const analyzer = new Analyze('ftp://files.example.com/docs/report.pdf')
      expect(analyzer.getProtocol()).toBe('ftp')
      expect(analyzer.getHostname()).toBe('files.example.com')
      expect(analyzer.getPathname()).toBe('/docs/report.pdf')
    })

    it('should parse a redis:// URL without path', () => {
      const analyzer = new Analyze('redis://localhost:6379')
      expect(analyzer.getProtocol()).toBe('redis')
      expect(analyzer.getHostname()).toBe('localhost')
      expect(analyzer.getPort()).toBe('6379')
      expect(analyzer.getPathname()).toBe('/')
    })

    it('should parse a postgresql:// URL with path', () => {
      const analyzer = new Analyze('postgresql://db.host:5432/mydb')
      expect(analyzer.getProtocol()).toBe('postgresql')
      expect(analyzer.getHostname()).toBe('db.host')
      expect(analyzer.getPort()).toBe('5432')
      expect(analyzer.getPathname()).toBe('/mydb')
    })

    it('should parse an IPv4 URL with port and path', () => {
      const analyzer = new Analyze('http://192.168.1.1:8080/admin/dashboard')
      expect(analyzer.getProtocol()).toBe('http')
      expect(analyzer.getHostname()).toBe('192.168.1.1')
      expect(analyzer.getPort()).toBe('8080')
      expect(analyzer.getPathname()).toBe('/admin/dashboard')
    })

    it('should parse an IPv4 loopback URL with query', () => {
      const analyzer = new Analyze('http://127.0.0.1:3000/api?debug=true')
      expect(analyzer.getProtocol()).toBe('http')
      expect(analyzer.getHostname()).toBe('127.0.0.1')
      expect(analyzer.getPort()).toBe('3000')
      expect(analyzer.getPathname()).toBe('/api')
    })

    it('should parse mqtt:// with port and no path', () => {
      const analyzer = new Analyze('mqtt://broker.hivemq.com:1883')
      expect(analyzer.getProtocol()).toBe('mqtt')
      expect(analyzer.getHostname()).toBe('broker.hivemq.com')
      expect(analyzer.getPort()).toBe('1883')
      expect(analyzer.getPathname()).toBe('/')
    })

    it('should produce no errors for any valid scheme:// URL', () => {
      const urls = [
        'ws://host/path',
        'wss://host:443/path',
        'ftp://host/path',
        'mqtt://host:1883',
        'redis://host:6379',
        'postgresql://host:5432/db',
        'http://10.0.0.1/api',
        'http://192.168.1.1:8080/admin',
      ]
      for (const url of urls) {
        const analyzer = new Analyze(url)
        expect(analyzer.hasErrors()).toBe(false)
      }
    })
  })
})