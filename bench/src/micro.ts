import './initWasmSync.js'
import {
  analyzeFragment, analyzeHostname, analyzeParamsTemplate, analyzePathname,
  analyzePort, analyzeProtocol, analyzeSearchTemplate, parsePathView,
} from 'wasm'

const FULL_URL = 'http://localhost:3000/users/:id=number?a=array&b#c'
const QUERY_URL = 'http://localhost:3000/search?q=hello&lang=en&page=2'
const FRAGMENT_URL = 'http://localhost:3000/docs#section-3'
const COMPLEX_URL = 'https://api.example.com:8080/v1/users/42/posts?sort=date&order=desc&limit=10#top'
const QUERY_ONLY = 'frappucino=muffin&goat=scone&pond=moose&foo=bar&foo=baz'

const tasks: [string, () => unknown][] = [
  ['Parse (Simple)',     () => parsePathView(QUERY_URL)],
  ['Parse (Complex)',    () => parsePathView(COMPLEX_URL)],
  ['Params (Template)',  () => analyzeParamsTemplate(FULL_URL)],
  ['Query (Simple)',     () => analyzeSearchTemplate(QUERY_URL)],
  ['Query (Complex)',    () => analyzeSearchTemplate(COMPLEX_URL)],
  ['Query (Bare)',       () => analyzeSearchTemplate(`http://localhost?${QUERY_ONLY}`)],
  ['Fragment (Simple)',  () => analyzeFragment(FRAGMENT_URL)],
  ['Fragment (Complex)', () => analyzeFragment(COMPLEX_URL)],
  ['Hostname (Simple)',  () => analyzeHostname(QUERY_URL)],
  ['Hostname (Complex)', () => analyzeHostname(COMPLEX_URL)],
  ['Port',               () => analyzePort(COMPLEX_URL)],
  ['Protocol (HTTP)',    () => analyzeProtocol(QUERY_URL)],
  ['Protocol (HTTPS)',   () => analyzeProtocol(COMPLEX_URL)],
  ['Pathname (Simple)',  () => analyzePathname(QUERY_URL)],
  ['Pathname (Complex)', () => analyzePathname(COMPLEX_URL)],
]

function timeTask(fn: () => unknown): number {
  // warmup
  for (let i = 0; i < 50_000; i++) fn()
  // measure: best of several rounds to cut noise
  let best = Infinity
  for (let r = 0; r < 8; r++) {
    const N = 200_000
    const t0 = Bun.nanoseconds()
    for (let i = 0; i < N; i++) fn()
    const ns = (Bun.nanoseconds() - t0) / N
    if (ns < best) best = ns
  }
  return best
}

for (const [name, fn] of tasks) {
  const ns = timeTask(fn)
  console.log(`${name.padEnd(20)} ${ns.toFixed(1)} ns`)
}
