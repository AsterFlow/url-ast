import { Analyze } from './controllers/Analyze'

export * from './controllers/Analyze'
export * from './controllers/Node'
export * from './types/analyze'
export * from './types/node'
export * from './utils/decodeURL'

const analyzer = new Analyze('/users/:id=number')
const analyzed = new Analyze('/users/100', analyzer)

console.log(analyzed.display())
console.log(analyzed.getParams())