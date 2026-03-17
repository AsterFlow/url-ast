// tests/analyze.params.test.ts

import { expect, describe, it } from 'bun:test'
import { Analyze } from '../src'

describe('Controller: Analyze (Parameters and Fragments)', () => {
  describe('getParams() - Path Parameters', () => {
    describe('Template Mode', () => {
      it('should return an array of param names', () => {
        const analyzer = new Analyze('/users/:userId/posts/:postId')
        expect(analyzer.getParams()).toEqual(['userId', 'postId'])
      })
    })

    describe('Instance Mode (with base AST)', () => {
      it('should extract and cast params based on a template', () => {
        const template = new Analyze('/user/:id=number/active/:status=boolean')
        const instance = new Analyze('/user/123/active/true', template)
        expect(instance.getParams()).toEqual({ id: 123, status: true })
      })

      it('should extract params containing special characters in path segments', () => {
        const template = new Analyze('/:config/:min=number/:max=number/:provider')
        const instance = new Analyze('/do~´n\',-t/1/1/example', template)
        expect(instance.getParams()).toEqual({
          config: 'do~´n\',-t',
          min: 1,
          max: 1,
          provider: 'example'
        })
      })

      it('should extract params with base parser having mixed static and dynamic segments', () => {
        const template = new Analyze('/users/:id/posts/:postId')
        const instance = new Analyze('/users/42/posts/100', template)
        const params = instance.getParams()
        expect(params).toEqual({ id: '42', postId: '100' })
      })

      it('should return empty object when nodeSlash is missing or not a path', () => {
        const template = new Analyze('/:id')
        const instance = new Analyze('/', template)
        const params = instance.getParams()
        expect(params).toEqual({} as any)
      })
    })
  })

  describe('getSearchParams() - Query String Parameters', () => {
    describe('Template Mode', () => {
      it('should return a Map of search parameters', () => {
        const analyzer = new Analyze('?a=1&b=hello&c')
        const params = analyzer.getSearchParams()
        expect(params.get('a')).toBe('1')
        expect(params.get('b')).toBe('hello')
        expect(params.get('c')).toBe('')
      })

      it('should handle duplicate keys by creating an array', () => {
        const analyzer = new Analyze('?tag=news&tag=tech')
        expect(analyzer.getSearchParams().get('tag')).toEqual(['news', 'tech'])
      })

      it('should handle multiple occurrences (3+)', () => {
        const analyzer = new Analyze('?a=1&a=2&a=3')
        const searchParams = analyzer.getSearchParams()
        expect(searchParams.get('a')).toEqual(['1', '2', '3'])
      })
    })

    describe('Instance Mode (with base AST)', () => {
      it('should extract and cast various types', () => {
        const template = new Analyze('?id=number&active=boolean&tags=array&name=string')
        const instance = new Analyze('?id=99&active=false&tags=a,b,c&name=test', template)
        expect(instance.getSearchParams()).toEqual({
          id: 99,
          active: false,
          tags: ['a', 'b', 'c'],
          name: 'test'
        })
      })

      it('should extract and cast search params with special characters', () => {
        const template = new Analyze('?config=string')
        const instance = new Analyze('?config=do~´n\',-t', template)
        expect(instance.getSearchParams()).toEqual({
          config: 'do~´n\',-t'
        })
      })

      it('should handle base parser and missing values', () => {
        const template = new Analyze('?q:string')
        const instance = new Analyze('?other=val', template)
        const searchParams = instance.getSearchParams()
        expect(Object.keys(searchParams)).not.toContain('q')
      })

      it('should cast value with Array type', () => {
        const template = new Analyze('?tags=array')
        const instance = new Analyze('?tags=a,b,c', template)
        const params = instance.getSearchParams() as any
        expect(params.tags).toEqual(['a', 'b', 'c'])
      })
    })
  })

  describe('getFragment() - Hash Fragment', () => {
    describe('Template Mode', () => {
      it('should extract the fragment string', () => {
        const analyzer = new Analyze('/path/to/page#section-heading')
        expect(analyzer.getFragment()).toBe('section-heading')
      })
    })

    describe('Instance Mode (with base AST)', () => {
      it('should map the template key to the instance value', () => {
        const template = new Analyze('/page#sectionKey')
        const instance = new Analyze('/page#actualValue', template)
        expect(instance.getFragment()).toEqual({ sectionKey: 'actualValue' })
      })

      it('should handle missing fragment with base parser', () => {
        const template = new Analyze('/#section')
        const instance = new Analyze('/', template)
        const fragment = instance.getFragment()
        expect(fragment).toEqual({} as any)
        
        const template2 = new Analyze('/')
        const instance2 = new Analyze('/#section', template2)
        expect(instance2.getFragment()).toEqual({} as any)
      })
    })
  })

  describe('Fluent setParser API', () => {
    it('should extract and cast params using late-bound parser', () => {
      const template = new Analyze('/user/:id=number')
      const instance = new Analyze('/user/123').setParser(template)
      expect(instance.getParams()).toEqual({ id: 123 })
    })

    it('should extract and cast search params using late-bound parser', () => {
      const template = new Analyze('?active=boolean')
      const instance = new Analyze('?active=true').setParser(template)
      expect(instance.getSearchParams()).toEqual({ active: true })
    })

    it('should extract fragment using late-bound parser', () => {
      const template = new Analyze('#sectionKey')
      const instance = new Analyze('#actualValue').setParser(template)
      expect(instance.getFragment()).toEqual({ sectionKey: 'actualValue' })
    })
  })
})
