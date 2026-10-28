import { Check, Sparkles } from "lucide-react";
import Image from "next/image";

import { LandingAuthCta } from "@/components/marketing/landing-auth-actions";

const agents = [
  { id: "claude", src: "/marketing/cta-agents/claude.png" },
  { id: "codex", src: "/marketing/cta-agents/codex.png" },
  { id: "grok", src: "/marketing/cta-agents/grok-bot.png" },
] as const;

function AgentArc({ right = false }: { right?: boolean }) {
  const stack = right ? [agents[2], agents[0], agents[1]] : agents;
  const angles = right ? [6, -4, 3] : [-6, 4, -3];
  return (
    <div aria-hidden="true" data-agent-arc={right ? "right" : "left"} className="pointer-events-none relative hidden self-stretch lg:block">
      {stack.map(({ id, src }, index) => (
        <div
          key={id}
          data-agent-card={id}
          className="absolute size-[84px] overflow-hidden rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
          style={{
            top: `${10 + index * 32}%`,
            [right ? "right" : "left"]: index === 1 ? 55 : 20,
            transform: `rotate(${angles[index]}deg)`,
          }}
        >
          <Image src={src} alt="" width={84} height={84} unoptimized className="size-full object-contain" />
        </div>
      ))}
    </div>
  );
}

export function LandingBottomCta({ initialHasSession }: { initialHasSession: boolean }) {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="relative mx-auto max-w-[1200px] px-6 py-12 sm:px-10 sm:py-16 lg:grid lg:grid-cols-[140px_minmax(0,1fr)_140px] lg:items-stretch lg:gap-7 lg:px-10 lg:py-0">
        <AgentArc />
        <div className="relative z-10 mx-auto flex max-w-[620px] flex-col items-center text-center lg:py-16">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="size-4" aria-hidden="true" /> UGC Pilot for AI agents
          </span>
          <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-foreground-strong sm:text-5xl lg:text-[3.5rem]">
            Your content studio. Controlled by your agent.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-muted sm:text-lg">
            Ask your agent to create images and videos, edit your content, and export the result.
            Keep the workflow in your conversation.
          </p>
          <LandingAuthCta
            className="group mt-7 inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            initialHasSession={initialHasSession}
          />
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Check className="size-4 text-primary" aria-hidden="true" /> No credit card required
          </p>
          <a href="/mcp" className="mt-5 rounded-control text-sm font-medium text-muted underline decoration-border-strong underline-offset-4 hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            Agent control coming soon - Explore MCP
          </a>
        </div>
        <AgentArc right />
        <div aria-hidden="true" className="mt-8 flex justify-center gap-3 lg:hidden">
          {agents.map(({ id, src }) => (
            <div key={id} className="size-16 overflow-hidden rounded-[18px] shadow-card sm:size-[72px]">
              <Image src={src} alt="" width={72} height={72} unoptimized className="size-full object-contain" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
