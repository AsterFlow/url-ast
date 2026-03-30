import { ReactNode } from 'react'

export function Features({ children }: { children: ReactNode }) {
  return (
    <section className="relative px-4 sm:px-6 md:px-10 z-10 mx-auto mt-16 mb-24 grid max-w-4xl gap-4 sm:grid-cols-2 lg:gap-5">
      {children}
    </section>
  )
}

function FeatureCard({ title, description }: { title: ReactNode; description: ReactNode }) {
  return (
    <div className="group rounded-2xl border border-border/80 bg-card/80 p-6 shadow-sm backdrop-blur-sm transition hover:border-primary/25 hover:shadow-md hover:shadow-primary/5 sm:p-7">
      <h3 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

Features.Card = FeatureCard
