/**
 * Removes the fragment identifier from a URL path.
 * @example
 * // '/page#about' -> '/page'
 */
export type RemoveFragment<Path extends string> = 
  Path extends `${infer CleanPath}#${string}`
    ? CleanPath
    : Path

/**
 * Removes the query string from a URL path.
 * @example
 * // '/users?data=1' -> '/users'
 */
export type RemoveQueryString<Path extends string> = 
  Path extends `${infer CleanPath}?${string}`
    ? CleanPath
    : Path

/**
 * Helper to strip optional prefix '~' and type/default annotations from a segment.
 */
type SanitizeSegment<S extends string> =
  S extends `:${infer Variable}` ? `:${SanitizeVariable<Variable>}` :
  S extends `~${infer Rest}` ? SanitizeSegment<Rest> :
  S extends `${infer Name}.${string}` ? Name :
  S extends `${infer Name}=${string}` ? Name :
  S

/**
 * Helper to strip optional prefix '~' and type/default annotations from a variable name.
 */
type SanitizeVariable<V extends string> =
  V extends `~${infer Rest}` ? SanitizeVariable<Rest> :
  V extends `${infer Name}.${string}` ? Name :
  V extends `${infer Name}=${string}` ? Name :
  V

/**
 * Removes type annotations (.type) and default values (=value) from path segments.
 * @example
 * // '/users/:~id.number=42' -> '/users/:id'
 */
export type SanitizeSegments<Path extends string> =
  Path extends `/${infer Rest}`
    ? `/${SanitizeSegments<Rest>}`
    : Path extends `${infer Segment}/${infer Rest}`
      ? `${SanitizeSegment<Segment>}/${SanitizeSegments<Rest>}`
      : SanitizeSegment<Path>


/**
 * Normalizes a URL path by performing several cleaning operations:
 * 1. Replaces double slashes ('//') with a single slash.
 * 2. Removes the URL fragment (e.g., '#about').
 * 3. Removes the query string (e.g., '?data=1').
 * 4. Removes type annotations from path segments (e.g., ':id.number' -> ':id').
 * @example
 * // '/users//:id.number?data=1#profile' -> '/users/:id'
 */
export type NormalizePath<Path extends string> =
  Path extends `${infer Head}//${infer Tail}`
    ? NormalizePath<`${Head}/${Tail}`>
    : SanitizeSegments<RemoveQueryString<RemoveFragment<Path>>>