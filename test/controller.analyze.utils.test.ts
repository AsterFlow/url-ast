import { Analyze } from '../src'
import { AST } from '../src/controllers/AST'
import { expect, describe, it } from 'bun:test'

describe('Controller: Analyze (Utils)', () => {
  it('should initialize with a base parser through constructor', () => {
    const template = new Analyze('/users/[id]')
    const instance = new Analyze('/users/123', template)
    expect(instance.base).toBe(template)
  })

  it('should update the base parser when using setParser()', () => {
    const template = new Analyze('/users/[id]')
    const instance = new Analyze('/users/123').setParser(template)
    expect(instance.base).toBe(template)
  })

  it('should create instances via Analyze.create', () => {
    const solo = Analyze.create('/hello')
    expect(solo.getPathname()).toBe('/hello')

    const template = Analyze.create('/users/[id]')
    const withBase = Analyze.create('/users/99', template)
    expect(withBase.base).toBe(template)
  })

  it('should accept constructor options with a pre-built AST', () => {
    const ast = new AST('/prebuilt')
    const analyzer = new Analyze('/prebuilt', { ast })
    expect(analyzer.ast).toBe(ast)
  })
})
