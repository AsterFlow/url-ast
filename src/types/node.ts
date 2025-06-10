export enum Delimiters {
  /**
   * @property &
   */
  Ampersand = 38,
  /**
   * @property ;
   */
  Semicolon = 59,
  /**
   * @property #
   */
  Hash = 35,
  /**
   * @property ?
   */
  Query = 63,
  /**
   * @property :
   */
  Colon = 58,
  /**
   * @property /
   */
  Slash = 47,
  /**
   * @property *
   */
  Asterisk = 42,
  /**
   * @property [
   */
  LeftBracket = 91,
  /**
   * @property ]
   */
  RightBracket = 93
}

export enum EncodingSymbols {
  /**
   * @property =
   */
  Equal = 61,
}
 
export enum OriginExpression {
  Protocol = 246,
  Hostname = 245,
  Port = 244
}

export enum CatchAllExpression {
  /**
   * @property .
   */
  Point = 46,
}

export enum InternalExpression {
  Null = 0,   // no active token
  Slug = 243,
  Ellipsis = 242,
  /**
   * Essa expressão é utilizada no Delimitador Asterisk (*)
   */
  Void = 250,
  Path = 251,
  Variable = 252,
  /**
   * Essa expressão é utilizada no Delimitador Hash (#)
   */
  Fragment = 253,
  /**
   * Essa expressão é utilizada após os Delimitadores Query (?), Ampersand (&) e Semicolon (;)
   */
  Parameter = 254,
  /**
   * Essa expressão é utilizada após os Delimitador Equal (=)
   */
  Value = 255,
}

export enum ContentTypes {
  Boolean = 247,
  String = 248,
  Number = 249,
  Array = 250,
}

export type AllValues = 
  | Delimiters
  | EncodingSymbols
  | InternalExpression
  | OriginExpression

export const delimitersValues = Object.values(Delimiters)
export const RawTokens = {
  ...Delimiters,
  ...EncodingSymbols,
  ...OriginExpression,
  ...InternalExpression,
  ...ContentTypes,
} as const