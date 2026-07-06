/**
 * Shared engine-availability flag, set by whichever initialization path runs:
 * {@link initWasmSync} (Node, synchronous at import) or `initWasm` (browser/edge,
 * asynchronous). Kept in its own module so the WASM bridge can read it without
 * importing a Node-only init path, which would pull `node:fs` into browser
 * bundles.
 */
export let isWasmAvailable = false

/** Marks the WASM engine as initialised. Called once by an init path. */
export function setWasmAvailable(value: boolean): void {
  isWasmAvailable = value
}
