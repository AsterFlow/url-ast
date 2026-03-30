'use client'

import Link from 'next/link'
import { Syne } from 'next/font/google'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useState, useMemo, useCallback } from 'react'

const brand = Syne({
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap'
})

/* ─────────────────────────── i18n copy ─────────────────────────── */

const copy = {
  en: {
    tagline: 'Typed URL parsing, distilled.',
    sub: 'Parse URLs into abstract syntax trees with automatic type casting and full TypeScript inference.',
    cta: 'Get started',
    npm: 'View on npm',
    inputLabel: 'Type a url-ast template to see the live parse:',
    inputPlaceholder: '/users/:id.number?active.boolean#section',
    legendTitle: 'Hover over any segment to learn more',
    feats: [
      { title: 'Type casting', desc: 'Automatic conversion to number, boolean, array, enum — from the template.' },
      { title: 'TypeScript inference', desc: 'Full type inference from template string literals at compile time.' },
      { title: 'Scannerless AST', desc: 'Lexing and tree construction in a single pass, zero intermediate steps.' },
      { title: 'Binary serialization', desc: 'Serialize and restore ASTs via Buffer for caching and transmission.' },
    ],
  },
  'pt-BR': {
    tagline: 'Parsing de URLs tipado, em essência.',
    sub: 'Transforme URLs em árvores sintáticas abstratas com type casting automático e inferência TypeScript completa.',
    cta: 'Começar',
    npm: 'Ver no npm',
    inputLabel: 'Digite um template url-ast para ver o parse ao vivo:',
    inputPlaceholder: '/users/:id.number?active.boolean#section',
    legendTitle: 'Passe o mouse sobre qualquer segmento para saber mais',
    feats: [
      { title: 'Type casting', desc: 'Conversão automática para number, boolean, array, enum — direto do template.' },
      { title: 'Inferência TypeScript', desc: 'Inferência completa de tipos a partir de template literals em tempo de compilação.' },
      { title: 'AST scannerless', desc: 'Lexing e construção da árvore em uma única passada, zero etapas intermediárias.' },
      { title: 'Serialização binária', desc: 'Serialize e restaure ASTs via Buffer para cache e transmissão.' },
    ],
  }
} as const

/* ─────────────────────────── URL segment parser ─────────────────────────── */

type SegmentKind =
  | 'protocol'
  | 'separator'
  | 'hostname'
  | 'port'
  | 'slash'
  | 'static'
  | 'dynamic'
  | 'catchall'
  | 'type'
  | 'default'
  | 'optional'
  | 'query-delim'
  | 'query-key'
  | 'query-amp'
  | 'hash-delim'
  | 'fragment'
  | 'bracket-open'
  | 'bracket-close'
  | 'dots'
  | 'colon'
  | 'equals'
  | 'dot-op'
  | 'tilde'

interface Segment {
  text: string
  kind: SegmentKind
  label: string
  group: string
}

const kindColors: Record<SegmentKind, string> = {
  protocol: 'text-blue-400',
  separator: 'text-zinc-500',
  hostname: 'text-cyan-400',
  port: 'text-purple-400',
  slash: 'text-zinc-500',
  static: 'text-zinc-300',
  dynamic: 'text-amber-400',
  catchall: 'text-orange-400',
  type: 'text-emerald-400',
  default: 'text-teal-300',
  optional: 'text-rose-400',
  'query-delim': 'text-zinc-500',
  'query-key': 'text-sky-400',
  'query-amp': 'text-zinc-500',
  'hash-delim': 'text-zinc-500',
  fragment: 'text-pink-400',
  'bracket-open': 'text-zinc-500',
  'bracket-close': 'text-zinc-500',
  dots: 'text-orange-400',
  colon: 'text-amber-400/70',
  equals: 'text-teal-300/70',
  'dot-op': 'text-emerald-400/70',
  tilde: 'text-rose-400/70',
}

