'use client'

import { cn } from '@/lib/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Analyze } from 'url-ast'

const EXAMPLES = [
  'https://api.example.com:8080/posts/[[...slug]]?page.number=1&tags.array#section',
  '/search/[...query]?limit.number=10&active.boolean',
  '/catalog/:category.enum[books,music]',
  'ftp://server.local:21/files/:name',
]

type SegmentKind =
  | 'protocol'
  | 'separator'
  | 'hostname'
  | 'port'
  | 'static'
  | 'dynamic'
  | 'variable'
  | 'catchall'
  | 'type'
  | 'default'
  | 'optional'
  | 'query-param'
  | 'fragment'
  | 'delimiter'

interface PaintedSegment {
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
  static: 'text-zinc-300',
  dynamic: 'text-amber-400',
  variable: 'text-amber-300',
  catchall: 'text-orange-400',
  type: 'text-emerald-400',
  default: 'text-teal-300',
  optional: 'text-rose-400',
  'query-param': 'text-sky-400',
  fragment: 'text-pink-400',
  delimiter: 'text-zinc-500',
}

const kindBgHover: Record<SegmentKind, string> = {
  protocol: 'bg-blue-400/15',
  separator: 'bg-zinc-500/10',
  hostname: 'bg-cyan-400/15',
  port: 'bg-purple-400/15',
  static: 'bg-zinc-300/10',
  dynamic: 'bg-amber-400/15',
  variable: 'bg-amber-300/15',
  catchall: 'bg-orange-400/15',
  type: 'bg-emerald-400/15',
  default: 'bg-teal-300/15',
  optional: 'bg-rose-400/15',
  'query-param': 'bg-sky-400/15',
  fragment: 'bg-pink-400/15',
  delimiter: 'bg-zinc-500/10',
}

function groupFor(kind: SegmentKind): string {
  if (['protocol', 'separator', 'hostname', 'port'].includes(kind)) return 'origin'
  if (['static', 'dynamic', 'variable', 'catchall', 'delimiter'].includes(kind)) return 'path'
  if (['type'].includes(kind)) return 'type'
  if (['default'].includes(kind)) return 'default'
  if (['optional'].includes(kind)) return 'optional'
  if (['query-param'].includes(kind)) return 'query'
  if (['fragment'].includes(kind)) return 'fragment'
  return 'other'
}

function labelFor(kind: SegmentKind, lang: string): string {
  const labels: Record<string, Record<SegmentKind, string>> = {
    en: {
      protocol: 'Protocol', separator: 'Separator', hostname: 'Hostname',
      port: 'Port', static: 'Static segment',
      dynamic: 'Dynamic segment', variable: 'Variable declaration',
      catchall: 'Catch-all', type: 'Type annotation',
      default: 'Default value', optional: 'Optional marker',
      'query-param': 'Query parameter',
      fragment: 'Fragment', delimiter: 'Delimiter',
    },
    'pt-BR': {
      protocol: 'Protocolo', separator: 'Separador', hostname: 'Hostname',
      port: 'Porta', static: 'Segmento estático',
      dynamic: 'Segmento dinâmico', variable: 'Declaração de variável',
      catchall: 'Catch-all', type: 'Anotação de tipo',
      default: 'Valor default', optional: 'Marcador opcional',
      'query-param': 'Parâmetro de consulta',
      fragment: 'Fragmento', delimiter: 'Delimitador',
    }
  }
  return labels[lang as 'en' | 'pt-BR']?.[kind] ?? labels['en']?.[kind] ?? kind
}

const kindMap: Record<string, SegmentKind> = {
  ProtocolLiteral: 'protocol',
  HostIdentifier: 'hostname',
  PortLiteral: 'port',
  PathSegment: 'static',
  DynamicSegment: 'dynamic',
  VariableDeclaration: 'variable',
  ParameterDeclaration: 'query-param',
  DefaultValue: 'default',
  FragmentIdentifier: 'fragment',
  CatchAllSegment: 'catchall',
  WildcardSegment: 'catchall',
}

