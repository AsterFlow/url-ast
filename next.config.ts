import bundleAnalyzer from '@next/bundle-analyzer'
import nextra from 'nextra'
import { readFileSync } from 'fs'
import { join } from 'path'

const withNextra = nextra({
  defaultShowCopyCode: true,
  unstable_shouldAddLocaleToLinks: true,
  latex: true,
  contentDirBasePath: '/'
})

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true'
})

const repositorySubpath = '/url-ast'

const nextConfiguration = withBundleAnalyzer(
  withNextra({
    reactStrictMode: true,
    output: 'export',
    basePath: repositorySubpath,
    assetPrefix: repositorySubpath, 
    images: {
      unoptimized: true
    },
    i18n: {
      locales: ['en', 'pt-BR'],
      defaultLocale: 'en'
    },
    env: {
      URL_AST_TYPES: readFileSync(join(process.cwd(), 'node_modules/url-ast/dist/types/index.d.ts'), 'utf-8')
    },
    webpack(webpackConfiguration) {
      const { test: testLoader, ...imageLoaderOptions } = webpackConfiguration.module.rules.find(
        // @ts-expect-error -- O Next.js possui tipagens confusas para essa regra interna
        ruleTarget => ruleTarget.test?.test?.('.svg')
      )
      
      webpackConfiguration.module.rules.push({
        test: /\.svg$/,
        oneOf: [
          {
            resourceQuery: /svgr/,
            use: ['@svgr/webpack']
          },
          imageLoaderOptions
        ]
      })
      
      return webpackConfiguration
    },
    turbopack: {
      rules: {
        './app/_icons/*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js'
        }
      }
    },
    experimental: {
      optimizePackageImports: []
    }
  })
)

export default nextConfiguration