// examples/path-casting-demo.ts
import { Analyze } from '../src'

console.log('=== Demonstração de Casting de Tipos em Parâmetros de Path ===\n')

// Exemplo 1: Number casting
console.log('1. Number Casting:')
const numberTemplate = new Analyze('/users/:id=number')
const numberInstance = new Analyze('/users/100', numberTemplate)
console.log(numberInstance.display())
console.log('Parâmetros:', numberInstance.getParams())
console.log('Tipo do id:', typeof numberInstance.getParams().id)
console.log()

// Exemplo 2: Boolean casting
console.log('2. Boolean Casting:')
const boolTemplate = new Analyze('/status/:active=boolean')
const boolInstance = new Analyze('/status/true', boolTemplate)
console.log(boolInstance.display())
console.log('Parâmetros:', boolInstance.getParams())
console.log('Tipo do active:', typeof boolInstance.getParams().active)
console.log()

// Exemplo 3: String casting (padrão)
console.log('3. String Casting:')
const stringTemplate = new Analyze('/users/:name=string')
const stringInstance = new Analyze('/users/john-doe', stringTemplate)
console.log(stringInstance.display())
console.log('Parâmetros:', stringInstance.getParams())
console.log('Tipo do name:', typeof stringInstance.getParams().name)
console.log()

// Exemplo 4: Array casting
console.log('4. Array Casting:')
const arrayTemplate = new Analyze('/tags/:items=array')
const arrayInstance = new Analyze('/tags/red,green,blue', arrayTemplate)
console.log(arrayInstance.display())
console.log('Parâmetros:', arrayInstance.getParams())
console.log('É array:', Array.isArray(arrayInstance.getParams().items))
console.log()

// Exemplo 5: Múltiplos tipos
console.log('5. Múltiplos Tipos:')
const multiTemplate = new Analyze('/api/:version=number/users/:id=number/active/:status=boolean')
const multiInstance = new Analyze('/api/2/users/123/active/true', multiTemplate)
console.log(multiInstance.display())
console.log('Parâmetros:', multiInstance.getParams())
console.log()

// Exemplo 6: Erro de casting
console.log('6. Exemplo de Erro de Casting:')
try {
  const errorTemplate = new Analyze('/users/:id=number')
  const errorInstance = new Analyze('/users/abc', errorTemplate)
  errorInstance.getParams()
} catch (error) {
  console.log('Erro capturado:', error instanceof Error ? error.message : String(error))
}
console.log()

console.log('=== Fim da Demonstração ===') 