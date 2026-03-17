// tests/analyze.static-props.test.ts

import { expect, describe, it } from 'bun:test'
import { Analyze } from '../src'

describe('Controller: Analyze (Static Props)', () => {
  describe('getStaticProps()', () => {
    it('should return an empty object if no base parser is provided', () => {
      const analyzer = new Analyze('/users/123')
      expect(analyzer.getStaticProps()).toEqual({})
    })

    it('should extract a standard dynamic parameter `[id]`', () => {
      const template = new Analyze('/users/[id]')
      const instance = new Analyze('/users/abc-987', template)
      expect(instance.getStaticProps()).toEqual({ id: 'abc-987' })
    })

    it('should extract multiple dynamic parameters', () => {
      const template = new Analyze('/orgs/[orgId]/users/[userId]')
      const instance = new Analyze('/orgs/bun-dev/users/42', template)
      expect(instance.getStaticProps()).toEqual({ orgId: 'bun-dev', userId: '42' })
    })

    it('should extract a catch-all parameter `[...slug]`', () => {
      const template = new Analyze('/files/[...slug]')
      const instance = new Analyze('/files/documents/2024/report.pdf', template)
      expect(instance.getStaticProps()).toEqual({ slug: ['documents', '2024', 'report.pdf'] })
    })

    it('should extract a catch-all with a static suffix', () => {
      const template = new Analyze('/docs/[...path]/view')
      const instance = new Analyze('/docs/guides/testing/intro/view', template)
      expect(instance.getStaticProps()).toEqual({ path: ['guides', 'testing', 'intro'] })
    })

    it('should return an empty object for a non-matching static path part', () => {
      const template = new Analyze('/admin/[id]')
      const instance = new Analyze('/users/123', template)
      expect(instance.getStaticProps()).toEqual({})
    })

    it('should return an empty object for a non-matching path length', () => {
      const template = new Analyze('/users/[id]/settings')
      const instance = new Analyze('/users/123', template)
      expect(instance.getStaticProps()).toEqual({})
    })

    it('should handle getStaticProps branches for catch-all', () => {
      const template = new Analyze('/[...slug]')
      const instance = new Analyze('/a/b/c', template)
      expect(instance.getStaticProps()).toEqual({ slug: ['a', 'b', 'c'] })

      const template2 = new Analyze('/[id]')
      const instance2 = new Analyze('/a/b', template2) // length mismatch
      expect(instance2.getStaticProps()).toEqual({})
    })

    it('should extract catch-all and extra segments', () => {
      const template = new Analyze('/docs/[...slug]/edit')
      const instance = new Analyze('/docs/a/b/edit', template)
      expect(instance.getStaticProps()).toEqual({ slug: ['a', 'b'] })
    })
  })
})