const kindBgHover: Record<SegmentKind, string> = {
  protocol: 'bg-blue-400/15',
  separator: 'bg-zinc-500/10',
  hostname: 'bg-cyan-400/15',
  port: 'bg-purple-400/15',
  slash: 'bg-zinc-500/10',
  static: 'bg-zinc-300/10',
  dynamic: 'bg-amber-400/15',
  catchall: 'bg-orange-400/15',
  type: 'bg-emerald-400/15',
  default: 'bg-teal-300/15',
  optional: 'bg-rose-400/15',
  'query-delim': 'bg-zinc-500/10',
  'query-key': 'bg-sky-400/15',
  'query-amp': 'bg-zinc-500/10',
  'hash-delim': 'bg-zinc-500/10',
  fragment: 'bg-pink-400/15',
  'bracket-open': 'bg-zinc-500/10',
  'bracket-close': 'bg-zinc-500/10',
  dots: 'bg-orange-400/15',
  colon: 'bg-amber-400/10',
  equals: 'bg-teal-300/10',
  'dot-op': 'bg-emerald-400/10',
  tilde: 'bg-rose-400/10',
}

function labelFor(kind: SegmentKind, lang: string): string {
  const labels: Record<string, Record<SegmentKind, string>> = {
    en: {
      protocol: 'Protocol', separator: 'Separator', hostname: 'Hostname',
      port: 'Port', slash: 'Path separator', static: 'Static segment',
      dynamic: 'Dynamic parameter', catchall: 'Catch-all parameter',
      type: 'Type annotation', default: 'Default value', optional: 'Optional marker',
      'query-delim': 'Query start', 'query-key': 'Query parameter',
      'query-amp': 'Query separator', 'hash-delim': 'Fragment start',
      fragment: 'Fragment', 'bracket-open': 'Bracket open',
      'bracket-close': 'Bracket close', dots: 'Spread operator',
      colon: 'Param prefix', equals: 'Default operator', 'dot-op': 'Type operator',
      tilde: 'Optional operator',
    },
    'pt-BR': {
      protocol: 'Protocolo', separator: 'Separador', hostname: 'Hostname',
      port: 'Porta', slash: 'Separador de caminho', static: 'Segmento estático',
      dynamic: 'Parâmetro dinâmico', catchall: 'Parâmetro catch-all',
      type: 'Anotação de tipo', default: 'Valor default', optional: 'Marcador opcional',
      'query-delim': 'Início da query', 'query-key': 'Parâmetro de consulta',
      'query-amp': 'Separador de query', 'hash-delim': 'Início do fragmento',
      fragment: 'Fragmento', 'bracket-open': 'Colchete de abertura',
      'bracket-close': 'Colchete de fechamento', dots: 'Operador spread',
      colon: 'Prefixo de param', equals: 'Operador default', 'dot-op': 'Operador de tipo',
      tilde: 'Operador opcional',
    }
  }
  return labels[lang]?.[kind] ?? labels.en[kind] ?? kind
}

function groupFor(kind: SegmentKind): string {
  if (['protocol', 'separator', 'hostname', 'port'].includes(kind)) return 'origin'
  if (['slash', 'static', 'dynamic', 'catchall', 'colon', 'bracket-open', 'bracket-close', 'dots', 'tilde'].includes(kind)) return 'path'
  if (['type', 'dot-op'].includes(kind)) return 'type'
  if (['default', 'equals'].includes(kind)) return 'default'
  if (['optional'].includes(kind)) return 'optional'
  if (['query-delim', 'query-key', 'query-amp'].includes(kind)) return 'query'
  if (['hash-delim', 'fragment'].includes(kind)) return 'fragment'
  return 'other'
}

