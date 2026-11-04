"use client";

import { WorkspaceLink as Link } from "@/components/layout/workspace-navigation-feedback";
import { useCoverPlayback } from "@/components/explore/use-cover-playback";
import { useExploreWorkflowPreload } from "@/components/explore/use-explore-workflow-preload";

import { ExploreLinkIndicator } from "@/components/explore/explore-link-indicator";
import styles from "@/components/explore/explore-workspace.module.css";
import type { ExploreWorkflow } from "@/lib/explore/workflows";

export function ExploreWorkflowCard({ workflow, localPreview }: { workflow: ExploreWorkflow; localPreview: boolean }) {
  const videoRef = useCoverPlayback(workflow.coverVideo, "a", true, true);
  const preload = useExploreWorkflowPreload(workflow.destination, localPreview);

  return (
    <article className={styles.workflowCard}>
      <Link
        href={`${workflow.destination}${localPreview ? "?preview=1" : ""}`}
        prefetch={true}
        onPointerEnter={preload}
        onPointerDown={preload}
        onFocus={preload}
        className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        <div
          data-workflow-cover
          aria-label={workflow.coverVideo ? `${workflow.title} video examples` : `${workflow.title} cover video awaiting supplied asset`}
          className={styles.cover}
        >
          {workflow.coverVideo ? (
            <video
              ref={videoRef}
              poster={workflow.coverPoster ?? undefined}
              muted loop playsInline preload="none"
              width={960} height={540}
              aria-hidden="true" tabIndex={-1}
              className="size-full object-cover"
            />
          ) : null}
          <span className={styles.linkChip}>
            <ExploreLinkIndicator label={workflow.title} className="size-4" />
          </span>
        </div>
        <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground-strong">{workflow.title}</h3>
        <p className="mt-1.5 max-w-[44ch] text-pretty text-sm leading-6 text-muted">{workflow.description}</p>
      </Link>
    </article>
  );
}