function extractNodes(obj: any): any[] {
  if (!obj || typeof obj !== 'object') return []
  const nodes = []
  if (obj.kind && obj.loc) {
    nodes.push(obj)
  }
  for (const key of Object.keys(obj)) {
    if (key === 'loc') continue
    if (Array.isArray(obj[key])) {
      for (const item of obj[key]) {
        nodes.push(...extractNodes(item))
      }
    } else if (typeof obj[key] === 'object') {
      nodes.push(...extractNodes(obj[key]))
    }
  }
  return nodes
}

function flattenNodes(input: string, astJson: any, lang: string): PaintedSegment[] {
  if (!input || !astJson) return []

  const charKinds: SegmentKind[] = new Array(input.length).fill('delimiter')

  const nodes = extractNodes(astJson).sort((a, b) => {
    const lenA = a.loc.end.column - a.loc.start.column
    const lenB = b.loc.end.column - b.loc.start.column
    return lenB - lenA
  })

  for (const node of nodes) {
    const start = Math.max(0, node.loc.start.column)
    const end = Math.min(node.loc.end.column, input.length)

    if (node.kind === 'VariableDeclaration' || node.kind === 'ParameterDeclaration') {
      const nameLen = node.value?.length || 0
      const baseKind = node.kind === 'ParameterDeclaration' ? 'query-param' : 'variable'

      for (let i = start; i < start + nameLen; i++) {
        charKinds[i] = baseKind
      }
      for (let i = start + nameLen; i < end; i++) {
        if (input[i] !== '.') charKinds[i] = 'type'
      }
    } else {
      const targetKind = kindMap[node.kind as keyof typeof kindMap] as SegmentKind | undefined
      if (targetKind) {
        for (let i = start; i < end; i++) {
          charKinds[i] = targetKind
        }
      }
    }
  }

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!
    if (ch === '~') {
      charKinds[i] = 'optional'
    } else if (charKinds[i] === 'dynamic' && !(/[a-zA-Z0-9_\-*]/.test(ch))) {
      charKinds[i] = 'delimiter'
    } else if (ch === '*' && (charKinds[i] === 'delimiter' || charKinds[i] === 'static')) {
      charKinds[i] = 'catchall'
    }

    if (ch === ':' && i + 2 < input.length && input[i + 1] === '/' && input[i + 2] === '/') {
      charKinds[i] = 'separator'
      charKinds[i + 1] = 'separator'
      charKinds[i + 2] = 'separator'
    } else if (ch === ':' && charKinds[i] === 'delimiter') {
      charKinds[i] = 'separator'
    }
  }

  const segments: PaintedSegment[] = []
  let currentKind = charKinds[0] as SegmentKind | undefined
  let currentStart = 0

  for (let i = 1; i <= input.length; i++) {
    const k = i < input.length ? charKinds[i] : null
    if (k !== currentKind) {
      if (currentKind) {
        segments.push({
          text: input.slice(currentStart, i),
          kind: currentKind,
          label: labelFor(currentKind, lang),
          group: groupFor(currentKind),
        })
      }
      if (i < input.length && k != null) {
        currentKind = k
        currentStart = i
      }
    }
  }

  return segments
}

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
    { kind: 'variable', label: labelFor('variable', lang) },
    { kind: 'type', label: labelFor('type', lang) },
    { kind: 'default', label: labelFor('default', lang) },
    { kind: 'optional', label: labelFor('optional', lang) },
    { kind: 'query-param', label: labelFor('query-param', lang) },
    { kind: 'fragment', label: labelFor('fragment', lang) },
  ]
}

export interface LiveParserProps {
  lang: string
  title?: string
  inputPlaceholder?: string
  legendTitle?: string
  errorsTitle?: string
}

