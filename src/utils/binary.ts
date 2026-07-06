/**
 * Browser-safe binary helpers built on `Uint8Array` / `DataView`, replacing the
 * Node-only `Buffer` API so the serialization layer runs in any environment
 * (browsers, edge runtimes, Node). All multi-byte integers are little-endian to
 * match the Rust/WASM engine's output.
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** UTF-8 encodes `value` into a fresh `Uint8Array`. */
export function encodeUtf8(value: string): Uint8Array {
  return encoder.encode(value)
}

/**
 * Decodes `length` UTF-8 bytes starting at `start` (relative to the start of
 * `view`'s window) into a string.
 */
export function decodeUtf8(view: DataView, start: number, length: number): string {
  return decoder.decode(new Uint8Array(view.buffer, view.byteOffset + start, length))
}

/** Wraps `bytes` in a `DataView` over the same memory (no copy). */
export function toView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}
