// tests/analyze.utils.test.ts

import { Analyze } from '../src'
import { Node } from '../src/controllers/Node'
import { expect, describe, it } from 'bun:test'

describe('Controller: Analyze (Utils)', () => {
  it('should return a new instance with the base parser set when using withParser()', () => {
    const template = new Analyze('/users/[id]')
    const instance = new Analyze('/users/123', template)
    // Usamos toBe para verificar se é a mesma instância de objeto
    expect(instance.base).toBe(template)
  })

  it('should update the base parser when using setParser()', () => {
    const template = new Analyze('/users/[id]')
    const instance = new Analyze('/users/123').setParser(template)
    expect(instance.base).toBe(template)
  })

  it('should return a Buffer instance when using getBuffer()', () => {
    const analyzer = new Analyze('/some/path')
    expect(analyzer.getBuffer()).toBeInstanceOf(Buffer)
    // O tamanho do buffer deve ser o número de nós * tamanho de cada nó (fixo)
    expect(analyzer.getBuffer().length).toBe(analyzer.ast.nodes.length * Node.SIZE)
  })
})