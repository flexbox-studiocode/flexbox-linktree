export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <p className="font-mono text-xs tracking-[0.2em] text-brand-blue uppercase">
        Flexbox Studio
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-graphite sm:text-4xl">
        Flexbox Linktree
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-graphite/80">
        Local foundation build. The public digital directory is implemented in
        Phase 2.
      </p>
      <p className="mt-2 rounded-lg border border-light-blue bg-surface px-4 py-2 font-mono text-xs text-graphite">
        Next.js + Tailwind CSS v4 + Prisma 7 + PostgreSQL
      </p>
    </main>
  );
}