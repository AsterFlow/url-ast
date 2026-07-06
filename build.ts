import { build, gzipSync, spawn } from 'bun'
import { generateDtsBundle } from 'dts-bundle-generator'
import { existsSync, } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

async function cleanDistDirectory(directoryPath: string): Promise<void> {
  if (existsSync(directoryPath)) {
    await rm(directoryPath, { recursive: true })
  }
}

/**
 * Builds the Rust/WASM component of the distribution into `dist/wasm`.
 * Must run after the dist clean and before bundling so the glue resolves.
 */
async function buildWasm(): Promise<void> {
  const proc = spawn(['bash', 'scripts/build-wasm.sh'], {
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`WASM build failed (exit code ${exitCode})`)
  }
}

/**
 * Retargets the wasm-bindgen glue's default init path in the browser bundle from
 * `new URL('wasm_bg.wasm', import.meta.url)` to the shared binary in `dist/wasm`.
 *
 * Bundlers (webpack/Turbopack) resolve that `new URL(...)` statically relative to
 * the bundle, so the referenced file must exist on disk. Pointing it at the single
 * `dist/wasm/wasm_bg.wasm` keeps the browser bundle lightweight — no duplicated
 * binary beside it.
 */
async function pointBrowserBundleAtSharedWasm(bundlePath: string): Promise<void> {
  const source = await readFile(bundlePath, 'utf-8')
  const pattern = /new URL\((["'])wasm_bg\.wasm\1,\s*import\.meta\.url\)/g
  const patched = source.replace(pattern, 'new URL($1../wasm/wasm_bg.wasm$1, import.meta.url)')

  if (patched === source) {
    throw new Error(
      'Could not retarget the wasm path in dist/browser/browser.js; the wasm-bindgen glue output may have changed.'
    )
  }

  await writeFile(bundlePath, patched)
}

async function writePackageJson(directoryPath: string, moduleType: 'commonjs' | 'module'): Promise<void> {
  const packageJsonPath = join(directoryPath, 'package.json')
  const packageJsonContent = JSON.stringify({ type: moduleType }, null, 2)

  await writeFile(packageJsonPath, packageJsonContent)
}

async function generateTypes(sourceFilePath: string, outputDirectory: string): Promise<void> {
  const declarationPath = join(outputDirectory, 'index.d.ts')
  const declarationCodeArray = generateDtsBundle([{
    filePath: sourceFilePath,
    output: {
      sortNodes: true,
      exportReferencedTypes: false,
      inlineDeclareExternals: true,
      inlineDeclareGlobals: true
    }
  }])

  await mkdir(dirname(declarationPath), { recursive: true })
  await writeFile(declarationPath, declarationCodeArray.join('\n'), { encoding: 'utf-8' })
}

(async () => {
  const currentWorkingDirectory = process.cwd()
  await cleanDistDirectory('dist')

  // 1. Build the WASM component into dist/wasm (glue gets inlined below).
  await buildWasm()

  // 2. Bundle the TypeScript bridge into ESM, CJS and type declarations.
  await build({
    entrypoints: ['src/index.ts'],
    outdir: 'dist/cjs',
    format: 'cjs',
    target: 'node',
    minify: true,
    sourcemap: 'linked',
  })

  await build({
    entrypoints: ['src/index.ts'],
    outdir: 'dist/mjs',
    format: 'esm',
    target: 'node',
    minify: true,
    sourcemap: 'linked',
  })

  // Browser/edge ESM bundle: no `node:fs`, engine initialised via async `initWasm`.
  await build({
    entrypoints: ['src/browser.ts'],
    outdir: 'dist/browser',
    format: 'esm',
    target: 'browser',
    minify: true,
    sourcemap: 'linked',
  })

  await writePackageJson('dist/cjs', 'commonjs')
  await writePackageJson('dist/mjs', 'module')
  await writePackageJson('dist/browser', 'module')

  await pointBrowserBundleAtSharedWasm(join(currentWorkingDirectory, 'dist/browser/browser.js'))

  await generateTypes(join(currentWorkingDirectory, 'src/index.ts'), join(currentWorkingDirectory, 'dist/types'))

  const esmFilePath = join(currentWorkingDirectory, 'dist/mjs/index.js')
  if (existsSync(esmFilePath)) {
    const fileBuffer = await readFile(esmFilePath)
    const gzippedBytes = gzipSync(fileBuffer)

    const toKB = (bytesSize: number) => (bytesSize / 1024).toFixed(2) + ' KB'

    console.log(JSON.stringify({
      uncompressedSize: toKB(fileBuffer.length),
      compressedSize: toKB(gzippedBytes.length)
    }))
  }
})()