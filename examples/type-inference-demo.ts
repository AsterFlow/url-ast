import { Analyze } from '../src'

// Demonstração da inferência de tipos melhorada

// 1. Template parser com tipos definidos
const template = new Analyze('/users/:id=number')

// 2. Instância usando o template
const instance = new Analyze('/users/100', template)

// 3. Agora os tipos são inferidos corretamente do template
const params = instance.getParams()
// TypeScript sabe que params tem o tipo: { id: number }

// 4. Podemos acessar a propriedade 'id' sem erros de tipo
console.log('User ID:', params.id) // number
console.log('Type of ID:', typeof params.id) // "number"

// 5. Exemplo mais complexo com múltiplos tipos
const complexTemplate = new Analyze('/api/:version=number/users/:userId=number?active=boolean&tags=array')
const complexInstance = new Analyze('/api/2/users/42?active=true&tags=nodejs,typescript', complexTemplate)

const pathParams = complexInstance.getParams()
// TypeScript infere: { version: number, userId: number }

const searchParams = complexInstance.getSearchParams()
// TypeScript infere: { active: boolean, tags: string[] }

console.log('\nComplex example:')
console.log('Path params:', pathParams)
console.log('Search params:', searchParams)

// 6. Autocompletar funciona corretamente
console.log('\nAutocompletar disponível:')
console.log('Version:', pathParams.version)  // IDE sugere .version e .userId
console.log('User ID:', pathParams.userId)
console.log('Active:', searchParams.active)   // IDE sugere .active e .tags
console.log('Tags:', searchParams.tags)

// 7. Type safety - erros de compilação se tentar acessar propriedades inexistentes
// console.log(pathParams.wrongProperty) // ❌ Erro de TypeScript: Property 'wrongProperty' does not exist

// 8. Type safety - erros de compilação se usar tipos errados
// const wrongMath = pathParams.version + "string" // ✅ TypeScript sabe que version é number
const correctMath = pathParams.version * 10       // ✅ Funciona porque version é number

console.log('\nType safety example:')
console.log('Version * 10 =', correctMath) 