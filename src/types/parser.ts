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
 * Removes type definitions from path segments.
 * Recursively processes the path to clean parts like '=number'.
 * @example
 * // '/users/:id=number' -> '/users/:id'
 */
export type SanitizeSegments<Path extends string> =
  Path extends `/${infer Rest}`
    ? `/${SanitizeSegments<Rest>}`
    : Path extends `${infer Segment}/${infer Rest}`
      ? `${(Segment extends `${infer Name}=${string}` ? Name : Segment)}/${SanitizeSegments<Rest>}`
      : Path extends `${infer Name}=${string}`
        ? Name
        : Path

/**
 * Normalizes a URL path by performing several cleaning operations:
 * 1. Replaces double slashes ('//') with a single slash.
 * 2. Removes the URL fragment (e.g., '#about').
 * 3. Removes the query string (e.g., '?data=1').
 * 4. Removes type definitions from path segments (e.g., ':id=number' -> ':id').
 * @example
 * // '/users//:id=number?data=1#profile' -> '/users/:id'
 */
export type NormalizePath<Path extends string> =
  Path extends `${infer Head}//${infer Tail}`
    ? NormalizePath<`${Head}/${Tail}`>
    : SanitizeSegments<RemoveQueryString<RemoveFragment<Path>>>