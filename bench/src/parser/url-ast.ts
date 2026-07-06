import '../initWasmSync.js'
import {
  analyzeFragment,
  analyzeHostname,
  analyzeParamsTemplate,
  analyzePathname,
  analyzePort,
  analyzeProtocol,
  analyzeSearchTemplate,
  parsePathView,
} from 'wasm';
import type { ParserAdapter } from '../utils/types.js';

/**
 * The Rust/WASM engine via the zero-copy MemoryShare bridge: parsing and analysis
 * run in Rust, results are read from a view over WASM linear memory. No JS class
 * allocation / per-node object materialization on the hot path.
 */
export function createUrlAstAdapter(): ParserAdapter {
  return {
    name: 'url-ast (wasm)',
    parse: (input) => parsePathView(input),
    params: (input) => analyzeParamsTemplate(input),
    query: (input) => analyzeSearchTemplate(input),
    fragment: (input) => analyzeFragment(input),
    hostname: (input) => analyzeHostname(input),
    port: (input) => analyzePort(input),
    protocol: (input) => analyzeProtocol(input),
    pathname: (input) => analyzePathname(input),
  };
}
