import queryString from 'query-string';
import type { ParserAdapter } from '../utils/types.js';

/**
 * Adapter for the `query-string` library.
 * Each method calls query-string directly — no post-processing.
 */
export function createQueryStringAdapter(): ParserAdapter {
  return {
    name: 'query-string',
    parse: (input) => queryString.parseUrl(input),
    query: (input) => queryString.parseUrl(input).query,
    fragment: (input) => queryString.parseUrl(input).fragmentIdentifier,
  };
}
