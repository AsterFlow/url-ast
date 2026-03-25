/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AST } from '../controllers/AST'
import type { ErrorLog } from '../controllers/Error'
import type { Node } from '../controllers/Node'

/**
 * Maps a 'number', 'boolean', 'string' string or '1,2,3' lists to the corresponding type
 */
export type TypeMap<T extends string> =
  T extends 'string'   ? string :
  T extends 'number'   ? number :
  T extends 'boolean'  ? boolean :
  T extends 'array'    ? string[] :
  T extends `enum[${string}]` ? string[] :
  T extends 'enum'     ? string[] :
  T extends `${infer First},${infer _Rest}` ? TypeMap<First>[] :
  string

/**
 * Splits S by a delimiter D into a tuple of strings
 */
export type Split<S extends string, D extends string> =
  S extends `${infer Head}${D}${infer Tail}`
    ? [Head, ...Split<Tail, D>]
    : S extends '' 
      ? []
      : [S]

/**
 * Removes the query ('?…') and fragment ('#…') part, and the leading slash
 */
export type ExtractPath<S extends string> =
  S extends `${infer P}?${string}` ? P :
  S extends `${infer P}#${string}` ? P :
  S extends `/${infer Rest}`     ? Rest
  : S

/**
 * Extracts only the query part, without the fragment
 */
export type ExtractQuery<S extends string> =
  S extends `${string}?${infer Q}` 
    ? Q extends `${infer QnoFrag}#${string}` 
      ? QnoFrag 
      : Q
    : ''

/**
 * Extracts only the fragment part
 */
export type ExtractFrag<S extends string> =
  S extends `${string}#${infer F}` ? F : ''

/**
 * Checks if the segment is marked as optional with '~'.
 */
type IsOptional<S extends string> = S extends `~${string}` ? true : false

/**
 * Removes the '~' prefix if present.
 */
type StripOptional<S extends string> = S extends `~${infer Rest}` ? Rest : S

/**
 * Strips the .type and =default annotations from a key, returning just the name.
 */
type StripAnnotations<S extends string> =
  StripOptional<S> extends `${infer Name}.${string}` ? Name :
  StripOptional<S> extends `${infer Name}=${string}` ? Name :
  StripOptional<S>

/**
 * Extracts the .type annotation from a segment. Falls back to 'string'.
 */
type ExtractType<S extends string> =
  StripOptional<S> extends `${string}.${infer T}=${string}` ? T :
  StripOptional<S> extends `${string}.${infer T}` ? T :
  'string'

/**
 * Parameter name inside a catch-all segment `[...slug]`.
 */
type CatchAllParamName<Inner extends string> =
  Inner extends `...${infer Name}` ? Name : never

/**
 * Parameter key for a dynamic segment `[name]`, `[~name]`, `[name.type]`, etc.
 */
type BracketParamKey<Inner extends string> =
  Inner extends `...${string}`
    ? CatchAllParamName<Inner>
    : StripAnnotations<StripOptional<Inner>>

/**
 * Constructs the params object from ":key.type" and "[param]" / "[~param]" / "[...slug]" segments
 */
export type ParseParams<S extends string> = {
  [Seg in Split<ExtractPath<S>, '/'>[number] as
    Seg extends `:${infer Rest}` ? StripAnnotations<Rest> :
    Seg extends `[${infer Inner}]` ? BracketParamKey<Inner> :
    never
  ]: Seg extends `:${infer Rest}`
    ? IsOptional<Rest> extends true ? TypeMap<ExtractType<Rest>> | undefined : TypeMap<ExtractType<Rest>>
    : Seg extends `[${infer Inner}]`
      ? Inner extends `...${string}`
        ? string[]
        : IsOptional<Inner> extends true
          ? TypeMap<ExtractType<Inner>> | undefined
          : TypeMap<ExtractType<Inner>>
      : never
}

/**
 * Constructs the searchParams object, accepting "key.type", "key.type=default", or just "key"
 */
export type ParseSearch<S extends string> = {
  [Param in Split<ExtractQuery<S>, '&'>[number] as
    StripAnnotations<Param>
  ]: IsOptional<Param> extends true ? TypeMap<ExtractType<Param>> | undefined : TypeMap<ExtractType<Param>>
}

/**
 * Constructs the fragment object, which will always be a string
 */
export type ParseFragment<S extends string> =
  ExtractFrag<S> extends ''
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    ? {}
    : { [K in ExtractFrag<S>]: string }

/**
 * Final type that joins everything
 */
