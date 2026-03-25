import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { generateDtsBundle } from 'dts-bundle-generator'
import { build, type Plugin } from 'esbuild'

async function removeBlockComments(targetFilePath: string): Promise<void> {
  const fileContent = await readFile(targetFilePath, 'utf-8')
  const cleanedContent = fileContent.replace(/\/\*[\s\S]*?\*\//g, '')
  
  await writeFile(targetFilePath, cleanedContent, 'utf-8')
}

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

function createExternalPlugin(moduleFormat: 'cjs' | 'esm'): Plugin {
  return {
    name: 'rewrite-external-imports',
    setup(buildProcess) {
      buildProcess.onResolve({ filter: /decodeURL/ }, () => {
        const fileExtension = moduleFormat === 'cjs' ? '.cjs' : '.js'
        
        return {
          path: `./utils/decodeURL${fileExtension}`,
          external: true
        }
      })
    }
  }
}

async function buildProject(): Promise<void> {
  const distDirectory = 'dist'
  const currentWorkingDirectory = process.cwd()

  await cleanDistDirectory(distDirectory)

  await Promise.all([
    build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      format: 'cjs',
      outdir: 'dist/cjs',
      outExtension: { '.js': '.cjs' },
      minifySyntax: true,
      minifyWhitespace: false,
      minifyIdentifiers: false,
      legalComments: 'none',
      target: 'es2024',
      plugins: [createExternalPlugin('cjs')]
    }),

    build({
      entryPoints: ['src/utils/decodeURL.ts'],
      bundle: true,
      format: 'cjs',
      outdir: 'dist/cjs/utils',
      outExtension: { '.js': '.cjs' },
      minify: true,
      target: 'es2024'
    }),

    build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      format: 'esm',
      outdir: 'dist/mjs',
      minifySyntax: true,
      minifyWhitespace: false,
      minifyIdentifiers: false,
      legalComments: 'none',
      target: 'es2024',
      plugins: [createExternalPlugin('esm')]
    }),

    build({
      entryPoints: ['src/utils/decodeURL.ts'],
      bundle: true,
      format: 'esm',
      outdir: 'dist/mjs/utils',
      minify: true,
      target: 'es2024'
    })
  ])

  await Promise.all([
    writePackageJson('dist/cjs', 'commonjs'),
    writePackageJson('dist/mjs', 'module'),
    generateTypes(join(currentWorkingDirectory, 'src/index.ts'), join(currentWorkingDirectory, 'dist/types'))
  ])

  await Promise.all([
    removeBlockComments('dist/cjs/index.cjs'),
    removeBlockComments('dist/mjs/index.js')
  ])
}

buildProject().catch((buildError: unknown) => {
  console.error(buildError)
})