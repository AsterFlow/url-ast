export enum ParameterDelimiters {
  /**
   * @property ?
   */
  Query = 63,
  /**
   * @property &
   */
  Ampersand = 38,
  /**
   * @property ;
   */
  Semicolon = 59
}

export enum DynamicVariableDelimiters {
  /**
   * @property :
   */
  Colon = 58,
  /**
   * @property [
   */
  LeftBracket = 91,
  /**
   * @property ]
   */
  RightBracket = 93
}

export enum GeneralDelimiters {
  /**
   * @property /
   */
  Slash = 47,
  /**
   * @property #
   */
  Hash = 35,
  /**
   * @property ,
   */
  Comma = 44
}

export enum Operators {
  /**
   * @property . — Type annotation operator
   */
  TypeAnnotation = 46,
  /**
   * @property = — Default value operator
   */
  Default = 61,
  /**
   * @property ~ — Optional (not) operator
   */
  Not = 126
}
 
export enum OriginExpression {
  Protocol = 246,
  Hostname = 245,
  Port = 244,
  Separator = 243
}

export enum CatchAllExpression {
  /**
   * @property *
   */
  Asterisk = 42
}

export enum InternalExpression {
  None = 0,
  Dynamic = 200,
  DynamicCatchAll = 201,
  DynamicOptionalCatchAll = 202,
  Wildcard = 250,
  Path = 251,
  Variable = 252,
  Fragment = 253,
  Parameter = 254,
  Type = 255,
  Default = 203,
}

export enum ContentTypes {
  Enum = 240,
  Boolean = 247,
  String = 248,
  Number = 249,
  Array = 239
}

export type AllDelimiters = 
  | ParameterDelimiters 
  | DynamicVariableDelimiters 
  | GeneralDelimiters

export type AllValues = 
  | AllDelimiters
  | Operators
  | InternalExpression
  | OriginExpression
  | CatchAllExpression

export const grammarTokens = [
  ...Object.values(ParameterDelimiters),
  ...Object.values(DynamicVariableDelimiters),
  ...Object.values(GeneralDelimiters),
  ...Object.values(CatchAllExpression),
  ...Object.values(Operators),
].filter((tokenValue): tokenValue is number => typeof tokenValue === 'number')

export const CONTENT_TYPE_MAP: Partial<Record<string, ContentTypes>> = {
  number: ContentTypes.Number,
  boolean: ContentTypes.Boolean,
  string: ContentTypes.String,
  array: ContentTypes.Array,
  enum: ContentTypes.Enum,
  enums: ContentTypes.Enum,
}

/** Base name before `[` for annotations like `enum[Admin,User]`. */
export function baseTypeKeyFromAnnotation(src: string): string {
  const i = src.indexOf('[')
  if (i === -1) return src
  return src.slice(0, i)
}

export function contentTypeFromAnnotation(src: string): ContentTypes | undefined {
  const key = baseTypeKeyFromAnnotation(src)
  return CONTENT_TYPE_MAP[key]
}

/** Slice after the first `.` in a template `name.annotation` fragment. */
export function typeAnnotationAfterDot(content: string): string | undefined {
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === Operators.TypeAnnotation) return content.slice(i + 1)
  }
  return undefined
}

/**
 * Parses allowed enum members from `enum[a,b]` / `enums[a,b]`.
 * Returns `undefined` when there is no bracket list (e.g. bare `enum`).
 * Returns `[]` when the list is empty `enum[]`.
 */
export function parseEnumVariantsFromAnnotation(typeSrc: string): string[] | undefined {
  const t = typeSrc.trim()
  const bi = t.indexOf('[')
  if (bi === -1) return undefined
  const base = t.slice(0, bi)
  if (base !== 'enum' && base !== 'enums') return undefined
  let depth = 1
  let j = bi + 1
  while (j < t.length && depth > 0) {
    const c = t.charCodeAt(j)
    if (c === DynamicVariableDelimiters.LeftBracket) depth++
    else if (c === DynamicVariableDelimiters.RightBracket) depth--
    j++
  }
  if (depth !== 0) return undefined
  const inner = t.slice(bi + 1, j - 1)
  if (inner.trim() === '') return []
  return inner.split(',').map(s => s.trim()).filter(s => s.length > 0)
}

export const RawTokens = {
  ...ParameterDelimiters,
  ...DynamicVariableDelimiters,
  ...GeneralDelimiters,
  ...Operators,
  ...OriginExpression,
  ...InternalExpression,
  ...ContentTypes,
} as const

export const SemanticTokens: Record<number, string> = {
  [OriginExpression.Protocol]: 'ProtocolLiteral',
  [OriginExpression.Hostname]: 'HostIdentifier',
  [OriginExpression.Port]: 'PortLiteral',
  [OriginExpression.Separator]: 'Separator',

  [InternalExpression.None]: 'None',
  [InternalExpression.Path]: 'PathSegment',
  [InternalExpression.Dynamic]: 'DynamicSegment',
  [InternalExpression.DynamicCatchAll]: 'CatchAllSegment',
  [InternalExpression.DynamicOptionalCatchAll]: 'OptionalCatchAllSegment',
  [InternalExpression.Variable]: 'VariableDeclaration',
  [InternalExpression.Parameter]: 'ParameterDeclaration',
  [InternalExpression.Type]: 'TypeAnnotation',
  [InternalExpression.Fragment]: 'FragmentIdentifier',
  [InternalExpression.Wildcard]: 'WildcardExpression',

  [ContentTypes.String]: 'StringType',
  [ContentTypes.Number]: 'NumberType',
  [ContentTypes.Boolean]: 'BooleanType',
  [ContentTypes.Array]: 'ArrayType',
  [ContentTypes.Enum]: 'EnumType',

  [ParameterDelimiters.Query]: 'QueryDelimiter',
  [ParameterDelimiters.Ampersand]: 'AmpersandDelimiter',
  [ParameterDelimiters.Semicolon]: 'SemicolonDelimiter',
  [DynamicVariableDelimiters.Colon]: 'ColonDelimiter',
  [DynamicVariableDelimiters.LeftBracket]: 'LeftBracketDelimiter',
  [DynamicVariableDelimiters.RightBracket]: 'RightBracketDelimiter',
  [GeneralDelimiters.Slash]: 'SlashDelimiter',
  [GeneralDelimiters.Hash]: 'HashDelimiter',
  [GeneralDelimiters.Comma]: 'CommaDelimiter',
  [InternalExpression.Default]: 'DefaultValue',
  [Operators.TypeAnnotation]: 'TypeAnnotationOperator',
  [Operators.Default]: 'DefaultOperator',
  [Operators.Not]: 'NotOperator',
  [CatchAllExpression.Asterisk]: 'AsteriskOperator',
}