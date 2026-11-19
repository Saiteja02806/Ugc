"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "@base-ui/react/tabs";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { ReferenceCard, ReferencePreviewDialog, ReferenceGridSkeleton, LoadError, FilterMenu } from "./recreate-workspace";
import { WorkflowNavigationButton } from "@/components/layout/workflow-navigation";
import { filterReferences, referenceCategories, type RecreateReference } from "@/lib/explore/recreate-types";
import { filterReferenceViews, sortReferenceViews, type ReferenceViewSort, type ReferenceViewFilter } from "@/lib/explore/video-reference-feed";
import { PUBLIC_GUEST_REFERENCE_LIMIT, PUBLIC_REFERENCE_LIMIT, type PublicReferenceWorkflow } from "@/lib/explore/public-reference-preview";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { cn } from "@/lib/utils";
import creation from "./workflow-creation.module.css";
import sections from "./workflow-section-layout.module.css";
import gate from "./reference-feed-upgrade.module.css";
import styles from "./talking-head-references.module.css";
import studio from "./workflow-studio.module.css";
import { PublicCreateSection, PublicEditSection, PublicScheduleSection } from "./public-workflow-sections";
import { WorkflowSectionNavigation } from "./workflow-section-navigation";

const titles: Record<PublicReferenceWorkflow, string> = { hook: "Hook video", talking_head: "Talking Head + Demo", wall_text: "Text on screen", slideshow: "Slideshows" };
export async function fetchPublicReferencePreview(workflow: PublicReferenceWorkflow, signal: AbortSignal): Promise<RecreateReference[]> {
  return withReadDeadline(async readSignal => {
    const response = await fetch(`/api/explore/public-reference-preview?workflow=${workflow}`, { signal: readSignal, cache: "no-store" });
    const body = await response.json();
    if (!response.ok || !body.ok || !Array.isArray(body.items)) throw new Error("Could not load public references.");
    return body.items.slice(0, PUBLIC_REFERENCE_LIMIT);
  }, signal);
}

