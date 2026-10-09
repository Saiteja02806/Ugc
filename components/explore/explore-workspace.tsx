"use client";

import { ArrowUpRight, CalendarDays, FolderOpen, ImageIcon, Sparkles, TrendingUp, Video } from "lucide-react";
import Link from "next/link";

import { AICharacterCard } from "@/components/explore/ai-character-card";
import { ExploreWorkflowCard } from "@/components/explore/explore-workflow-card";
import styles from "@/components/explore/explore-workspace.module.css";
import scrollbars from "@/components/ui/quiet-scrollbar.module.css";
import { EXPLORE_QUICK_STARTS, getQuickStartPreviewHref } from "@/lib/explore/launch-presets";
import { EXPLORE_WORKFLOWS } from "@/lib/explore/workflows";
import { cn } from "@/lib/utils";

const QUICK_START_ICONS = { studio: Sparkles, trending: TrendingUp, library: FolderOpen, video: Video, image: ImageIcon, schedule: CalendarDays };

export function ExploreWorkspace({ localPreview = false }: { localPreview?: boolean }) {
  return (
    <section className={cn(scrollbars.surface, scrollbars.page, "min-h-dvh bg-background px-4 py-7 text-foreground sm:px-6 lg:px-8 lg:py-8")}>
      <div className={styles.page}>
      <header className="mb-7">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground-strong">Explore</h1>
        <p className="mt-2 text-sm text-muted">Find your next format. Start with a workflow or a creation tool.</p>
      </header>
      <section aria-labelledby="explore-workflows-title">
      <h2 id="explore-workflows-title" className="mb-3 text-sm font-medium text-muted">Workflows</h2>
      <div className={styles.workflowGrid}>
        {EXPLORE_WORKFLOWS.map((workflow) => (
          <ExploreWorkflowCard key={workflow.id} workflow={workflow} localPreview={localPreview} />
        ))}
      </div>
      </section>
      <div className={styles.creationGrid}>
      <AICharacterCard localPreview={localPreview} />
      <section aria-labelledby="explore-quick-start-title" className={styles.quickStarts}>
        <h2 id="explore-quick-start-title" className="text-lg font-semibold tracking-tight text-foreground-strong">Quick start</h2>
        <p className="mt-1 text-xs leading-5 text-muted">Jump into a workflow or open a creation tool.</p>
        <div className={styles.toolGrid}>
          {EXPLORE_QUICK_STARTS.map((shortcut) => {
            const Icon = QUICK_START_ICONS[shortcut.id];
            return <Link key={shortcut.id} href={localPreview ? getQuickStartPreviewHref(shortcut) : shortcut.destination} data-explore-shortcut={shortcut.id}
              aria-label={`${shortcut.title}: ${shortcut.description}. Opens ${shortcut.target}.`}
              className={cn(styles.toolCard, "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4 focus-visible:ring-offset-background")}>
              <Icon className="size-[18px] shrink-0 text-muted" strokeWidth={1.7} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold tracking-tight text-foreground-strong">{shortcut.title}</h3>
                <p className="mt-1 text-xs leading-[18px] text-muted">{shortcut.description}</p>
              </div>
              <ArrowUpRight className={cn(styles.arrow, "size-3.5 shrink-0 text-muted")} aria-hidden="true" />
            </Link>;
          })}
        </div>
      </section>
      </div>
      </div>
    </section>
  );
}
