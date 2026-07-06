import { AST, Analyze } from 'url-ast-v3';
import type { ParserAdapter } from '../utils/types.js';

/**
 * The original pure-TypeScript engine (url-ast@3.0.1) — the last release before
 * the Rust/WASM migration. Each call constructs a fresh instance and runs the
 * analysis in JS, materializing Node objects on the hot path. This is the
 * baseline the WASM engine is measured against.
 */
export function createUrlAstV3Adapter(): ParserAdapter {
  return {
    name: 'url-ast@3.0.1 (ts)',
    parse: (input) => new AST(input),
    params: (input) => new Analyze(input).getParams(),
    query: (input) => new Analyze(input).getSearchParams(),
    fragment: (input) => new Analyze(input).getFragment(),
    hostname: (input) => new Analyze(input).getHostname(),
    port: (input) => new Analyze(input).getPort(),
    protocol: (input) => new Analyze(input).getProtocol(),
    pathname: (input) => new Analyze(input).getPathname(),
  };
}
