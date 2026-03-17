import { Analyze } from '../src'

/**
 * This example focuses on TypeScript support.
 * url-ast uses advanced type inference to determine parameter types
 * based solely on the template string.
 */

console.log('=== Example 06: TypeScript Type Inference ===\n')

// 1. Template with types declared in the string
const template = new Analyze('/api/:version=number/users/:userId=number?active=boolean&tags=array')

// 2. Instance using the template
const instance = new Analyze('/api/1/users/42?active=true&tags=a,b', template)

// 3. Automatic Inference!
// Hover over 'pathParams' to see the type: { version: number, userId: number }
const pathParams = instance.getParams()

// Hover over 'searchParams' to see: { active: boolean, tags: string[] }
const searchParams = instance.getSearchParams()

// 4. Runtime verification
console.log('TypeScript knows version is a number:', typeof pathParams.version === 'number')
console.log('TypeScript knows active is a boolean:', typeof searchParams.active === 'boolean')
console.log('TypeScript knows tags is an array:', Array.isArray(searchParams.tags))

/**
 * NOTE: Try uncommenting the lines below in your editor to see TypeScript errors:
 */
// console.log(pathParams.nonExistent) // ❌ Error: Property 'nonExistent' does not exist
// const s: string = pathParams.version // ❌ Error: Type 'number' is not assignable to type 'string'