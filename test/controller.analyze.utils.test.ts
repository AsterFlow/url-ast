import { Analyze } from '../src'
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
})
