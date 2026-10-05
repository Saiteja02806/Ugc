"use client";

import Link from "next/link";

import { ExploreLinkIndicator } from "@/components/explore/explore-link-indicator";
import styles from "@/components/explore/explore-workspace.module.css";
import type { ExploreWorkflow } from "@/lib/explore/workflows";

export function ExploreWorkflowCard({ workflow, localPreview }: { workflow: ExploreWorkflow; localPreview: boolean }) {
  return (
    <article className={styles.workflowCard}>
      <Link
        href={`${workflow.destination}${localPreview ? "?preview=1" : ""}`}
        className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        <div
          data-workflow-cover
          aria-label={workflow.coverVideo ? `${workflow.title} video examples` : `${workflow.title} cover video awaiting supplied asset`}
          className={styles.cover}
        >
          {workflow.coverVideo ? (
            <video
              src={workflow.coverVideo}
              poster={workflow.coverPoster ?? undefined}
              autoPlay muted loop playsInline preload="auto"
              onCanPlay={(event) => { void event.currentTarget.play().catch(() => {}); }}
              width={960} height={540}
              aria-hidden="true" tabIndex={-1}
              className="size-full object-cover"
            />
          ) : null}
          <span className="absolute bottom-4 right-4 flex size-9 items-center justify-center rounded-full border border-border bg-background/60 text-muted transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground motion-reduce:transition-none">
            <ExploreLinkIndicator label={workflow.title} className="size-4" />
          </span>
        </div>
        <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground-strong">{workflow.title}</h3>
        <p className="mt-1.5 max-w-[44ch] text-pretty text-sm leading-6 text-muted">{workflow.description}</p>
      </Link>
    </article>
  );
}
