import { generateDtsBundle } from 'dts-bundle-generator'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { build } from 'tsup'

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
    entry: ['src/index.ts'],
    bundle: true,
    minify: true,
    format: ['cjs'],
    outDir: 'dist/cjs',
    target: 'es6',
    sourcemap: true,
    silent: true,
  })

  await build({
    entry: ['src/index.ts'],
    bundle: true,
    minify: true,
    format: ['esm'],
    outDir: 'dist/mjs',
    target: 'es2024',
    sourcemap: true,
    silent: true,
  })

  await writePackageJson('dist/cjs', 'commonjs')
  await writePackageJson('dist/mjs', 'module')
  await generateTypes(join(currentWorkingDirectory, 'src/index.ts'), join(currentWorkingDirectory, 'dist/types'))
})()
