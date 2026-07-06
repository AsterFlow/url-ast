import qs from 'qs';
import type { ParserAdapter } from '../utils/types.js';

/**
 * Adapter for the `qs` library.
 * Only exposes query parsing — calls qs.parse directly on the raw input.
 */
export function createQsAdapter(): ParserAdapter {
  return {
    name: 'qs',
    parse: (input) => qs.parse(input),
    query: (input) => qs.parse(input),
  };
}
