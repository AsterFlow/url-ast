import urlParse from 'url-parse';
import type { ParserAdapter } from '../utils/types.js';

/**
 * Adapter for the `url-parse` library.
 * Each method calls url-parse directly — no post-processing.
 */
export function createUrlParseAdapter(): ParserAdapter {
  return {
    name: 'url-parse',
    parse: (input) => urlParse(input, true),
    query: (input) => urlParse(input, true).query,
    fragment: (input) => urlParse(input).hash,
    hostname: (input) => urlParse(input).hostname,
    port: (input) => urlParse(input).port,
    protocol: (input) => urlParse(input).protocol,
    pathname: (input) => urlParse(input).pathname,
  };
}
