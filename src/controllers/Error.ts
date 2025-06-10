import { AnsiColor, colorize } from '../utils/colors'

/**
 * Represents a parsing error with structured information.
 */
export class ErrorLog {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly start: number,
    public readonly end: number
  ) {}

  /**
   * Displays the error message with its location.
   */
  display(input: string): string {
    return colorize((
      `Error [${this.code}] at col ${this.start}: ${this.message}\n` +
      `${input}\n` +
      `${' '.repeat(this.start)}${'^'.repeat(Math.max(1, this.end - this.start))}`
    ), AnsiColor.Red)
  }
}