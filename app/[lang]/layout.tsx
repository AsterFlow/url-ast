import { cn } from '@app/_lib/utils'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { redirect } from 'next/navigation'
import {
  Footer,
  LastUpdated,
  Layout,
  LocaleSwitch,
  Navbar
} from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import type { ReactNode } from 'react'

import { getDictionary } from '../_dictionaries/get-dictionary'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  description: 'URL AST é uma biblioteca para extração e tipagem segura de parâmetros de rotas.',
  title: {
    absolute: '',
    template: '%s | URL AST'
  },
  // Atualize para o domínio da sua documentação quando tiver um
  metadataBase: new URL('https://github.com/AsterFlow/url-ast'),
  appleWebApp: {
    title: 'URL AST'
  },
  other: {
    'msapplication-TileColor': '#09090b'
  }
}

type LayoutProps = Readonly<{
  children: ReactNode
  params: Promise<{ lang: string }>
}>

export default async function RootLayout({ children, params }: LayoutProps) {
  const { lang } = await params
  const allowLangs = JSON.parse(process.env.NEXTRA_LOCALES!) as string[]

  if (!allowLangs.includes(lang)) {
    redirect('/pt-BR')
  }

  const dictionary = await getDictionary(lang)
  const pageMap = await getPageMap(`/${lang}`)

  const navbar = (
    <Navbar
      logo={
        <>
          {/* <UrlAstIcon height="12" /> */}
          <span
            className="ms-2 font-extrabold select-none max-md:hidden"
            title={`URL AST: ${dictionary.logo.title}`}
          >
            URL AST
          </span>
        </>
      }
      projectLink="https://github.com/AsterFlow/url-ast"
    >
      <LocaleSwitch lite />
    </Navbar>
  )

  const footer = <Footer />

  return (
    <html lang={lang} suppressHydrationWarning className={cn('font-sans', inter.variable)}>
      <Head
        backgroundColor={{
          dark: 'rgb(9, 9, 11)', // Fundo escuro moderno (Zinc 950)
          light: 'rgb(250, 250, 250)' // Fundo claro limpo (Neutral 50)
        }}
        color={{
          hue: { dark: 210, light: 210 }, // Tom principal (Azul)
          saturation: { dark: 100, light: 100 }
        }}
      />
      <body>
        <Layout
          navbar={navbar}
          footer={footer}
          docsRepositoryBase="https://github.com/AsterFlow/url-ast/tree/docs"
          i18n={[
            { locale: 'en', name: 'English' },
            { locale: 'pt-BR', name: 'Português (Brasil)' },
          ]}
          sidebar={{
            defaultMenuCollapseLevel: 1,
            autoCollapse: false // Desativado para a sidebar não ficar pulando ao navegar
          }}
          toc={{
            backToTop: dictionary.backToTop,
          }}
          editLink={dictionary.editPage}
          pageMap={pageMap}
          nextThemes={{ defaultTheme: 'dark' }}
          lastUpdated={<LastUpdated>{dictionary.lastUpdated}</LastUpdated>}
          themeSwitch={{
            dark: dictionary.dark,
            light: dictionary.light,
            system: dictionary.system
          }}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}