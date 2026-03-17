import { expect, describe, it } from 'bun:test'
import decodeURIComponentUTF8 from '../src/utils/decodeURL'
import { stripAnsi, pad, renderTable, colorizePath } from '../src/utils/table'
import { AnsiColor, colorize } from '../src/utils/colors'

describe('Utils: decodeURL', () => {
  it('should return null for invalid hex characters', () => {
    expect(decodeURIComponentUTF8('%ZZ')).toBeNull()
  })

  it('should decode 2-byte UTF-8 sequences', () => {
    // '¢' is %C2%A2
    expect(decodeURIComponentUTF8('%C2%A2')).toBe('¢')
  })

  it('should decode 3-byte UTF-8 sequences', () => {
    // '€' is %E2%82%AC
    expect(decodeURIComponentUTF8('%E2%82%AC')).toBe('€')
  })

  it('should decode 4-byte UTF-8 sequences', () => {
    // '𐍈' is %F0%90%8D%88
    expect(decodeURIComponentUTF8('%F0%90%8D%88')).toBe('𐍈')
  })

  it('should return null for invalid UTF-8 sequences (REJECT state)', () => {
    // Invalid start byte
    expect(decodeURIComponentUTF8('%FF')).toBeNull()
    // Incomplete sequence
    expect(decodeURIComponentUTF8('%C2')).toBeNull()
  })
  
  it('should return null if sequence is interrupted', () => {
    // %C2 followed by something not %
    expect(decodeURIComponentUTF8('%C2abc')).toBeNull()
  })
})

describe('Utils: table', () => {
  it('should remove ANSI codes when using stripAnsi', () => {
    const colored = colorize('test', AnsiColor.Red)
    expect(stripAnsi(colored)).toBe('test')
  })

  it('should handle text longer than width when using pad()', () => {
    expect(pad('hello world', 5)).toBe('hello world')
  })

  it('should handle missing row values when using renderTable()', () => {
    const rows = [{ a: '1', b: '2' }, { a: '3' }] as any[]
    const headers = { a: 'A', b: 'B' }
    const output = renderTable(rows, headers)
    expect(output).toContain('-') // Default for missing value
  })

  it('should handle nodes with unknown expressions when using colorizePath()', () => {
    const input = 'abc'
    const nodes = [{ start: 0, end: 3, expression: 999 }]
    const output = colorizePath(input, nodes)
    expect(stripAnsi(output)).toBe('abc')
  })
})
