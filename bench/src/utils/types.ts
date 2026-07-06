export interface BenchResult {
  readonly operation: string;
  readonly opsPerSecond: number;
  readonly latencyNs: number;
  readonly rank: number;
}

export interface SuiteReport {
  readonly name: string;
  readonly description: string;
  readonly results: BenchResult[];
}

/**
 * A standardized adapter for comparing URL parsing libraries.
 * Only `name` and `parse` are required — every other method is optional
 * so each library only exposes what it actually supports natively.
 */
export interface ParserAdapter {
  /** Human-readable library name shown in reports */
  readonly name: string;

  /** Parse the full URL / input string (constructor-level cost) */
  parse(input: string): unknown;

  /** Extract path parameters / segments from a URL */
  params?(input: string): unknown;

  /** Extract query string / search params from a URL */
  query?(input: string): unknown;

  /** Extract the fragment / hash from a URL */
  fragment?(input: string): unknown;

  /** Extract the hostname from a URL */
  hostname?(input: string): unknown;

  /** Extract the port from a URL */
  port?(input: string): unknown;

  /** Extract the protocol / scheme from a URL */
  protocol?(input: string): unknown;

  /** Extract the pathname from a URL */
  pathname?(input: string): unknown;
}