/** Parses a url-ast template string into colored segments */
function parseTemplate(input: string, lang: string): Segment[] {
  if (!input) return []
  const segs: Segment[] = []
  const push = (text: string, kind: SegmentKind) => {
    segs.push({ text, kind, label: labelFor(kind, lang), group: groupFor(kind) })
  }

  let i = 0
  const s = input

  // Origin: protocol://hostname:port
  const originMatch = s.match(/^([a-zA-Z][a-zA-Z0-9+.-]*)(:\/{2})([^/:?#]+)(?::(\d+))?/)
  if (originMatch) {
    push(originMatch[1], 'protocol')
    push(originMatch[2], 'separator')
    push(originMatch[3], 'hostname')
    if (originMatch[4]) {
      push(':', 'separator')
      push(originMatch[4], 'port')
    }
    i = originMatch[0].length
  }

  // Remainder: path ? query # fragment
  const rest = s.slice(i)
  const hashIdx = rest.indexOf('#')
  const qIdx = rest.indexOf('?')

  const pathEnd = qIdx >= 0 ? qIdx : hashIdx >= 0 ? hashIdx : rest.length
  const pathStr = rest.slice(0, pathEnd)
  const queryStr = qIdx >= 0 ? rest.slice(qIdx + 1, hashIdx >= 0 ? hashIdx : rest.length) : ''
  const fragStr = hashIdx >= 0 ? rest.slice(hashIdx + 1) : ''

  // Parse path
  parsePathSegments(pathStr, push)

  // Parse query
  if (qIdx >= 0) {
    push('?', 'query-delim')
    const qParts = queryStr.split('&')
    qParts.forEach((part, idx) => {
      if (idx > 0) push('&', 'query-amp')
      parseParamWithAnnotations(part, 'query-key', push)
    })
  }

  // Parse fragment
  if (hashIdx >= 0) {
    push('#', 'hash-delim')
    if (fragStr) push(fragStr, 'fragment')
  }

  return segs
}

function parsePathSegments(
  path: string,
  push: (text: string, kind: SegmentKind) => void
) {
  let i = 0
  while (i < path.length) {
    const ch = path[i]

    if (ch === '/') {
      push('/', 'slash')
      i++
      continue
    }

    // Bracket syntax: [~name.type], [...slug], [[...slug]]
    if (ch === '[') {
      const doubleOpen = path[i + 1] === '['
      if (doubleOpen) {
        push('[[', 'bracket-open')
        i += 2
      } else {
        push('[', 'bracket-open')
        i++
      }

      // Check for ... (catch-all)
      if (path.slice(i, i + 3) === '...') {
        push('...', 'dots')
        i += 3
        // Read catch-all name
        const nameEnd = path.indexOf(']', i)
        const name = path.slice(i, nameEnd >= 0 ? nameEnd : path.length)
        push(name, 'catchall')
        i += name.length
      } else {
        // Optional marker ~
        if (path[i] === '~') {
          push('~', 'tilde')
          i++
        }
        // Read param name (until . = ] )
        let name = ''
        while (i < path.length && path[i] !== ']' && path[i] !== '.' && path[i] !== '=') {
          name += path[i]
          i++
        }
        if (name) push(name, 'dynamic')

        // Type annotation
        if (path[i] === '.') {
          push('.', 'dot-op')
          i++
          let type = ''
          while (i < path.length && path[i] !== ']' && path[i] !== '=') {
            type += path[i]
            i++
          }
          if (type) push(type, 'type')
        }

        // Default value
        if (path[i] === '=') {
          push('=', 'equals')
          i++
          let def = ''
          while (i < path.length && path[i] !== ']') {
            def += path[i]
            i++
          }
          if (def) push(def, 'default')
        }
      }

      if (doubleOpen && path.slice(i, i + 2) === ']]') {
        push(']]', 'bracket-close')
        i += 2
      } else if (path[i] === ']') {
        push(']', 'bracket-close')
        i++
      }
      continue
    }

    // Colon syntax: :~name.type=default
    if (ch === ':') {
      push(':', 'colon')
      i++

      // Optional ~
      if (path[i] === '~') {
        push('~', 'tilde')
        i++
      }

      // Read name
      let name = ''
      while (i < path.length && path[i] !== '/' && path[i] !== '.' && path[i] !== '=' && path[i] !== '?' && path[i] !== '#') {
        name += path[i]
        i++
      }
      if (name) push(name, 'dynamic')

      // Type annotation
      if (path[i] === '.') {
        push('.', 'dot-op')
        i++
        let type = ''
        while (i < path.length && path[i] !== '/' && path[i] !== '=' && path[i] !== '?' && path[i] !== '#') {
          type += path[i]
          i++
        }
        if (type) push(type, 'type')
      }

      // Default
      if (path[i] === '=') {
        push('=', 'equals')
        i++
        let def = ''
        while (i < path.length && path[i] !== '/' && path[i] !== '?' && path[i] !== '#') {
          def += path[i]
          i++
        }
        if (def) push(def, 'default')
      }
      continue
    }

    // Static segment
    let stat = ''
    while (i < path.length && path[i] !== '/' && path[i] !== '[' && path[i] !== ':') {
      stat += path[i]
      i++
    }
    if (stat) push(stat, 'static')
  }
}

function parseParamWithAnnotations(
  part: string,
  baseKind: SegmentKind,
  push: (text: string, kind: SegmentKind) => void
) {
  // ~name.type=default
  let i = 0
  if (part[i] === '~') {
    push('~', 'tilde')
    i++
  }

  // Name (until . or =)
  let name = ''
  while (i < part.length && part[i] !== '.' && part[i] !== '=') {
    name += part[i]
    i++
  }
  if (name) push(name, baseKind)

  // Type
  if (part[i] === '.') {
    push('.', 'dot-op')
    i++
    let type = ''
    while (i < part.length && part[i] !== '=') {
      type += part[i]
      i++
    }
    if (type) push(type, 'type')
  }

  // Default
  if (part[i] === '=') {
    push('=', 'equals')
    i++
    const def = part.slice(i)
    if (def) push(def, 'default')
  }
}

/* ─────────────────────────── legend colors ─────────────────────────── */

interface LegendItem {
  kind: SegmentKind
  label: string
}

function getLegendItems(lang: string): LegendItem[] {
  return [
    { kind: 'protocol', label: labelFor('protocol', lang) },
    { kind: 'hostname', label: labelFor('hostname', lang) },
    { kind: 'port', label: labelFor('port', lang) },
    { kind: 'static', label: labelFor('static', lang) },
    { kind: 'dynamic', label: labelFor('dynamic', lang) },
    { kind: 'catchall', label: labelFor('catchall', lang) },
    { kind: 'type', label: labelFor('type', lang) },
    { kind: 'default', label: labelFor('default', lang) },
    { kind: 'optional', label: labelFor('tilde', lang) },
    { kind: 'query-key', label: labelFor('query-key', lang) },
    { kind: 'fragment', label: labelFor('fragment', lang) },
  ]
}

/* ─────────────────────────── Logo ─────────────────────────── */

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={cn('text-primary', className)}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="urlAstGrad" x1="0" y1="0" x2="120" y2="120">
          <stop stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <circle cx="28" cy="60" r="14" stroke="url(#urlAstGrad)" strokeWidth="3" />
      <circle cx="60" cy="36" r="14" stroke="url(#urlAstGrad)" strokeWidth="3" />
      <circle cx="92" cy="60" r="14" stroke="url(#urlAstGrad)" strokeWidth="3" />
      <circle cx="60" cy="84" r="14" stroke="url(#urlAstGrad)" strokeWidth="3" />
      <path
        d="M40 52 L50 44 M80 52 L70 44 M80 68 L70 76 M40 68 L50 76 M60 50 L60 66"
        stroke="url(#urlAstGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ─────────────────────────── Main component ─────────────────────────── */

export function UrlAstHome({ lang }: { lang: string }) {
  const t = copy[lang === 'pt-BR' ? 'pt-BR' : 'en']
  const docsHref = `/${lang}/docs/getting-started`
  const npmHref = 'https://www.npmjs.com/package/url-ast'

  const [input, setInput] = useState('https://api.example.com:8080/users/:id.number/posts/[~slug]?page.number=1&tags.array#section')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const segments = useMemo(() => parseTemplate(input, lang), [input, lang])
  const legendItems = useMemo(() => getLegendItems(lang), [lang])

  const hoveredSegment = hoveredIdx !== null ? segments[hoveredIdx] : null

  const handleMouseEnter = useCallback((idx: number) => setHoveredIdx(idx), [])
  const handleMouseLeave = useCallback(() => setHoveredIdx(null), [])

  return (
    <div
      className={cn(
        'not-prose relative isolate w-full min-w-0 max-w-full',
        'px-4 pb-24 pt-10 sm:px-6 sm:pb-32 sm:pt-14 md:px-10'
      )}
    >
      {/* Background effects */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-x-hidden"
      >
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.55_0.02_250/0.06)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.55_0.02_250/0.06)_1px,transparent_1px)] bg-[size:28px_28px] dark:bg-[linear-gradient(to_right,oklch(0.85_0.02_250/0.08)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.85_0.02_250/0.08)_1px,transparent_1px)]"
        />
        <div className="absolute inset-x-0 top-0 flex justify-center overflow-hidden">
          <div
            className="-mt-32 h-[420px] w-[min(100%,720px)] max-w-full shrink-0 rounded-full bg-gradient-to-b from-primary/25 via-chart-3/15 to-transparent blur-3xl dark:from-primary/20"
          />
        </div>
      </div>

      {/* Hero */}
      <header className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <LogoMark className="mb-8 h-20 w-20 sm:h-24 sm:w-24" />
        <h1
          className={cn(
            brand.className,
            'bg-gradient-to-br from-foreground via-foreground to-muted-foreground bg-clip-text text-5xl tracking-tight text-transparent sm:text-6xl md:text-7xl'
          )}
        >
          url-ast
        </h1>
        <p className="mt-5 max-w-md text-lg font-medium text-foreground sm:text-xl">
          {t.tagline}
        </p>
        <p className="mt-3 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t.sub}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-11 rounded-full px-7 text-sm font-semibold shadow-md shadow-primary/25"
          >
            <Link href={docsHref}>{t.cta}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 rounded-full border-border bg-card px-7 text-sm font-medium hover:border-primary/40 hover:bg-accent/50"
          >
            <a href={npmHref} target="_blank" rel="noreferrer">
              {t.npm}
            </a>
          </Button>
        </div>
      </header>

      {/* ─── Live Parser ─── */}
      <section className="mx-auto mt-20 max-w-4xl">
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-lg backdrop-blur-sm">
          {/* Top bar */}
          <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-3">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-400/70" />
              <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
              <span className="h-3 w-3 rounded-full bg-green-400/70" />
            </div>
            <span className="ml-2 text-xs font-medium text-muted-foreground">
              url-ast live parser
            </span>
          </div>

          {/* Input */}
          <div className="border-b border-border/40 px-4 py-4 sm:px-6">
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              {t.inputLabel}
            </label>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t.inputPlaceholder}
              spellCheck={false}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>

          {/* Parsed output */}
          <div className="px-4 py-5 sm:px-6">
            <div className="flex min-h-[3.5rem] flex-wrap items-center gap-0 rounded-xl bg-zinc-950 px-5 py-4 font-mono text-base leading-relaxed sm:text-lg dark:bg-zinc-950/80">
              {segments.length === 0 ? (
                <span className="text-zinc-600 italic text-sm">
                  {t.inputPlaceholder}
                </span>
              ) : (
                segments.map((seg, idx) => {
                  const isHovered = hoveredIdx === idx
                  const isGroupHighlighted = hoveredSegment && seg.group === hoveredSegment.group && seg.group !== 'other'

                  return (
                    <span
                      key={idx}
                      onMouseEnter={() => handleMouseEnter(idx)}
                      onMouseLeave={handleMouseLeave}
                      className={cn(
                        'relative cursor-pointer rounded-sm px-[1px] py-0.5 transition-all duration-150',
                        kindColors[seg.kind],
                        isHovered && cn(kindBgHover[seg.kind], 'scale-110'),
                        !isHovered && isGroupHighlighted && 'opacity-100',
                        !isHovered && !isGroupHighlighted && hoveredSegment && 'opacity-40',
                      )}
                    >
                      {seg.text}
                      {isHovered && (
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-800 px-2.5 py-1 text-[0.6875rem] font-sans font-medium text-zinc-200 shadow-lg ring-1 ring-white/10 z-10">
                          {seg.label}
                        </span>
                      )}
                    </span>
                  )
                })
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="border-t border-border/40 px-4 py-4 sm:px-6">
            <p className="mb-3 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/70">
              {t.legendTitle}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {legendItems.map(item => (
                <span key={item.kind} className="flex items-center gap-1.5 text-xs">
                  <span className={cn('inline-block h-2.5 w-2.5 rounded-full', kindColors[item.kind].replace('text-', 'bg-'))} />
                  <span className="text-muted-foreground">{item.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-2 lg:gap-5">
        {t.feats.map((feat, i) => (
          <div
            key={i}
            className="group rounded-2xl border border-border/80 bg-card/80 p-6 shadow-sm backdrop-blur-sm transition hover:border-primary/25 hover:shadow-md hover:shadow-primary/5 sm:p-7"
          >
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {feat.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {feat.desc}
            </p>
          </div>
        ))}
      </section>
    </div>
  )
}
