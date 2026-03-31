import { build, gzipSync } from 'bun'
import { generateDtsBundle } from 'dts-bundle-generator'
import { existsSync, } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

async function cleanDistDirectory(directoryPath: string): Promise<void> {
  if (existsSync(directoryPath)) {
    await rm(directoryPath, { recursive: true })
  }
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

  await writePackageJson('dist/cjs', 'commonjs')
  await writePackageJson('dist/mjs', 'module')

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