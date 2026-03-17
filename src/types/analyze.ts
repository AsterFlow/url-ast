/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Maps a 'number', 'boolean', 'string' string or '1,2,3' lists to the corresponding type
 */
export type TypeMap<T extends string> =
  T extends 'string'   ? string :
  T extends 'number'   ? number :
  T extends 'boolean'  ? boolean :
  T extends 'array'    ? string[] :
  // If it's a list "a,b,c" or "1,2,3", get the first element and make it an array
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
 * Constructs the params object from the ":key=type" segments
 */
export type ParseParams<S extends string> = {
  [Seg in Split<ExtractPath<S>, '/'>[number] as
    Seg extends `:${infer Key}=${infer _T}` ? Key : 
    Seg extends `:${infer Key}` ? Key : never
  ]: Seg extends `:${infer _Key}=${infer T}`
    ? TypeMap<T>
    : Seg extends `:${infer _Key}`
    ? string
    : never
}

/**
 * Constructs the searchParams object, accepting "key=value" or just "key"
 */
export type ParseSearch<S extends string> = {
  [Param in Split<ExtractQuery<S>, '&'>[number] as
    Param extends `${infer Key}=${infer _V}` ? Key : Param
  ]:
    Param extends `${infer _Key}=${infer V}`
      ? TypeMap<V>
      : string
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