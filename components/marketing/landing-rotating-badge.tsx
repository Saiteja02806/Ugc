"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { LandingAgentMark } from "@/components/marketing/landing-agent-mark";

export function LandingRotatingBadge({ children, showMcp = false }: { children: ReactNode; showMcp?: boolean }) {
  const [showAgents, setShowAgents] = useState(showMcp);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!showMcp || hovered || focused) return;
    const timer = window.setInterval(() => setShowAgents(value => !value), 3000);
    return () => window.clearInterval(timer);
  }, [showMcp, hovered, focused]);

  return (
    <a
      href={showAgents ? "/mcp" : "#workflow"}
      aria-label={showAgents ? "Coming soon: control from Claude, Codex and Grok bot. Learn about UGC Pilot MCP" : "Post right away on Instagram, TikTok and YouTube. See how it works"}
      data-landing-rotating-badge={showAgents ? "agents" : "social"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="group relative mb-6 inline-flex min-h-9 w-[280px] max-w-full flex-row items-center justify-center gap-2 rounded-full border border-border-strong bg-card bg-linear-to-b from-white/90 to-slate-100/50 px-3 py-2.5 text-xs font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_3px_12px_rgba(15,23,42,0.08)] transition-[border-color,box-shadow] duration-200 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/25 dark:from-white/10 dark:to-white/[0.015] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.18),0_5px_18px_rgba(0,0,0,0.24),0_0_16px_rgba(255,255,255,0.045)] dark:hover:border-white/40 dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_5px_20px_rgba(0,0,0,0.28),0_0_20px_rgba(255,255,255,0.08)] sm:min-h-0 sm:w-[440px] sm:flex-row sm:gap-4 sm:rounded-full sm:px-4 sm:py-2"
    >
      {showAgents && <span className="absolute -top-2 right-0 whitespace-nowrap rounded-full border border-border bg-card px-1.5 py-0.5 text-[9px] font-semibold leading-none text-primary sm:left-full sm:right-auto sm:-translate-x-3">Coming soon</span>}
      <span className={`${showAgents ? "" : "hidden sm:inline"} shrink-0 font-semibold text-primary`}>{showAgents ? "Control from" : "Post right away"}</span>
      <span className="hidden h-4 w-px shrink-0 bg-border-strong sm:block" aria-hidden="true" />
      <span className="inline-flex items-center justify-center gap-2 sm:gap-4">
        {showAgents ? (
          <>
            {(["claude", "codex", "grok"] as const).map(agent => (
              <span key={agent} className="inline-flex items-center gap-1 text-foreground-strong sm:gap-1.5">
                <LandingAgentMark agent={agent} />
                <span>{agent === "claude" ? "Claude" : agent === "codex" ? "Codex" : "Grok bot"}</span>
              </span>
            ))}
          </>
        ) : children}
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-foreground-strong" />
      </span>
    </a>
  );
}
