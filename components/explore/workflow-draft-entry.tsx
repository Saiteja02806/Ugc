"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { draftEntryIntent, isWorkflowDraftId, listWorkflowDrafts, type WorkflowDraftEntry } from "@/lib/explore/workflow-draft-lifecycle";

const ACTIVE = "ugc-explore:active-talking-head-draft:v1";
type EntryView = { mode: "active"; entry: WorkflowDraftEntry } | { mode: "ask"; id: string } | { mode: "list" } | null;
/** Only this boundary decides new-versus-resume. Prefetching cannot create work. */
export function WorkflowDraftEntryBoundary({ children }: { children: (entry: WorkflowDraftEntry) => ReactNode }) {
  const params = useSearchParams(), { user, loading } = useAuth();
  const ownerId = user?.uid ?? null;
  const [view, setView] = useState<EntryView>(null), current = useRef<EntryView>(null);
  const [draftList, setDraftList] = useState<{ owner: string; drafts: ReturnType<typeof listWorkflowDrafts> } | null>(null), [error, setError] = useState<string | null>(null);
  const firstEntry = useRef(true);
  const drafts = draftList?.owner === user?.uid ? draftList?.drafts ?? [] : [];
  const work = params.get("work"), resume = params.get("resume"), showDrafts = params.get("drafts") === "1";
  function openWorkflow(url: string) {
    // These explicit choices terminate the earlier editor and its draft lock.
    window.location.href = url;
  }
  useEffect(() => {
    let stopped = false;
    void Promise.resolve().then(() => {
      if (stopped) return;
      function apply(next: EntryView) { current.current = next; setView(next); }
      try {
        setError(null);
        if (showDrafts) { apply({ mode: "list" }); return; }
        if (!work && current.current?.mode === "active" && new URL(window.location.href).searchParams.get("work") === current.current.entry.id) return;
        if (isWorkflowDraftId(work) && current.current?.mode === "active" && current.current.entry.id === work) return;
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const intent = draftEntryIntent({ id: work, explicitResume: resume === "1", navigationType: firstEntry.current ? navigation?.type ?? "navigate" : "navigate",
          discarded: (document as Document & { wasDiscarded?: boolean }).wasDiscarded === true, activeId: sessionStorage.getItem(ACTIVE) });
        firstEntry.current = false;
        const url = new URL(window.location.href);
        url.searchParams.delete("resume");
        if (intent === "new") {
          const id = crypto.randomUUID();
          url.searchParams.set("work", id); url.searchParams.delete("section"); url.searchParams.delete("hookJob");
          window.history.replaceState(window.history.state, "", url);
          sessionStorage.setItem(ACTIVE, id); apply({ mode: "active", entry: { id, createNew: true } });
        } else if (intent === "ask") apply({ mode: "ask", id: work! });
        else {
          window.history.replaceState(window.history.state, "", url);
          sessionStorage.setItem(ACTIVE, work!); apply({ mode: "active", entry: { id: work!, createNew: false } });
        }
      } catch { setError("This browser could not open a recoverable workflow. Your saved media and accepted requests are kept."); }
    });
    return () => { stopped = true; };
  }, [work, resume, showDrafts]);
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      const id = new URL(window.location.href).searchParams.get("work");
      if (event.persisted && isWorkflowDraftId(id)) { const next = { mode: "ask" as const, id }; current.current = next; setView(next); }
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);
  useEffect(() => {
    if (view?.mode !== "list" || loading || !ownerId) return;
    let stopped = false;
    void Promise.resolve().then(() => {
      if (stopped) return;
      try { setDraftList({ owner: ownerId, drafts: listWorkflowDrafts(localStorage, ownerId) }); }
      catch { setError("Saved drafts could not be read in this browser. Your media remains in Creative Assets."); }
    });
    return () => { stopped = true; };
  }, [view, loading, ownerId]);
  if (error) return <section className="space-y-3 p-6"><p role="alert">{error}</p><a href="/explore">Back to Explore</a></section>;
  if (!view) return <section className="p-6" role="status">Opening your workflow…</section>;
  if (view.mode === "active") return children(view.entry);
  return <section className="space-y-4 p-6" aria-label={view.mode === "list" ? "Saved Talking Head drafts" : "Resume previous work"}>
    <h1 className="text-lg font-semibold">{view.mode === "list" ? "Saved Talking Head drafts" : "Resume previous work?"}</h1>
    <p className="text-sm text-muted">{view.mode === "list" ? "Drafts saved on this browser. Videos and confirmed schedules remain in Creative Assets and Scheduling." : "This link belongs to an earlier task. Choose whether to continue it or start a new video."}</p>
    <div className="flex flex-wrap gap-3">
      {view.mode === "ask" ? <Button type="button" onClick={() => openWorkflow(`/explore/create-hook?work=${view.id}&resume=1`)}>Resume previous work</Button> : null}
      <Button type="button" variant="outline" onClick={() => openWorkflow("/explore/create-hook")}>Start new video</Button>
      <a href="/explore">Back to Explore</a>
    </div>
    {view.mode === "list" ? loading ? <p role="status">Checking your account…</p> : !user ? <p>Sign in to view your drafts.</p> : drafts.length ? <ul className="space-y-3">{drafts.map(draft => <li key={draft.id}>
      <a className="text-primary underline" href={`/explore/create-hook?work=${draft.id}&resume=1`}>{draft.session.instructions.trim().slice(0, 80) || "Talking Head + Demo"}</a>
      <p className="text-xs text-muted">{draft.state === "scheduled" ? "Scheduled" : "Draft"} · {new Date(draft.updatedAt).toLocaleString()}</p>
    </li>)}</ul> : <p>No saved drafts on this browser yet.</p> : null}
  </section>;
}
