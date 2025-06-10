// build.ts
import { build, type Options } from 'tsup'
import { writeFile } from 'fs/promises'
import { generateDtsBundle } from 'dts-bundle-generator'
import { dirname, join } from 'path'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { rm } from 'fs/promises'

async function buildProject() {
  if (existsSync('dist')) await rm('dist', { recursive: true })

  const sharedConfig: Options = {
    platform: 'node',
    entry: ['src/index.ts'],
    bundle: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    skipNodeModulesBundle: true,
    clean: true,
    dts: false,
    target: 'es2022',
    tsconfig: 'tsconfig.json',
  }

  await build({
    ...sharedConfig,
    format: 'cjs',
    outDir: 'dist/cjs',
  })

  await build({
    ...sharedConfig,
    format: 'esm',
    outDir: 'dist/mjs',
    splitting: true,
  })

  await writeFile('dist/cjs/package.json', JSON.stringify({ type: 'commonjs' }, null, 2))
  await writeFile('dist/mjs/package.json', JSON.stringify({ type: 'module' }, null, 2))

  const dtsPath = join(process.cwd(), 'dist/types/index.d.ts') 
  const dtsCode = generateDtsBundle([{
    filePath: join(process.cwd(), 'src/index.ts'),
    output: {
      sortNodes: true,
      exportReferencedTypes: false, 
      inlineDeclareExternals: true,
      inlineDeclareGlobals: true
    }
  }])

  await mkdir(dirname(dtsPath), { recursive: true })
  await writeFile(dtsPath, dtsCode.join('\n'), { encoding: 'utf-8' })
}

buildProject().catch(console.error) 