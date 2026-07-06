import { writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { runSuite } from './utils/bench.js';
import { buildMarkdownReport } from './utils/markdown.js';
import type { ParserAdapter, SuiteReport } from './utils/types.js';

import {
  createUrlAstAdapter,
  createUrlAstV3Adapter,
  createNativeUrlAdapter,
  createUrlParseAdapter,
  createQsAdapter,
  createFastQuerystringAdapter,
  createQueryStringAdapter,
} from './parser/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Test URLs ────────────────────────────────────────────────────────

const FULL_URL = 'http://localhost:3000/users/:id=number?a=array&b#c';
const QUERY_URL = 'http://localhost:3000/search?q=hello&lang=en&page=2';
const FRAGMENT_URL = 'http://localhost:3000/docs#section-3';
const COMPLEX_URL = 'https://api.example.com:8080/v1/users/42/posts?sort=date&order=desc&limit=10#top';
const QUERY_ONLY = 'frappucino=muffin&goat=scone&pond=moose&foo=bar&foo=baz';

// ─── Types ────────────────────────────────────────────────────────────

type MethodKey = 'parse' | 'params' | 'query' | 'fragment' | 'hostname' | 'port' | 'protocol' | 'pathname';

interface TestSuite {
  name: string;
  description: string;
  method: MethodKey;
  input: string;
}

// ─── Each test is its own suite (its own table) ───────────────────────

const SUITES: TestSuite[] = [
  // Parse
  { name: 'Parse (Simple)',   description: 'Full URL parsing / constructor cost on a simple URL.',   method: 'parse', input: QUERY_URL },
  { name: 'Parse (Complex)',  description: 'Full URL parsing / constructor cost on a complex URL.',  method: 'parse', input: COMPLEX_URL },

  // Params (url-ast exclusive)
  { name: 'Params (Template)', description: 'Route parameter extraction from a template URL (e.g. /users/:id=number).', method: 'params', input: FULL_URL },

  // Query
  { name: 'Query (Simple)',  description: 'Query-string extraction on a simple URL.',       method: 'query', input: QUERY_URL },
  { name: 'Query (Complex)', description: 'Query-string extraction on a complex URL.',      method: 'query', input: COMPLEX_URL },
  { name: 'Query (Bare)',    description: 'Query-string extraction on a bare query string.', method: 'query', input: `http://localhost?${QUERY_ONLY}` },

  // Fragment
  { name: 'Fragment (Simple)',  description: 'Fragment / hash extraction on a simple URL.',  method: 'fragment', input: FRAGMENT_URL },
  { name: 'Fragment (Complex)', description: 'Fragment / hash extraction on a complex URL.', method: 'fragment', input: COMPLEX_URL },

  // Hostname
  { name: 'Hostname (Simple)',  description: 'Hostname extraction on a simple URL.',  method: 'hostname', input: QUERY_URL },
  { name: 'Hostname (Complex)', description: 'Hostname extraction on a complex URL.', method: 'hostname', input: COMPLEX_URL },

  // Port
  { name: 'Port', description: 'Port extraction from a URL with an explicit port.', method: 'port', input: COMPLEX_URL },

  // Protocol
  { name: 'Protocol (HTTP)',  description: 'Protocol extraction from an HTTP URL.',  method: 'protocol', input: QUERY_URL },
  { name: 'Protocol (HTTPS)', description: 'Protocol extraction from an HTTPS URL.', method: 'protocol', input: COMPLEX_URL },

  // Pathname
  { name: 'Pathname (Simple)',  description: 'Pathname extraction on a simple URL.',  method: 'pathname', input: QUERY_URL },
  { name: 'Pathname (Complex)', description: 'Pathname extraction on a complex URL.', method: 'pathname', input: COMPLEX_URL },
];

// ─── Helpers ──────────────────────────────────────────────────────────

function adaptersFor(adapters: ParserAdapter[], method: MethodKey): ParserAdapter[] {
  return adapters.filter(a => typeof a[method] === 'function');
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 url-ast Benchmark Starting\n');

  const adapters: ParserAdapter[] = [
    createUrlAstAdapter(),
    createUrlAstV3Adapter(),
    createNativeUrlAdapter(),
    createUrlParseAdapter(),
    createQsAdapter(),
    createFastQuerystringAdapter(),
    createQueryStringAdapter(),
  ];

  const reports: SuiteReport[] = [];

  for (const suite of SUITES) {
    const eligible = adaptersFor(adapters, suite.method);
    if (eligible.length === 0) continue;

    const participantNames = eligible.map(a => a.name).join(', ');

    const report = await runSuite(
      {
        name: suite.name,
        description: `${suite.description} Participants: ${participantNames}.`,
        durationMs: 500,
      },
      bench => {
        for (const adapter of eligible) {
          const fn = adapter[suite.method]!.bind(adapter);
          bench.add(adapter.name, () => fn(suite.input));
        }
      },
    );

    reports.push(report);
  }

  const markdown = buildMarkdownReport(reports);

  const outPath = resolve(__dirname, '../../BENCHMARK.md');
  await writeFile(outPath, markdown, 'utf-8');

  console.log(`\n✅ Done — ${outPath} written.`);
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
