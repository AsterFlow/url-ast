import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { initSync } from 'wasm/wasm'

/**
 * Inicializa o Wasm de forma síncrona em Bun/Node (ficheiro `wasm_bg.wasm` ao lado do glue).
 * O alvo wasm-pack deve ser `web` (exporta `initSync` + `parseAndAnalyze`).
 */
export let isWasmAvailable = false
try {
	const resolved = import.meta.resolve('wasm/wasm_bg.wasm')
	const path = fileURLToPath(new URL(resolved))
	initSync({ module: readFileSync(path) })
	isWasmAvailable = true
} catch {
	isWasmAvailable = false
}
