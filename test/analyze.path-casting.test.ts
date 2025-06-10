// tests/analyze.path-casting.test.ts

import { expect, describe, it } from 'bun:test'
import { Analyze } from '../src'

describe('Analyze: Path Parameter Type Casting', () => {
  describe('Number Casting', () => {
    it('should cast path parameter to number', () => {
      const template = new Analyze('/users/:id=number')
      const instance = new Analyze('/users/100', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ id: 100 })
      expect(typeof params.id).toBe('number')
    })

    it('should cast negative numbers correctly', () => {
      const template = new Analyze('/api/:value=number')
      const instance = new Analyze('/api/-42', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ value: -42 })
    })

    it('should cast decimal numbers correctly', () => {
      const template = new Analyze('/price/:amount=number')
      const instance = new Analyze('/price/99.99', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ amount: 99.99 })
    })

    it('should handle casting error for invalid number', () => {
      const template = new Analyze('/users/:id=number')
      const instance = new Analyze('/users/abc', template)
      
      expect(() => instance.getParams()).toThrow()
    })
  })

  describe('Boolean Casting', () => {
    it('should cast "true" string to boolean true', () => {
      const template = new Analyze('/status/:active=boolean')
      const instance = new Analyze('/status/true', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ active: true })
      expect(typeof params.active).toBe('boolean')
    })

    it('should cast "false" string to boolean false', () => {
      const template = new Analyze('/status/:active=boolean')
      const instance = new Analyze('/status/false', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ active: false })
    })

    it('should cast "1" to boolean true', () => {
      const template = new Analyze('/toggle/:enabled=boolean')
      const instance = new Analyze('/toggle/1', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ enabled: true })
    })

    it('should cast "0" to boolean false', () => {
      const template = new Analyze('/toggle/:enabled=boolean')
      const instance = new Analyze('/toggle/0', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ enabled: false })
    })

    it('should handle case insensitive boolean values', () => {
      const template = new Analyze('/flag/:value=boolean')
      const instance = new Analyze('/flag/TRUE', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ value: true })
    })

    it('should handle casting error for invalid boolean', () => {
      const template = new Analyze('/status/:active=boolean')
      const instance = new Analyze('/status/maybe', template)
      
      expect(() => instance.getParams()).toThrow()
    })
  })

  describe('String Casting', () => {
    it('should cast path parameter to string (default behavior)', () => {
      const template = new Analyze('/users/:name=string')
      const instance = new Analyze('/users/john', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ name: 'john' })
      expect(typeof params.name).toBe('string')
    })

    it('should handle string with special characters', () => {
      const template = new Analyze('/users/:slug=string')
      const instance = new Analyze('/users/john-doe_123', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ slug: 'john-doe_123' })
    })

    it('should work without explicit string type (default)', () => {
      const template = new Analyze('/users/:name')
      const instance = new Analyze('/users/alice', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ name: 'alice' })
      expect(typeof params.name).toBe('string')
    })
  })

  describe('Array Casting', () => {
    it('should cast comma-separated values to array', () => {
      const template = new Analyze('/tags/:items=array')
      const instance = new Analyze('/tags/red,green,blue', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ items: ['red', 'green', 'blue'] })
      expect(Array.isArray(params.items)).toBe(true)
    })

    it('should handle single value as array', () => {
      const template = new Analyze('/categories/:list=array')
      const instance = new Analyze('/categories/tech', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ list: ['tech'] })
    })

    it('should handle empty values in array', () => {
      const template = new Analyze('/filters/:values=array')
      const instance = new Analyze('/filters/a,,c', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ values: ['a', '', 'c'] })
    })
  })

  describe('Multiple Path Parameters', () => {
    it('should cast multiple parameters with different types', () => {
      const template = new Analyze('/api/:version=number/users/:id=number/active/:status=boolean')
      const instance = new Analyze('/api/2/users/123/active/true', template)
      
      const params = instance.getParams()
      expect(params).toEqual({ 
        version: 2, 
        id: 123, 
        status: true 
      })
    })

    it('should handle mixed type casting', () => {
      const template = new Analyze('/shop/:category=string/price/:min=number/tags/:filters=array/featured/:highlight=boolean')
      const instance = new Analyze('/shop/electronics/price/100/tags/new,sale,popular/featured/1', template)
      
      const params = instance.getParams()
      expect(params).toEqual({
        category: 'electronics',
        min: 100,
        filters: ['new', 'sale', 'popular'],
        highlight: true
      })
    })
  })

  describe('Display Output', () => {
    it('should display parsed nodes correctly for typed parameters', () => {
      const template = new Analyze('/users/:id=number')
      const instance = new Analyze('/users/100', template)
      
      const display = instance.display()
      // Remove ANSI codes to check plain text content
      const plainDisplay = display.replace(/\u001b\[[0-9;]*m/g, '')
      expect(plainDisplay).toContain('/users/100')
      expect(plainDisplay).toContain('Path')
      expect(plainDisplay).toContain('Slash')
    })

    it('should show correct node structure for complex typed path', () => {
      const template = new Analyze('/api/:version=number/status/:active=boolean')
      const instance = new Analyze('/api/2/status/true', template)
      
      const params = instance.getParams()
      const display = instance.display()
      
      expect(params).toEqual({ version: 2, active: true })
      // Remove ANSI codes to check plain text content
      const plainDisplay = display.replace(/\u001b\[[0-9;]*m/g, '')
      expect(plainDisplay).toContain('/api/2/status/true')
    })
  })
}) 