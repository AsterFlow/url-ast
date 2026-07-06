import {
  analyzeFragment,
  analyzeFragmentInstance,
  analyzeHostname,
  analyzeParamsInstance,
  analyzeParamsTemplate,
  analyzePathname,
  analyzePort,
  analyzeProtocol,
  analyzeSearchInstance,
  analyzeSearchTemplate,
  analyzeStaticProps,
  parsePathView,
} from 'wasm/wasm'
import { ErrorLog } from './controllers/Error'
import { Node } from './controllers/Node'
import { isWasmAvailable } from './initWasmSync'

export { isWasmAvailable }

/** A casted runtime value (`string | number | boolean | string[]`). */
export type WasmValue = string | number | boolean | string[]

/**
 * Result of a WASM parse: the root node tree (rebuilt from the shared-memory
 * binary buffer) plus the parse-time error list.
 */
export interface WasmParseResult {
  nodes: Node[]
  errors: ErrorLog[]
}

/**
 * Parses `input` in the Rust/WASM engine and decodes the MemoryShare buffer.
 *
 * Buffer layout (see `wasm/bridge/mod.rs`):
 * - `u16` rootCount
 * - root nodes (`Node.SIZE`-byte records, recursive) — read by {@link Node.fromBuffer}
 * - `u16` errorCount
 * - errors: `u16 codeLen, code, u16 msgLen, msg, u32 start, u32 end`
 */
export function parsePathWasm(input: string): WasmParseResult {
  // `parsePathView` returns a Uint8Array aliasing WASM linear memory (no copy out).
  // Wrap it in a Buffer view (also no copy) and decode synchronously before any
  // further WASM call can invalidate the shared buffer.
  const shared = parsePathView(input)
  const view = Buffer.from(shared.buffer, shared.byteOffset, shared.byteLength)

  let offset = 0
  const rootCount = view.readUInt16LE(offset)
  offset += 2

  const { nodes, newOffset } = Node.fromBuffer(view, offset, rootCount)
  offset = newOffset

  const errorCount = view.readUInt16LE(offset)
  offset += 2

  const errors: ErrorLog[] = []
  for (let i = 0; i < errorCount; i++) {
    const codeLength = view.readUInt16LE(offset)
    offset += 2
    const code = view.toString('utf-8', offset, offset + codeLength)
    offset += codeLength

    const messageLength = view.readUInt16LE(offset)
    offset += 2
    const message = view.toString('utf-8', offset, offset + messageLength)
    offset += messageLength

    const start = view.readUInt32LE(offset)
    offset += 4
    const end = view.readUInt32LE(offset)
    offset += 4

    errors.push(new ErrorLog(code, message, start, end))
  }

  return { nodes, errors }
}

// === analyzer result decoding ===

interface Cursor {
  view: Buffer
  offset: number
}

