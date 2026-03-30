'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Syne } from 'next/font/google'
import Link from 'next/link'

const brand = Syne({
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap'
})

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

interface HeroProps {
  tagline: string
  description: string
  ctaText: string
  ctaHref: string
  npmText: string
}

export function Hero({ tagline, description, ctaText, ctaHref, npmText }: HeroProps) {
  return (
    <>
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

      <header className="mx-auto flex max-w-3xl flex-col items-center text-center px-4 pt-10 sm:px-6 sm:pt-14 md:px-10">
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
          {tagline}
        </p>
        <p className="mt-3 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-11 rounded-full px-7 text-sm font-semibold shadow-md shadow-primary/25"
          >
            <Link href={ctaHref}>{ctaText}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 rounded-full border-border bg-card px-7 text-sm font-medium hover:border-primary/40 hover:bg-accent/50"
          >
            <a href="https://www.npmjs.com/package/url-ast" target="_blank" rel="noreferrer">
              {npmText}
            </a>
          </Button>
        </div>
      </header>
    </>
  )
}
