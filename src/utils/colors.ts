import { ContentTypes, Delimiters, EncodingSymbols, InternalExpression, OriginExpression } from '../types/node'

export function colorize<C extends AnsiColor>(text: string, color: C): string {
  return `\u001b[${color}m${text}\u001b[${AnsiColor.Reset}m`
}

export enum AnsiColor {
  Reset = 0,
  Black = 30,
  Red = 31,
  Green = 32,
  Yellow = 33,
  Blue = 34,
  Magenta = 35,
  Cyan = 36,
  White = 37,
  BrightBlack = 90,
  BrightRed = 91,
  BrightGreen = 92,
  BrightYellow = 93,
  BrightBlue = 94,
  BrightMagenta = 95,
  BrightCyan = 96,
  BrightWhite = 97,
}

export const contentTypeColorMap: Record<ContentTypes, AnsiColor> = {
  [ContentTypes.Boolean]: AnsiColor.BrightGreen,
  [ContentTypes.String]: AnsiColor.BrightYellow,
  [ContentTypes.Number]: AnsiColor.BrightBlue,
  [ContentTypes.Array]: AnsiColor.BrightMagenta,
}

export const expressionKeyColorMap: Record<number, AnsiColor> = {
  [OriginExpression.Protocol]: AnsiColor.BrightCyan,
  [OriginExpression.Hostname]: AnsiColor.Cyan,
  [OriginExpression.Port]: AnsiColor.BrightYellow,

  [Delimiters.Slash]: AnsiColor.Blue,
  [Delimiters.Colon]: AnsiColor.Green,
  [Delimiters.Ampersand]: AnsiColor.BrightBlue,
  [Delimiters.Query]: AnsiColor.BrightWhite,
  [Delimiters.Hash]: AnsiColor.Red,
  [Delimiters.Asterisk]: AnsiColor.BrightRed,
  [Delimiters.LeftBracket]: AnsiColor.Magenta,
  [Delimiters.RightBracket]: AnsiColor.Magenta,

  [EncodingSymbols.Equal]: AnsiColor.White,

  [InternalExpression.Path]: AnsiColor.BrightBlack,
  [InternalExpression.Parameter]: AnsiColor.Green,
  [InternalExpression.Value]: AnsiColor.BrightMagenta,
  [InternalExpression.Ellipsis]: AnsiColor.Black,
  [InternalExpression.Slug]: AnsiColor.Green,
  [InternalExpression.Fragment]: AnsiColor.BrightCyan,
  [InternalExpression.Variable]: AnsiColor.Green,
}