export type ParsePath<S extends string> = {
  params:       ParseParams<S>
  searchParams: ParseSearch<S>
  fragment:     ParseFragment<S>
}

export type PathSegment = { nodes: Node[], start: number, end: number }

/** Runtime result of `getParams()` (template: names only; with base: parsed values). */
export type AnalyzeParamsResult =
  | string[]
  | Record<string, string | number | boolean | string[] | undefined>

/** Runtime result of `getSearchParams()`. */
export type AnalyzeSearchParamsResult =
  | Map<string, string | string[]>
  | Record<string, string | number | boolean | string[]>

/** Runtime result of `getFragment()`. */
export type AnalyzeFragmentResult = string | undefined | Record<string, string>

export type AnalyzeInstance<
  Path extends string = string,
  Parser = undefined,
> = {
  readonly input: Path
  readonly errors: ErrorLog[]
  readonly ast: AST<Path>
  base?: Parser

  /**
   * Returns an array of parameter names declared in the template (without values).
   * When called on an instance with a base parser, extracts and casts params based on the template.
   *
   * @returns {string[] | Record<string, string | number | boolean | string[] | undefined>} List of parameter names or extracted parameter values.
   * @throws {Error} If duplicate parameter names are detected or casting fails.
   * @example
   * ```ts
   * const analyzer = new Analyze('http://localhost:3000/:a/:b')
   * console.log(analyzer.getParams()) // ['a','b']
   * 
   * const template = new Analyze('/user/:id=number')
   * const instance = new Analyze('/user/123', template)
   * console.log(instance.getParams()) // { id: 123 }
   * ```
   */
  getParams(): Parser extends AnalyzeInstance<infer T extends string>
    ? ParsePath<T>['params']
    : Parser extends undefined
      ? string[]
      : AnalyzeParamsResult

  /**
   * Returns a Map of search parameters and their values (string or string[] for multiples).
   * When called on an instance with a base parser, extracts and casts search params based on the template types.
   *
   * @returns {Map<string, string | string[]> | Record<string, string | number | boolean | string[]>} The search parameters map or extracted values.
   * @example
   * ```ts
   * const analyzer = new Analyze('?a=1&a=2&b=xyz')
   * console.log(analyzer.getSearchParams().get('a')) // ['1','2']
   * console.log(analyzer.getSearchParams().get('b')) // 'xyz'
   * 
   * const template = new Analyze('?id=number&active=boolean')
   * const instance = new Analyze('?id=99&active=true', template)
   * console.log(instance.getSearchParams()) // { id: 99, active: true }
   * ```
   */
  getSearchParams(): Parser extends AnalyzeInstance<infer T extends string>
    ? ParsePath<T>['searchParams']
    : Parser extends undefined
      ? Map<string, string | string[]>
      : AnalyzeSearchParamsResult

  /**
   * Retrieves the fragment identifier from the input URL or template.
   *
   * The fragment identifier (part after '#') is not sent to the server in HTTP requests
   * because browsers strip it before sending. This method extracts and returns that fragment
   * on the client side only.
   *
   * @returns {string | undefined | Record<string, string>}
   * - Without a base: returns the fragment string (without '#'), or undefined if none.
   * - With a base: returns a record mapping the template fragment key to the instance value.
   *
   * @example
   * ```ts
   * const analyzer = new Analyze('http://localhost:3000/page#section1')
   * console.log(analyzer.getFragment()) // 'section1'
   * 
   * const template = new Analyze('/page#sectionKey')
   * const instance = new Analyze('/page#actualValue', template)
   * console.log(instance.getFragment()) // { sectionKey: 'actualValue' }
   * ```
   */
  getFragment(): Parser extends AnalyzeInstance<infer T extends string>
    ? ParsePath<T>['fragment']
    : Parser extends undefined
      ? string | undefined
      : AnalyzeFragmentResult

  /**
   * Extracts dynamic route parameters by navigating the base AST and finding corresponding
   * values in the instance AST. Supports `[id]` and `[...slug]` formats.
   *
   * @returns {Record<string, string | string[]>} An object mapping parameter names to their extracted values.
   * @example
   * ```ts
   * const template = new Analyze('/users/[id]')
   * const instance = new Analyze('/users/abc-987', template)
   * console.log(instance.getStaticProps()) // { id: 'abc-987' }
   * ```
   */
  getStaticProps(): Record<string, string | string[]>

  /**
   * Retrieves the pathname (path + variables) from the parsed template.
   *
   * @returns {string} The pathname (e.g., '/users/:id').
   * @example
   * ```ts
   * const analyzer = new Analyze('http://localhost:3000/users/:userId/profile')
   * console.log(analyzer.getPathname()) // '/users/:userId/profile'
   * ```
   */
  getPathname(): string

  /**
   * Retrieves the port from the input URL, if present.
   *
   * @returns {string | undefined} The port string, or undefined if none.
   * @example
   * ```ts
   * const analyzer = new Analyze('http://localhost:8080')
   * console.log(analyzer.getPort()) // '8080'
   * ```
   */
  getPort(): string | undefined

  /**
   * Retrieves the hostname from the input URL.
   *
   * @returns {string | undefined} The hostname, or undefined if not found.
   * @example
   * ```ts
   * const analyzer = new Analyze('https://example.com/path')
   * console.log(analyzer.getHostname()) // 'example.com'
   * ```
   */
  getHostname(): string | undefined

  /**
   * Retrieves the protocol (http or https) from the input URL.
   *
   * @returns {string | undefined} The protocol, or undefined if not found.
   * @example
   * ```ts
   * const analyzer = new Analyze('https://site.org')
   * console.log(analyzer.getProtocol()) // 'https'
   * ```
   */
  getProtocol(): string | undefined

  /**
   * Sets the base parser on this instance after construction.
   *
   * @param {S} base - The template Analyze instance to use as base.
   * @returns {AnalyzeInstance<Path, S>} This instance with the new parser type.
   * @example
   * ```ts
   * const template = new Analyze('/user/:id=number')
   * const instance = new Analyze('/user/123').setParser(template)
   * console.log(instance.getParams()) // { id: 123 }
   * ```
   */
  setParser<S extends AnalyzeInstance<string>>(base: S): AnalyzeInstance<Path, S>

  /**
   * Checks if any errors were found during parsing.
   *
   * @param {ErrorLog[]} [errors] - Optional error list to check (defaults to this.errors).
   * @returns {boolean} True if errors exist.
   */
  hasErrors(errors?: ErrorLog[]): boolean

  /**
   * Returns a formatted string of all parsing errors.
   *
   * @param {ErrorLog[]} [errors] - Optional error list to display (defaults to this.errors).
   * @returns {string} The formatted error report.
   */
  displayErrors(errors?: ErrorLog[]): string

  /**
   * Serializes the Analyze instance into a binary Buffer, including its AST and base parser.
   *
   * Buffer Structure:
   * 1. AST Length (4 bytes, LE): Byte size of the serialized AST.
   * 2. AST Data (variable): Binary AST data (generated by AST.getBuffer()).
   * 3. Has Base Flag (1 byte): 1 if a base parser exists, 0 otherwise.
   * 4. Base Length (optional, 4 bytes, LE): Byte size of the serialized base parser.
   * 5. Base Data (optional, variable): Recursively serialized base parser data.
   *
   * @returns {Buffer} Buffer containing the serialized data.
   */
  getBuffer(): Buffer
}

