import { describe, expect, expectTypeOf, it } from 'bun:test'
import { Analyze, type ParsePath } from '../src'

describe('Controller: Analyze (optional bracket segment [~name])', () => {
  it('should infer slug as string | undefined for /posts/[~slug]', () => {
    type Params = ParsePath<'/posts/[~slug]'>['params']
    expectTypeOf<Params['slug']>().toEqualTypeOf<string | undefined>()
  })

  it('should list slug in template mode and extract value with base parser', () => {
    const template = new Analyze('/posts/[~slug]')
    expect(template.getParams()).toEqual(['slug'])

    const withSlug = new Analyze('/posts/hello-world', template)
    expect(withSlug.getParams()).toEqual({ slug: 'hello-world' })
  })

  it('should allow missing optional segment (undefined)', () => {
    const template = new Analyze('/posts/[~slug]')
    const withoutSlug = new Analyze('/posts', template)
    expect(withoutSlug.getParams()).toEqual({ slug: undefined })
  })
})
