import { Analyze } from '../src'

console.log('=== Example 01: Basic URL Parsing ===\n')

const url = 'https://api.v1.example.co.uk:8080/users/list?active=true#section-1'
const analyzer = new Analyze(url)

console.log('Original URL:', analyzer.input)
console.log('Protocol:', analyzer.getProtocol()) // 'https'
console.log('Hostname:', analyzer.getHostname()) // 'api.v1.example.co.uk'
console.log('Port:', analyzer.getPort())         // '8080'
console.log('Pathname:', analyzer.getPathname())   // '/users/list'
console.log('Fragment:', analyzer.getFragment())  // 'section-1'

console.log('\n--- AST Table (Internal Representation) ---')
console.log(analyzer.ast.toJSON())
