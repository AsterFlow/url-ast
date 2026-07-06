import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { initSync } from 'wasm/wasm'
import { isWasmAvailable, setWasmAvailable } from './wasmState'

/**
 * Synchronously initialises the WASM engine by loading `wasm_bg.wasm` from the
 * unified distribution's `dist/wasm` directory. Used by the Node entry point
 * (`url-ast`) for zero-config startup; browser/edge consumers use the `url-ast/browser`
 * entry and its async `initWasm` instead (this module imports `node:fs`).
 *
 * The glue (`wasm/wasm`) is inlined into the bundle at build time; only the raw
 * binary is loaded at runtime. We resolve it relative to this module so it works
 * both from the published bundle (`dist/{mjs,cjs}/index.js` -> `dist/wasm/`) and
 * when running the sources directly in dev (`src/` -> `dist/wasm/`).
 */
export { isWasmAvailable }

const candidatePaths = [
  '../wasm/wasm_bg.wasm',      // published: dist/mjs|cjs/index.js -> dist/wasm/
  '../dist/wasm/wasm_bg.wasm', // dev: src/initWasmSync.ts -> dist/wasm/
]

for (const relativePath of candidatePaths) {
  try {
    const path = fileURLToPath(new URL(relativePath, import.meta.url))
    initSync({ module: readFileSync(path) })
    setWasmAvailable(true)
    break
  } catch {
    // Try the next candidate location.
  }
}
