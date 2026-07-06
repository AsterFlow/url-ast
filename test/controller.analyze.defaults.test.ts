// tests/analyze.defaults.test.ts
//
// Covers `=default` value application in instance mode. A template may declare a
// default with the `=` operator (e.g. `?page.number=1`, `/users/:id.number=42`);
// when the concrete URL omits that key/segment, the default is cast and returned.

import { expect, describe, it } from 'bun:test'
import { Analyze } from '../src'

describe('Controller: Analyze (Default Values)', () => {
  describe('getSearchParams() - query defaults', () => {
    it('applies a default when the query key is omitted', () => {
      const template = new Analyze('/users?page.number=1')
      const instance = new Analyze('/users', template)
      expect(instance.getSearchParams()).toEqual({ page: 1 })
    })

    it('prefers the instance value over the default when present', () => {
      const template = new Analyze('/users?page.number=1')
      const instance = new Analyze('/users?page=5', template)
      expect(instance.getSearchParams()).toEqual({ page: 5 })
    })

    it('fills multiple omitted defaults alongside provided params', () => {
      const template = new Analyze('?page.number=1&limit.number=20&sort')
      const instance = new Analyze('?sort=price', template)
      expect(instance.getSearchParams()).toEqual({ sort: 'price', page: 1, limit: 20 })
    })

    it('applies a boolean default', () => {
      const template = new Analyze('?q&descending.boolean=false')
      const instance = new Analyze('?q=typescript', template)
      expect(instance.getSearchParams()).toEqual({ q: 'typescript', descending: false })
    })

    it('applies an untyped (string) default', () => {
      const template = new Analyze('?lang=en')
      const instance = new Analyze('?other=x', template)
      expect(instance.getSearchParams()).toEqual({ lang: 'en' })
    })

    it('does not invent keys that have no default', () => {
      const template = new Analyze('?q&page.number=1')
      const instance = new Analyze('?q=hi', template)
      const result = instance.getSearchParams() as Record<string, unknown>
      expect(result).toEqual({ q: 'hi', page: 1 })
    })
  })

  describe('getParams() - path defaults', () => {
    it('applies a path default when the segment is omitted', () => {
      const template = new Analyze('/users/:id.number=42')
      const instance = new Analyze('/users', template)
      expect(instance.getParams()).toEqual({ id: 42 })
    })

    it('prefers the instance segment over the path default when present', () => {
      const template = new Analyze('/users/:id.number=42')
      const instance = new Analyze('/users/7', template)
      expect(instance.getParams()).toEqual({ id: 7 })
    })
  })
})
