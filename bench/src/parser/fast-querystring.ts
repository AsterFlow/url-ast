import { parse as fqsParse } from 'fast-querystring';
import type { ParserAdapter } from '../utils/types.js';

/**
 * Adapter for the `fast-querystring` library.
 * Only exposes query parsing — calls parse directly on the raw input.
 */
export function createFastQuerystringAdapter(): ParserAdapter {
  return {
    name: 'fast-querystring',
    parse: (input) => fqsParse(input),
    query: (input) => fqsParse(input),
  };
}
