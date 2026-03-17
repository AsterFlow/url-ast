import { Analyze } from '../src'

console.log('=== Example 04: Next.js Style Routes ([id], [...slug]) ===\n')

// 1. Simple Dynamic Route
const dynamicTemplate = new Analyze('/blog/[slug]')
const dynamicInstance = new Analyze('/blog/hello-world', dynamicTemplate)

const dynamicProps = dynamicInstance.getStaticProps()
console.log('1. Simple Dynamic Route ([slug]):')
console.log('Slug:', dynamicProps.slug) // 'hello-world'

// 2. Catch-all Route
const catchAllTemplate = new Analyze('/docs/[...path]')
const catchAllInstance = new Analyze('/docs/guides/getting-started/installation', catchAllTemplate)

const catchAllProps = catchAllInstance.getStaticProps()
console.log('\n2. Catch-all Route ([...path]):')
console.log('Path:', catchAllProps.path) // ['guides', 'getting-started', 'installation']

// 3. Composite Route
const complexTemplate = new Analyze('/admin/[org]/users/[userId]')
const complexInstance = new Analyze('/admin/my-org/users/42', complexTemplate)

const complexProps = complexInstance.getStaticProps()
console.log('\n3. Composite Route:')
console.log('Properties:', complexProps) // { org: 'my-org', userId: '42' }
