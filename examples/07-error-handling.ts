import { Analyze } from '../src'

console.log('=== Example 07: Syntax Error Handling ===\n')

/**
 * url-ast features a robust parser that detects common URL syntax errors
 * and provides clear, visual feedback on where the error occurred.
 */

const errorCases = [
  {
    name: 'Unclosed Dynamic Segment',
    url: '/users/[id/settings'
  },
  {
    name: 'Consecutive Slashes (Invalid Path)',
    url: 'https://example.com//users/list'
  },
  {
    name: 'Invalid Syntax after Search Parameter',
    url: '/search?category/books' // Slash '/' is not allowed right after a parameter name
  },
  {
    name: 'Variable (colon) in Search Parameters',
    url: '?q:number=123' // Colon ':' is for path variables, not allowed in query strings
  },
  {
    name: 'Invalid URI Encoding',
    url: '/search?q=%ZZ' // %ZZ is not a valid hex sequence
  }
]

errorCases.forEach(({ name, url }) => {
  console.log(`\n>>> Case: ${name}`)
  console.log(`URL: ${url}`)
  
  const analyzer = new Analyze(url)
  
  // Note: Some errors (like E_DECODE_URI) are detected during data extraction
  if (name.includes('Encoding')) {
    analyzer.getSearchParams()
  }

  if (analyzer.hasErrors()) {
    console.log(analyzer.displayErrors())
  } else {
    console.log('No errors found (Unexpected).')
  }
  console.log('-'.repeat(40))
})
