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
   * This expression is used in the Asterisk (*) Delimiter
   */
  Void = 250,
  Path = 251,
  Variable = 252,
  /**
   * This expression is used in the Hash (#) Delimiter
   */
  Fragment = 253,
  /**
   * This expression is used after the Query (?), Ampersand (&), and Semicolon (;) Delimiters
   */
  Parameter = 254,
  /**
   * This expression is used after the Equal (=) Delimiter
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

export const delimitersValues = Object.values(Delimiters).filter((v): v is number => typeof v === 'number')
export const grammarTokens = [
  ...delimitersValues,
  ...Object.values(EncodingSymbols)
].filter((v): v is number => typeof v === 'number')

export const RawTokens = {
  ...Delimiters,
  ...EncodingSymbols,
  ...OriginExpression,
  ...InternalExpression,
  ...ContentTypes,
} as const