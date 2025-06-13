import { exec as execCallback } from 'child_process'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const exec = promisify(execCallback)

const run = async (command: string) => {
  console.log(`\n> ${command}`)
  const { stdout, stderr } = await exec(command)
  if (stdout) console.log(stdout)
  if (stderr) console.error(stderr)
}

async function publishAll() {
  const packageJsonPath = join(process.cwd(), 'package.json')
  const originalPackageJsonContent = await readFile(packageJsonPath, 'utf-8')
  const packageConfig = JSON.parse(originalPackageJsonContent)

  // Validação inicial para garantir que o script está sendo executado no contexto correto
  if (!packageConfig.private) {
    console.error('❌ ERRO: Para segurança, o package.json deve conter "private": true.')
    console.error('Abordando para prevenir uma publicação acidental. Adicione a flag e tente novamente.')
    process.exit(1)
  }

  const originalName = packageConfig.name
  const aliasName = '@asterflow/url-parser'

  // Cria uma cópia do objeto de configuração para publicação, REMOVENDO a chave "private"
  const publishableConfig = { ...packageConfig }
  delete publishableConfig.private

  try {
    console.log('✅ Executando testes e build do projeto...')
    await run('bun run test')
    await run('bun run build')
    console.log('✨ Build concluído!')

    console.log(`\n🚀 Publicando pacote original: ${originalName}...`)
    publishableConfig.name = originalName
    await writeFile(packageJsonPath, JSON.stringify(publishableConfig, null, 2))
    await run('npm publish')
    console.log(`✅ ${originalName} publicado com sucesso!`)

    console.log(`\n🔄 Trocando para o nome do alias: ${aliasName}...`)
    publishableConfig.name = aliasName
    await writeFile(packageJsonPath, JSON.stringify(publishableConfig, null, 2))
    await run('npm publish --access=public')
    console.log(`✅ ${aliasName} publicado com sucesso!`)

  } catch (error) {
    console.error('\n❌ Ocorreu um erro durante o processo de publicação:')
    console.error(error)
    process.exit(1)
  } finally {
    console.log('\n🧹 Restaurando o package.json original (com "private": true)...')
    await writeFile(packageJsonPath, originalPackageJsonContent)
    console.log('✨ Processo finalizado!')
  }
}

publishAll()