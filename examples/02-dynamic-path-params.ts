import { Analyze } from '../src'

console.log('=== Example 02: Dynamic Path Parameters ===\n')

// 1. Defining a Template (Skeleton)
const template = new Analyze('/users/:userId/posts/:postId')
console.log('Template:', template.input)
console.log('Parameter names extracted from template:', template.getParams())

// 2. Analyzing a Real URL with the Template
const analyzer = new Analyze('/users/123/posts/abc-987', template)

// 3. Extracting the values
const params = analyzer.getParams()
console.log('\nExtracted Values:')
console.log('User ID:', params.userId) // '123'
console.log('Post ID:', params.postId) // 'abc-987'

// 4. We can also see the reconstructed pathname
console.log('\nReconstructed Pathname:', analyzer.getPathname())