/** Guests never mount private draft, generation, creator-account or billing workspaces. */
export function PublicReferenceGallery({ workflow }: { workflow: PublicReferenceWorkflow }) {
  const references = useQuery({ queryKey: ["public-reference-preview", workflow], queryFn: ({ signal }) => fetchPublicReferencePreview(workflow, signal), staleTime: 60_000 });
  const [preview, setPreview] = useState<RecreateReference | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [sort, setSort] = useState<ReferenceViewSort>("highest");
  const [filter, setFilter] = useState<ReferenceViewFilter>("all");
  const [gridNode, setGridNode] = useState<HTMLDivElement | null>(null);
  // The taste is one line of the gallery: however many cards the current viewport fits.
  const [perLine, setPerLine] = useState(PUBLIC_GUEST_REFERENCE_LIMIT);
  useEffect(() => {
    const node = gridNode;
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const tracks = getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length;
      if (tracks) setPerLine(tracks);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [gridNode]);
  const format = workflow === "talking_head" ? "hook" : workflow;
  const items = references.data ?? [];
  const selected = filterReferences(items, format, categories);
  // Guests see a small taste of the library; the fetch keeps ten so category filters still have depth.
  const visible = (format === "hook" ? sortReferenceViews(filterReferenceViews(selected, filter), sort) : selected).slice(0, Math.max(1, perLine));
  const clear = () => { setCategories([]); setSort("highest"); setFilter("all"); };
  const gallery = <section className={styles.gallery} aria-label={`${titles[workflow]} references`}>
    <div className="flex items-center justify-end gap-4"><p className="mr-auto text-sm text-muted">Browse references and preview the content.</p>
      <FilterMenu activeCategories={categories} categories={referenceCategories(items, format)} count={visible.length} disabled={references.isPending || references.isError} onToggle={(category, checked) => setCategories(current => checked ? [...current, category] : current.filter(value => value !== category))} onClear={clear} views={format === "hook" ? { sort, filter, onSort: setSort, onFilter: setFilter } : undefined} />
    </div>
    {references.isPending ? <ReferenceGridSkeleton /> : references.isError ? <LoadError onRetry={() => { void references.refetch(); }} /> : visible.length ? <div ref={setGridNode} className={styles.grid}>{visible.map(item => <div key={item.id} className={styles.card}>
      <ReferenceCard reference={item} compact hideCaption overlayActions hideRecreate guestSignInHref="/sign-in" isSelected={false} onPreview={() => setPreview(item)} onRecreate={() => undefined} />
      <Link href="/sign-in" className={studio.referenceRecreateButton} data-reference-recreate data-reference-recreate-overlay aria-label={`Sign in to recreate ${item.title}`}><RotateCcw aria-hidden="true" /><span>Recreate</span></Link>
    </div>)}</div> : <div role="status"><p>No references match these filters.</p><button type="button" className="mt-2 underline" onClick={clear}>Clear filters</button></div>}
    {!references.isPending && !references.isError && items.length > perLine ? <section data-reference-feed-sign-in className={styles.guestGate} aria-label="More references">
      {items.slice(perLine, perLine * 2).map(item => <div key={item.id} className={styles.guestGateCard} aria-hidden="true">
        {/* Posters come from the public preview API; next/image would add no optimization for one-off lazy thumbnails. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.posterUrl} alt="" loading="lazy" />
      </div>)}
      <div className={styles.guestGateOverlay}>
        <p>Want more references?</p>
        <Link href="/sign-in" className={gate.action}>Sign in</Link>
      </div>
    </section> : null}
    <ReferencePreviewDialog key={preview?.id ?? "empty"} open={Boolean(preview)} reference={preview} onOpenChange={open => { if (!open) setPreview(null); }} guestSignInHref="/sign-in" />
  </section>;
  const editValue = workflow === "hook" ? "demo" : "edit";
  const editLabel = workflow === "hook" || workflow === "talking_head" ? "Demo" : workflow === "slideshow" ? "Edit slides" : "Edit";
  const footers = {
    create: <Link href="/sign-in" className={cn(creation.primaryAction, creation.blueGenerate, styles.guestFooterAction)}>{workflow === "slideshow" ? "Sign in to generate images" : "Sign in to generate video"}</Link>,
    edit: workflow === "talking_head"
      ? <button type="button" disabled className={cn(creation.primaryAction, styles.guestPrimary)}>Sign in to save your video</button>
      : <Link href="/sign-in" className={cn(creation.primaryAction, styles.guestPrimary)}>{workflow === "slideshow" ? "Sign in to add slides" : workflow === "wall_text" ? "Sign in to choose a video" : "Sign in to save your video"}</Link>,
    schedule: <Link href="/sign-in" className={cn(creation.primaryAction, styles.guestPrimary)}>Sign in to schedule</Link>,
  };

  return <Tabs.Root defaultValue="create" className={styles.guestWorkspace}>
    <header className={cn(creation.header, sections.header, "flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8")}>
      <WorkflowNavigationButton />
      <Link prefetch={false} href="/explore" aria-label="Back to Explore" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><ArrowLeft className="size-4" aria-hidden="true" /></Link>
      <span className="hidden text-sm text-muted sm:block">Explore <span className="ml-2" aria-hidden="true">/</span></span>
      <div className="min-w-0"><h1 className="text-base font-semibold tracking-tight text-foreground-strong sm:text-lg">{titles[workflow]}</h1></div>
    </header>
    <aside aria-label={`${titles[workflow]} workflow`} data-guest-workflow className={cn(creation.controls, "min-w-0")}>
      <WorkflowSectionNavigation presentation="panel" editValue={editValue} editLabel={editLabel} />
      <Tabs.Panel value="create" keepMounted className={styles.guestPanel}>
        <div className={creation.controlContent}><PublicCreateSection workflow={workflow} /></div>
        <footer className={creation.actionFooter}>{footers.create}</footer>
      </Tabs.Panel>
      <Tabs.Panel value={editValue} keepMounted className={styles.guestPanel}>
        <div className={creation.controlContent}><PublicEditSection workflow={workflow} /></div>
        <footer className={creation.actionFooter}>{footers.edit}</footer>
      </Tabs.Panel>
      <Tabs.Panel value="schedule" keepMounted className={styles.guestPanel}>
        <div className={creation.controlContent}><PublicScheduleSection workflow={workflow} /></div>
        <footer className={creation.actionFooter}>{footers.schedule}</footer>
      </Tabs.Panel>
    </aside>
    {gallery}
  </Tabs.Root>;
}
