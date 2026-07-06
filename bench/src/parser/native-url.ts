import type { ParserAdapter } from '../utils/types.js';

/**
 * Adapter for the native WHATWG `URL` + `URLSearchParams` API.
 * Zero dependencies. Each method calls the native API directly.
 */
export function createNativeUrlAdapter(): ParserAdapter {
  return {
    name: 'native-url',
    parse: (input) => new URL(input),
    query: (input) => new URL(input).searchParams,
    fragment: (input) => new URL(input).hash,
    hostname: (input) => new URL(input).hostname,
    port: (input) => new URL(input).port,
    protocol: (input) => new URL(input).protocol,
    pathname: (input) => new URL(input).pathname,
  };
}
