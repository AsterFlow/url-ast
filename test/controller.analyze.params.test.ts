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
        const template = new Analyze('/user/:id.number/active/:status.boolean')
        const instance = new Analyze('/user/123/active/true', template)
        expect(instance.getParams()).toEqual({ id: 123, status: true })
      })

      it('should extract params containing special characters in path segments', () => {
        const template = new Analyze('/:config/:min.number/:max.number/:provider')
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

      it('should decode Latin characters (ç, ã, é, ñ) in path params', () => {
        const template = new Analyze('/:cidade')
        const instance = new Analyze('/S%C3%A3o%20Paulo', template)
        expect(instance.getParams()).toEqual({ cidade: 'São Paulo' })
      })

      it('should decode Portuguese accented characters in path params', () => {
        const template = new Analyze('/:palavra')
        const instance = new Analyze('/a%C3%A7%C3%A3o', template)
        expect(instance.getParams()).toEqual({ palavra: 'ação' })
      })

      it('should decode French accented characters (è, ê, ë) in path params', () => {
        const template = new Analyze('/:mot')
        const instance = new Analyze('/caf%C3%A9', template)
        expect(instance.getParams()).toEqual({ mot: 'café' })
      })

      it('should decode Spanish ñ in path params', () => {
        const template = new Analyze('/:palabra')
        const instance = new Analyze('/espa%C3%B1ol', template)
        expect(instance.getParams()).toEqual({ palabra: 'español' })
      })

      it('should decode German umlauts (ä, ö, ü, ß) in path params', () => {
        const template = new Analyze('/:wort')
        const instance = new Analyze('/Stra%C3%9Fe', template)
        expect(instance.getParams()).toEqual({ wort: 'Straße' })
      })

      it('should decode CJK (Chinese) characters in path params', () => {
        const template = new Analyze('/:name')
        const instance = new Analyze('/%E4%BD%A0%E5%A5%BD', template)
        expect(instance.getParams()).toEqual({ name: '你好' })
      })

      it('should decode Japanese (Katakana) characters in path params', () => {
        const template = new Analyze('/:text')
        const instance = new Analyze('/%E3%82%BB%E3%82%AF%E3%82%B7%E3%83%A7%E3%83%B3', template)
        expect(instance.getParams()).toEqual({ text: 'セクション' })
      })

      it('should decode Korean (Hangul) characters in path params', () => {
        const template = new Analyze('/:text')
        const instance = new Analyze('/%ED%95%9C%EA%B5%AD%EC%96%B4', template)
        expect(instance.getParams()).toEqual({ text: '한국어' })
      })

      it('should decode Cyrillic (Russian) characters in path params', () => {
        const template = new Analyze('/:city')
        const instance = new Analyze('/%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0', template)
        expect(instance.getParams()).toEqual({ city: 'Москва' })
      })

      it('should decode Arabic characters in path params', () => {
        const template = new Analyze('/:greeting')
        const instance = new Analyze('/%D9%85%D8%B1%D8%AD%D8%A8%D8%A7', template)
        expect(instance.getParams()).toEqual({ greeting: 'مرحبا' })
      })

      it('should decode 4-byte UTF-8 emoji characters in path params', () => {
        const template = new Analyze('/:emoji')
        const instance = new Analyze('/%F0%9F%8E%89', template)
        expect(instance.getParams()).toEqual({ emoji: '🎉' })
      })

      it('should decode multiple encoded params in the same URL', () => {
        const template = new Analyze('/:lang/:city')
        const instance = new Analyze('/portugu%C3%AAs/S%C3%A3o%20Paulo', template)
        expect(instance.getParams()).toEqual({ lang: 'português', city: 'São Paulo' })
      })

      it('should cast number type with encoded path segments', () => {
        const template = new Analyze('/:name/:value.number')
        const instance = new Analyze('/caf%C3%A9/42', template)
        const params = instance.getParams()
        expect(params).toEqual({ name: 'café', value: 42 })
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
        const template = new Analyze('?id.number&active.boolean&tags.array&name.string')
        const instance = new Analyze('?id=99&active=false&tags=a,b,c&name=test', template)
        expect(instance.getSearchParams()).toEqual({
          id: 99,
          active: false,
          tags: ['a', 'b', 'c'],
          name: 'test'
        })
      })

      it('should extract and cast search params with special characters', () => {
        const template = new Analyze('?config.string')
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
        const template = new Analyze('?tags.array')
        const instance = new Analyze('?tags=a,b,c', template)
        const params = instance.getSearchParams() as any
        expect(params.tags).toEqual(['a', 'b', 'c'])
      })

      it('should decode Latin characters in search param values', () => {
        const template = new Analyze('?cidade.string')
        const instance = new Analyze('?cidade=a%C3%A7%C3%A3o', template)
        expect(instance.getSearchParams()).toEqual({ cidade: 'ação' })
      })

      it('should decode CJK characters in search param values', () => {
        const template = new Analyze('?query.string')
        const instance = new Analyze('?query=%E4%BD%A0%E5%A5%BD', template)
        expect(instance.getSearchParams()).toEqual({ query: '你好' })
      })

      it('should decode Cyrillic characters in search param values', () => {
        const template = new Analyze('?city.string')
        const instance = new Analyze('?city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0', template)
        expect(instance.getSearchParams()).toEqual({ city: 'Москва' })
      })

      it('should decode emoji in search param values', () => {
        const template = new Analyze('?reaction.string')
        const instance = new Analyze('?reaction=%F0%9F%8E%89', template)
        expect(instance.getSearchParams()).toEqual({ reaction: '🎉' })
      })

      it('should decode encoded keys in template mode search params', () => {
        const analyzer = new Analyze('?q=caf%C3%A9&b=a%C3%A7%C3%A3o')
        const params = analyzer.getSearchParams()
        expect(params.get('q')).toBe('café')
        expect(params.get('b')).toBe('ação')
      })

      it('should extract and cast Enum type from search params (bracket syntax)', () => {
        const template = new Analyze('/users/?role.enum[Admin,User]')
        const instance = new Analyze('/users/?role=Admin', template)
        expect(instance.getSearchParams()).toEqual({ role: ['Admin'] })
      })

      it('should extract Enum with multiple comma-separated values', () => {
        const template = new Analyze('?status.enum[active,inactive,pending]')
        const instance = new Analyze('?status=active,inactive,pending', template)
        expect(instance.getSearchParams()).toEqual({ status: ['active', 'inactive', 'pending'] })
      })

      it('should handle mixed types including Enum in search params', () => {
        const template = new Analyze('?page.number&sort.enum[name,date]&active.boolean')
        const instance = new Analyze('?page=1&sort=name,date&active=true', template)
        expect(instance.getSearchParams()).toEqual({
          page: 1,
          sort: ['name', 'date'],
          active: true
        })
      })

      it('should cast search params when enum uses bare keyword and variants come from a following type node', () => {
        const template = new Analyze('?x.enum')
        const instance = new Analyze('?x=Admin', template)
        expect(instance.getSearchParams()).toEqual({ x: ['Admin'] })
      })
    })
  })

  describe('getParams() - catch-all with base', () => {
    it('should map catch-all segments to a string array in getParams', () => {
      const template = new Analyze('/files/[...slug]')
      const instance = new Analyze('/files/a/b/c', template)
      expect(instance.getParams()).toEqual({ slug: ['a', 'b', 'c'] })
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

      it('should decode Latin characters in fragment values', () => {
        const template = new Analyze('#section')
        const instance = new Analyze('#sec%C3%A7%C3%A3o', template)
        expect(instance.getFragment()).toEqual({ section: 'secção' })
      })

      it('should decode Japanese characters in fragment', () => {
        const template = new Analyze('#section')
        const instance = new Analyze('#%E3%82%BB%E3%82%AF%E3%82%B7%E3%83%A7%E3%83%B3', template)
        expect(instance.getFragment()).toEqual({ section: 'セクション' })
      })

      it('should decode Latin characters in template mode fragment', () => {
        const analyzer = new Analyze('/page#sec%C3%A7%C3%A3o')
        expect(analyzer.getFragment()).toBe('secção')
      })
    })
  })

  describe('Fluent setParser API', () => {
    it('should extract and cast params using late-bound parser', () => {
      const template = new Analyze('/user/:id.number')
      const instance = new Analyze('/user/123').setParser(template)
      expect(instance.getParams()).toEqual({ id: 123 })
    })

    it('should extract and cast search params using late-bound parser', () => {
      const template = new Analyze('?active.boolean')
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