export function LiveParser({
  lang,
  title = 'url-ast live parser',
  inputPlaceholder = '/users/:id.number?active.boolean#section',
  legendTitle = 'Hover over any segment to learn more',
  errorsTitle = 'Parsing Errors',
}: LiveParserProps) {
  const [input, setInput] = useState(EXAMPLES[0])
  const [debouncedInput, setDebouncedInput] = useState(EXAMPLES[0])
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [isInteracting, setIsInteracting] = useState(false)
  const [tooltipData, setTooltipData] = useState<{ label: string; left: number; top: number } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInput(input), 600)
    return () => clearTimeout(timer)
  }, [input])

  const inputRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    if (backdropRef.current && inputRef.current) {
      backdropRef.current.scrollLeft = inputRef.current.scrollLeft
    }
  }, [])

  useEffect(() => {
    handleScroll()
  }, [input, handleScroll])

  useEffect(() => {
    if (isInteracting) return

    let currentIdx = 0
    let charIdx = EXAMPLES[0]?.length || 0
    let isDeleting = true
    let timeout: NodeJS.Timeout

    const tick = () => {
      const target: string = EXAMPLES[currentIdx] || ''

      if (isDeleting) {
        if (charIdx > 0) {
          charIdx--
          setInput(target.slice(0, charIdx))
          timeout = setTimeout(tick, 20)
        } else {
          isDeleting = false
          currentIdx = (currentIdx + 1) % EXAMPLES.length
          timeout = setTimeout(tick, 400)
        }
      } else {
        if (charIdx < target.length) {
          charIdx++
          setInput(target.slice(0, charIdx))
          timeout = setTimeout(tick, 50 + Math.random() * 50)
        } else {
          isDeleting = true
          timeout = setTimeout(tick, 2500)
        }
      }
    }

    timeout = setTimeout(() => {
      isDeleting = true
      tick()
    }, 2500)

    return () => clearTimeout(timeout)
  }, [isInteracting])

  const segments = useMemo(() => {
    try {
      const safeInput = input || ''
      const parsed = new Analyze(safeInput)
      const json = parsed.ast.toJSON(true)
      return flattenNodes(safeInput, json, lang)
    } catch {
      return [{ text: input || '', kind: 'delimiter' as SegmentKind, label: 'Raw', group: 'other' }]
    }
  }, [input, lang])

  const errorsData = useMemo(() => {
    try {
      if (input !== debouncedInput) return { errors: [], input: '' }
      if (!debouncedInput) return { errors: [], input: '' }
      const parsed = new Analyze(debouncedInput!)
      return { errors: parsed.hasErrors() ? parsed.errors : [], input: debouncedInput! }
    } catch {
      return { errors: [], input: debouncedInput }
    }
  }, [input, debouncedInput])

  const legendItems = useMemo(() => getLegendItems(lang), [lang])
  const hoveredSegment = hoveredIdx !== null ? segments[hoveredIdx] : null

  const handleMouseEnter = useCallback((idx: number) => setHoveredIdx(idx), [])
  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null)
    setTooltipData(null)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    if (!inputRef.current) return
    inputRef.current.style.pointerEvents = 'none'
    const elem = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement
    inputRef.current.style.pointerEvents = ''

    const idxAttr = elem?.getAttribute('data-idx')
    if (idxAttr != null && elem && editorRef.current) {
      setHoveredIdx(Number(idxAttr))

      const containerRect = editorRef.current.getBoundingClientRect()
      const spanRect = elem.getBoundingClientRect()

      setTooltipData({
        label: elem.getAttribute('data-label') || '',
        left: spanRect.left - containerRect.left + (spanRect.width / 2),
        top: spanRect.top - containerRect.top - 4
      })
    } else {
      setHoveredIdx(null)
      setTooltipData(null)
    }
  }, [])

  const handleInputMouseLeave = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const rect = inputRef.current?.getBoundingClientRect()
    if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      return // Ignore synthetic mouseleave caused by synchronous pointerEvents="none"
    }
    setHoveredIdx(null)
    setTooltipData(null)
  }, [])

  return (
    <section className="relative px-4 sm:px-6 md:px-10 z-10 mx-auto mt-20 max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-lg backdrop-blur-sm">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
            <span className="h-3 w-3 rounded-full bg-green-400/70" />
          </div>
          <span className="ml-2 text-xs font-medium text-muted-foreground">
            {title}
          </span>
        </div>

        {/* Unified Editor */}
        <div ref={editorRef} className="group relative flex items-center bg-zinc-950 px-0 py-6 sm:py-8 dark:bg-zinc-950/80">
          {/* Background Layer: syntax-highlighted segments */}
          <div
            ref={backdropRef}
            className="absolute inset-y-0 left-0 right-0 flex items-center overflow-hidden whitespace-pre px-5 font-mono text-base tracking-normal sm:px-7 sm:text-lg"
            aria-hidden
          >
            {segments.length === 0 ? (
              <span className="text-zinc-600/0 italic">
                {inputPlaceholder}
              </span>
            ) : (
              <div className="flex items-center">
                {segments.map((seg, idx) => {
                  const isHovered = hoveredIdx === idx
                  const isGroupHighlighted = hoveredSegment && seg.group === hoveredSegment.group && seg.group !== 'other'

                  return (
                    <span
                      key={idx}
                      data-idx={idx}
                      data-label={seg.label}
                      onMouseEnter={() => handleMouseEnter(idx)}
                      onMouseLeave={handleMouseLeave}
                      className={cn(
                        'relative cursor-pointer rounded-sm py-1 transition-all duration-150',
                        kindColors[seg.kind],
                        isHovered && cn(kindBgHover[seg.kind], 'z-20 scale-[1.05]'),
                        !isHovered && isGroupHighlighted && 'opacity-100',
                        !isHovered && (!isGroupHighlighted && hoveredSegment) && 'opacity-40',
                      )}
                    >
                      {seg.text}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Foreground Layer: native interactive input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onFocus={() => setIsInteracting(true)}
            onClick={() => setIsInteracting(true)}
            onChange={e => {
              setIsInteracting(true)
              setInput(e.target.value)
            }}
            onScroll={handleScroll}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleInputMouseLeave}
            placeholder={inputPlaceholder}
            spellCheck={false}
            className="relative z-10 w-full min-w-0 bg-transparent px-5 font-mono text-base tracking-normal text-transparent caret-zinc-200 outline-none selection:bg-primary/30 placeholder:text-muted-foreground/30 sm:px-7 sm:text-lg"
          />

          {/* Floating Tooltip */}
          {tooltipData && (
            <div
              className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-full items-center justify-center whitespace-nowrap rounded-md bg-zinc-800 px-2.5 py-1 text-[0.6875rem] font-sans font-medium text-zinc-200 shadow-lg ring-1 ring-white/10 transition-all duration-75"
              style={{ left: tooltipData.left, top: tooltipData.top }}
            >
              {tooltipData.label}
            </div>
          )}
        </div>

        {/* Errors UI */}
        {errorsData.errors.length > 0 && (
          <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-5 sm:px-6">
            <div className="mb-4 flex items-center gap-2 text-red-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider">{errorsTitle}</span>
            </div>
            <div className="flex flex-col gap-3">
              {errorsData.errors.map((err: any, i: number) => (
                <div key={i} className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 shadow-sm">
                  <p className="mb-1 text-sm font-semibold text-red-400">{err.code}</p>
                  <p className="mb-3 text-xs leading-relaxed text-red-300/80">{err.message}</p>

                  <div className="relative overflow-x-auto rounded-lg bg-zinc-950/60 p-3 pt-3.5 pb-2.5 shadow-inner">
                    <pre
                      className="m-0 p-0 text-[0.8125rem] leading-[1.4] text-zinc-300 bg-transparent border-none"
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
                    >
                      {errorsData.input}
                      {'\n'}
                      <span className="text-red-500 font-bold">
                        {' '.repeat(Math.max(0, err.start))}
                        {'^'.repeat(Math.max(1, err.end - err.start))}
                      </span>
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="border-t border-border/40 px-4 py-4 sm:px-6">
          <p className="mb-3 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/70">
            {legendTitle}
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
  )
}
