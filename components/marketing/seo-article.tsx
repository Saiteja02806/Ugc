import Link from "next/link";
import type { ReactNode } from "react";

export function ArticleLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-primary">
      {children}
    </Link>
  );
}

export function ArticleBody({ children }: { children: ReactNode }) {
  return (
    <article className="px-4 pb-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[760px] space-y-5 text-base leading-7 text-muted">{children}</div>
    </article>
  );
}

export function ArticleH2({ children }: { children: ReactNode }) {
  return <h2 className="pt-6 text-3xl font-semibold tracking-[-0.035em] text-foreground-strong">{children}</h2>;
}

export function ArticleH3({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 text-xl font-semibold text-foreground-strong">{children}</h3>;
}

export function ArticleCode({ children }: { children: ReactNode }) {
  return <code className="rounded bg-card-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground-strong">{children}</code>;
}

export function ArticlePrompt({ children }: { children: ReactNode }) {
  return <blockquote className="border-l-2 border-primary/60 pl-4 text-foreground-strong">{children}</blockquote>;
}

export function ArticleCommand({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-[16px] border border-border bg-card p-4 font-mono text-sm leading-6 text-foreground-strong">
      <code>{children}</code>
    </pre>
  );
}

export function FaqList({ items }: { items: readonly { question: string; answer: ReactNode }[] }) {
  return (
    <section className="space-y-6" aria-labelledby="article-faq">
      <h2 id="article-faq" className="pt-6 text-3xl font-semibold tracking-[-0.035em] text-foreground-strong">
        FAQ
      </h2>
      {items.map((item) => (
        <div key={item.question}>
          <h3 className="text-lg font-semibold text-foreground-strong">{item.question}</h3>
          <p className="mt-2">{item.answer}</p>
        </div>
      ))}
    </section>
  );
}
