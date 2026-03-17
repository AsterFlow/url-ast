import { Analyze } from '../src'

console.log('=== Example 03: Search Parameters (Query Strings) ===\n')

// 1. Simple Extraction (No Template)
const analyzer = new Analyze('/search?q=typescript&tag=news&tag=programming')

const simpleParams = analyzer.getSearchParams()
console.log('Simple Parameters (Map):')
console.log('q:', simpleParams.get('q'))       // 'typescript'
console.log('tags:', simpleParams.get('tag')) // ['news', 'programming'] (Auto-detects multiples)

// 2. Template-based Extraction (Ideal for Key Validation)
const template = new Analyze('?category&page&limit')
const actual = new Analyze('/search?category=books&page=1&other=ignored', template)

const templatedParams = actual.getSearchParams()
console.log('\nWith Template (Object):')
console.log('Category:', templatedParams.category) // 'books'
console.log('Page:', templatedParams.page)         // '1'
console.log('Others (not in template):', (templatedParams as any).other) // undefined