/**
 * Instance where `Path` is `string` (chained bases / `fromBuffer` without a fixed template literal).
 * `base` is recursive so typed chaining works (`fromBuffer`, nested templates).
 */
export type AnalyzeChain = Omit<AnalyzeInstance<string, unknown>, 'base'> & {
  base?: AnalyzeChain
}

export type AnalyzeNewOptions<P extends string = string> = {
  base?: AnalyzeChain
  ast?: AST<P>
}

export interface AnalyzeConstructor {
  new <const P extends string>(input: P): AnalyzeInstance<P, undefined>
  new <const P extends string, const B extends AnalyzeChain>(input: P, base: B): AnalyzeInstance<P, B>
  new <const P extends string>(input: P, options: AnalyzeNewOptions<P>): AnalyzeInstance<P, unknown>

  /**
   * Factory method to create an Analyze instance with full type inference.
   *
   * @param {P} input - The URL or template string.
   * @param {B} [base] - Optional base template Analyze instance.
   * @returns {AnalyzeInstance<P, B>} A new Analyze instance.
   */
  create<const P extends string>(input: P): AnalyzeInstance<P, undefined>
  create<const P extends string, const B extends AnalyzeChain>(input: P, base: B): AnalyzeInstance<P, B>

  /**
   * Reconstructs an Analyze instance from a binary Buffer.
   *
   * Decodes the AST first, checks for a base parser flag, and if present,
   * reconstructs the base parser recursively before instantiating Analyze.
   *
   * @param {Buffer} buffer The Buffer containing serialized data.
   * @returns {AnalyzeChain} A reconstructed Analyze instance.
   */
  fromBuffer(buffer: Buffer): AnalyzeChain
}