function asView(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function readString(cursor: Cursor): string {
  const length = cursor.view.readUInt32LE(cursor.offset)
  cursor.offset += 4
  const value = cursor.view.toString('utf-8', cursor.offset, cursor.offset + length)
  cursor.offset += length
  return value
}

function readValue(cursor: Cursor): WasmValue {
  const tag = cursor.view.readUInt8(cursor.offset)
  cursor.offset += 1
  switch (tag) {
  case 0:
    return readString(cursor)
  case 1: {
    const num = cursor.view.readDoubleLE(cursor.offset)
    cursor.offset += 8
    return num
  }
  case 2: {
    const bool = cursor.view.readUInt8(cursor.offset) === 1
    cursor.offset += 1
    return bool
  }
  case 3:
  default: {
    const count = cursor.view.readUInt32LE(cursor.offset)
    cursor.offset += 4
    const list: string[] = []
    for (let i = 0; i < count; i++) list.push(readString(cursor))
    return list
  }
  }
}

function readMap(cursor: Cursor): [string, WasmValue][] {
  const count = cursor.view.readUInt32LE(cursor.offset)
  cursor.offset += 4
  const entries: [string, WasmValue][] = []
  for (let i = 0; i < count; i++) {
    const key = readString(cursor)
    const value = readValue(cursor)
    entries.push([key, value])
  }
  return entries
}

function readErrorLog(cursor: Cursor): ErrorLog {
  const codeLength = cursor.view.readUInt16LE(cursor.offset)
  cursor.offset += 2
  const code = cursor.view.toString('utf-8', cursor.offset, cursor.offset + codeLength)
  cursor.offset += codeLength
  const messageLength = cursor.view.readUInt16LE(cursor.offset)
  cursor.offset += 2
  const message = cursor.view.toString('utf-8', cursor.offset, cursor.offset + messageLength)
  cursor.offset += messageLength
  const start = cursor.view.readUInt32LE(cursor.offset)
  cursor.offset += 4
  const end = cursor.view.readUInt32LE(cursor.offset)
  cursor.offset += 4
  return new ErrorLog(code, message, start, end)
}

function readErrors(cursor: Cursor): ErrorLog[] {
  const count = cursor.view.readUInt32LE(cursor.offset)
  cursor.offset += 4
  const errors: ErrorLog[] = []
  for (let i = 0; i < count; i++) errors.push(readErrorLog(cursor))
  return errors
}

/** Result of an instance-mode extraction that may throw a cast error. */
export type InstanceResult =
  | { ok: true; entries: [string, WasmValue][] }
  | { ok: false; error: ErrorLog }

function decodeInstanceResult(bytes: Uint8Array): InstanceResult {
  const cursor: Cursor = { view: asView(bytes), offset: 0 }
  const status = cursor.view.readUInt8(cursor.offset)
  cursor.offset += 1
  if (status === 1) {
    return { ok: false, error: readErrorLog(cursor) }
  }
  return { ok: true, entries: readMap(cursor) }
}

export function analyzePathnameWasm(input: string): string {
  return analyzePathname(input)
}

export function analyzeProtocolWasm(input: string): string | undefined {
  return analyzeProtocol(input) ?? undefined
}

export function analyzeHostnameWasm(input: string): string | undefined {
  return analyzeHostname(input) ?? undefined
}

export function analyzePortWasm(input: string): string | undefined {
  return analyzePort(input) ?? undefined
}

export function analyzeFragmentWasm(input: string): string | undefined {
  return analyzeFragment(input) ?? undefined
}

export function analyzeParamsTemplateWasm(input: string): { names: string[]; errors: ErrorLog[] } {
  const cursor: Cursor = { view: asView(analyzeParamsTemplate(input)), offset: 0 }
  const count = cursor.view.readUInt32LE(cursor.offset)
  cursor.offset += 4
  const names: string[] = []
  for (let i = 0; i < count; i++) names.push(readString(cursor))
  const errors = readErrors(cursor)
  return { names, errors }
}

export function analyzeSearchTemplateWasm(input: string): {
  entries: [string, string | string[]][]
  errors: ErrorLog[]
} {
  const cursor: Cursor = { view: asView(analyzeSearchTemplate(input)), offset: 0 }
  const entries = readMap(cursor) as [string, string | string[]][]
  const errors = readErrors(cursor)
  return { entries, errors }
}

export function analyzeParamsInstanceWasm(baseInput: string, input: string): InstanceResult {
  return decodeInstanceResult(analyzeParamsInstance(baseInput, input))
}

export function analyzeSearchInstanceWasm(baseInput: string, input: string): InstanceResult {
  return decodeInstanceResult(analyzeSearchInstance(baseInput, input))
}

export function analyzeStaticPropsWasm(baseInput: string, input: string): [string, string | string[]][] {
  const cursor: Cursor = { view: asView(analyzeStaticProps(baseInput, input)), offset: 0 }
  return readMap(cursor) as [string, string | string[]][]
}

export function analyzeFragmentInstanceWasm(baseInput: string, input: string): [string, string][] {
  const cursor: Cursor = { view: asView(analyzeFragmentInstance(baseInput, input)), offset: 0 }
  const count = cursor.view.readUInt32LE(cursor.offset)
  cursor.offset += 4
  const entries: [string, string][] = []
  for (let i = 0; i < count; i++) {
    const key = readString(cursor)
    const value = readString(cursor)
    entries.push([key, value])
  }
  return entries
}
