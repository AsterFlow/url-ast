import { CatchAllExpression, ContentTypes, DynamicVariableDelimiters, GeneralDelimiters, InternalExpression, Operators, OriginExpression, ParameterDelimiters } from '../types/node'

export enum AnsiColor {
  Reset = '\x1b[0m',
  Bold = '\x1b[1m',
  Italic = '\x1b[3m',
  Underline = '\x1b[4m',
  Black = '\x1b[30m',
  Red = '\x1b[31m',
  Green = '\x1b[32m',
  Yellow = '\x1b[33m',
  Blue = '\x1b[34m',
  Magenta = '\x1b[35m',
  Cyan = '\x1b[36m',
  White = '\x1b[37m',
  BrightBlack = '\x1b[90m',
  BrightRed = '\x1b[91m',
  BrightGreen = '\x1b[92m',
  BrightYellow = '\x1b[93m',
  BrightBlue = '\x1b[94m',
  BrightMagenta = '\x1b[95m',
  BrightCyan = '\x1b[96m',
  BrightWhite = '\x1b[97m',
}

export function colorize(text: string, color: AnsiColor): string {
  return `${color}${text}${AnsiColor.Reset}`
}

// Mantendo contraste semântico para os tipos de conteúdo
export const contentTypeColorMap: Record<number, AnsiColor> = {
  [ContentTypes.Number]: AnsiColor.BrightYellow,
  [ContentTypes.Boolean]: AnsiColor.BrightBlue,
  [ContentTypes.String]: AnsiColor.BrightGreen,
  [ContentTypes.Array]: AnsiColor.BrightMagenta,
  [ContentTypes.Enum]: AnsiColor.BrightCyan,
}

// Cores distribuídas visando hierarquia visual e separação de contexto
export const expressionKeyColorMap: Record<number, AnsiColor> = {
  // Delimitadores em cinza para reduzir o ruído na leitura da árvore
  [GeneralDelimiters.Hash]: AnsiColor.BrightBlack,
  [GeneralDelimiters.Slash]: AnsiColor.BrightBlack,
  [ParameterDelimiters.Ampersand]: AnsiColor.BrightBlack,
  [ParameterDelimiters.Semicolon]: AnsiColor.BrightBlack,
  [ParameterDelimiters.Query]: AnsiColor.BrightBlack,
  [DynamicVariableDelimiters.Colon]: AnsiColor.BrightBlack,
  [GeneralDelimiters.Comma]: AnsiColor.BrightBlack,
  
  // Exceções de delimitadores que precisam de destaque
  [CatchAllExpression.Asterisk]: AnsiColor.BrightRed,
  [DynamicVariableDelimiters.LeftBracket]: AnsiColor.White,
  [DynamicVariableDelimiters.RightBracket]: AnsiColor.White,

  [Operators.TypeAnnotation]: AnsiColor.BrightWhite,
  [Operators.Default]: AnsiColor.BrightWhite,

  // Base da URL com cores primárias de alto contraste
  [OriginExpression.Protocol]: AnsiColor.BrightMagenta,
  [OriginExpression.Hostname]: AnsiColor.BrightBlue,
  [OriginExpression.Port]: AnsiColor.BrightYellow,
  [OriginExpression.Separator]: AnsiColor.BrightBlack,

  // Expressões internas com variações complementares
  [InternalExpression.None]: AnsiColor.Reset,
  [InternalExpression.Path]: AnsiColor.BrightCyan,
  [InternalExpression.Fragment]: AnsiColor.Yellow,
  [InternalExpression.Parameter]: AnsiColor.BrightGreen,
  [InternalExpression.Type]: AnsiColor.White,
  [InternalExpression.Variable]: AnsiColor.Cyan,
  
  // Variações de expressões dinâmicas com gradação de cores
  [InternalExpression.Dynamic]: AnsiColor.Blue,
  [InternalExpression.DynamicCatchAll]: AnsiColor.BrightBlue,
  [InternalExpression.DynamicOptionalCatchAll]: AnsiColor.BrightMagenta,

  [InternalExpression.Default]: AnsiColor.BrightGreen,
  [InternalExpression.Wildcard]: AnsiColor.BrightRed,
}