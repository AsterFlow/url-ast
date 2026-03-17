import { Analyze, ErrorLog } from '../src'

console.log('=== Example 05: Parameter Type Casting ===\n')

// 1. Typing in Path and Query
const template = new Analyze('/api/:version=number/users/:id=number?active=boolean&tags=array')

// Real URL: 'true' -> boolean, '123' -> number, 'a,b,c' -> array
const url = '/api/2/users/123?active=true&tags=typescript,nodejs'
const analyzer = new Analyze(url, template)

// 2. Extracting Path Params (Automatic Casting)
const pathParams = analyzer.getParams()
console.log('Path Params (Casted):')
console.log('Version:', pathParams.version, `(type: ${typeof pathParams.version})`)
console.log('User ID:', pathParams.id, `(type: ${typeof pathParams.id})`)

// 3. Extracting Search Params (Automatic Casting)
const searchParams = analyzer.getSearchParams()
console.log('\nSearch Params (Casted):')
console.log('Active:', searchParams.active, `(type: ${typeof searchParams.active})`)
console.log('Tags:', searchParams.tags, `(is array: ${Array.isArray(searchParams.tags)})`)

// 4. Casting in Action (Invalid Values)
console.log('\n4. Example with Casting Error:')
try {
  const badUrl = '/api/v2/users/abc?active=not-a-boolean'
  const badAnalyzer = new Analyze(badUrl, template)
  badAnalyzer.getParams() // Will throw because 'abc' is not a number
} catch (error) {
  if (error instanceof ErrorLog) {
    console.log('Caught Error:', error)
  } else {
    console.log('Not Analyzer Error: ', error)
  }
}
