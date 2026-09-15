"use client";

import { CheckCircle2, LoaderCircle, RefreshCw, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";

type ContextResponse = {
  activeContext: WebsiteBusinessAnalysis;
  activeProfileVersion: number;
  draft: {
    baseProfileVersion: number | null;
    context: WebsiteBusinessAnalysis;
    factCount: number;
    readiness: "needs_facts" | "ready";
    source: string | null;
    updatedAt: string | null;
  } | null;
};

type ApiResponse = { message?: string; ok: boolean; profile?: ContextResponse; refreshScope?: string };

export function BusinessContextSettings() {
  const [profile, setProfile] = useState<ContextResponse | null>(null);
  const [context, setContext] = useState<WebsiteBusinessAnalysis | null>(null);
  const [source, setSource] = useState("");
  const [busyAction, setBusyAction] = useState<"apply" | "reanalyze" | "save_draft" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getCurrentUserIdToken();
        if (!token) throw new Error("Sign in again before editing Business Context.");
        const response = await fetch("/api/business-context", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => null) as ApiResponse & { profile?: ContextResponse | null };
        if (!response.ok || !data?.ok || !data.profile) throw new Error(data?.message ?? "Could not load Business Context.");
        if (!cancelled) setLoadedProfile(data.profile);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load Business Context.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasDraft = Boolean(profile?.draft);
  const canApplyDraft = profile?.draft?.readiness === "ready" && Boolean(profile.draft.updatedAt);
  const version = profile?.activeProfileVersion ?? 0;
  const sourcePlaceholder = useMemo(
    () => "Describe only the current, factual business context you want us to analyze. Unsupported details stay empty rather than guessed.",
    [],
  );

  function setLoadedProfile(next: ContextResponse) {
    setProfile(next);
    setContext(normalizeContext(next.draft?.context ?? next.activeContext));
    setSource(next.draft?.source ?? "");
  }

  function updateTextField(field: keyof WebsiteBusinessAnalysis, value: string) {
    setContext((current) => current ? { ...current, [field]: value || null } : current);
  }

  function updateListField(field: "categories" | "claimsToAvoid" | "differentiators" | "painPoints" | "targetAudience" | "valueProps", value: string) {
    const limit = field === "categories" ? 3 : field === "targetAudience" ? 5 : 6;
    setContext((current) => current ? {
      ...current,
      [field]: value.split(/\n|,/u).map((item) => item.trim()).filter(Boolean).slice(0, limit),
    } : current);
  }

  async function runAction(action: "apply" | "reanalyze" | "save_draft") {
    if (!profile || !context) return;
    setBusyAction(action);
    setError(null);
    setMessage(null);
    try {
      const token = await getCurrentUserIdToken();
      if (!token) throw new Error("Sign in again before updating Business Context.");
      const payload = action === "apply"
        ? {
            action,
            expectedDraftUpdatedAt: profile.draft?.updatedAt,
            expectedProfileVersion: profile.activeProfileVersion,
          }
        : action === "reanalyze"
          ? {
              action,
              expectedDraftUpdatedAt: profile.draft?.updatedAt ?? null,
              expectedProfileVersion: profile.activeProfileVersion,
              source,
            }
          : {
              action,
              context: normalizeContext(context),
              expectedDraftUpdatedAt: profile.draft?.updatedAt ?? null,
              expectedProfileVersion: profile.activeProfileVersion,
              source: source || null,
            };
      const response = await fetch("/api/business-context", {
        body: JSON.stringify(payload),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json().catch(() => null) as ApiResponse;
      if (!response.ok || !data?.ok || !data.profile) throw new Error(data?.message ?? "Could not update Business Context.");
      setLoadedProfile(data.profile);
      setMessage(data.refreshScope ?? (action === "apply"
        ? "Your new context is active for the next local Trending day. Today's pack was not changed."
        : action === "reanalyze"
          ? "Re-analysis created a reviewable draft. Nothing live changed."
          : "Draft saved. Nothing live changed."));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update Business Context.");
    } finally {
      setBusyAction(null);
    }
  }

  if (!profile || !context) {
    return (
      <div className="flex min-h-48 items-center justify-center text-sm text-muted" aria-live="polite">
        {error ? error : <><LoaderCircle className="mr-2 size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading Business Context…</>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-foreground-strong">Business Context</h3>
            <Badge variant="outline">Version {version}</Badge>
            {hasDraft ? <Badge variant="secondary">Unapplied draft</Badge> : null}
            {profile.draft ? <Badge variant={profile.draft.readiness === "ready" ? "secondary" : "outline"}>{profile.draft.readiness === "ready" ? `${profile.draft.factCount} factual anchors ready` : "Needs factual anchors"}</Badge> : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            This is the factual source for future marketing content. Saving or re-analyzing creates a draft only; applying a fact-ready draft creates the next context version without rewriting today’s feed.
          </p>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" role="alert"><AlertTitle>Business Context was not updated</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      ) : null}
      {message ? (
        <Alert><CheckCircle2 aria-hidden="true" /><AlertTitle>Saved safely</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name"><Input value={context.businessName ?? ""} onChange={(event) => updateTextField("businessName", event.target.value)} /></Field>
        <Field label="Category"><Input value={context.category ?? ""} onChange={(event) => updateTextField("category", event.target.value)} /></Field>
        <Field label="Category tags (one per line)"><Textarea value={(context.categories ?? []).join("\n")} onChange={(event) => updateListField("categories", event.target.value)} /></Field>
        <Field label="Product summary" className="sm:col-span-2"><Textarea value={context.productSummary ?? ""} onChange={(event) => updateTextField("productSummary", event.target.value)} /></Field>
        <Field label="Main customer problem" className="sm:col-span-2"><Textarea value={context.mainProblem ?? ""} onChange={(event) => updateTextField("mainProblem", event.target.value)} /></Field>
        <Field label="Main promise" className="sm:col-span-2"><Textarea value={context.mainPromise ?? ""} onChange={(event) => updateTextField("mainPromise", event.target.value)} /></Field>
        <Field label="Target audience (one per line)" className="sm:col-span-2"><Textarea value={context.targetAudience.join("\n")} onChange={(event) => updateListField("targetAudience", event.target.value)} /></Field>
        <Field label="Customer pain points (one per line)" className="sm:col-span-2"><Textarea value={context.painPoints.join("\n")} onChange={(event) => updateListField("painPoints", event.target.value)} /></Field>
        <Field label="Approved capabilities / value (one per line)" className="sm:col-span-2"><Textarea value={context.valueProps.join("\n")} onChange={(event) => updateListField("valueProps", event.target.value)} /></Field>
        <Field label="Differentiators (one per line)" className="sm:col-span-2"><Textarea value={context.differentiators.join("\n")} onChange={(event) => updateListField("differentiators", event.target.value)} /></Field>
        <Field label="Claims to avoid (one per line)" className="sm:col-span-2"><Textarea value={context.claimsToAvoid.join("\n")} onChange={(event) => updateListField("claimsToAvoid", event.target.value)} /></Field>
      </div>

      <div className="rounded-control border border-border bg-card-muted/35 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground-strong">Re-analyze factual source</p>
            <p className="mt-1 text-sm leading-6 text-muted">Uses GPT-5.6 Luna with medium reasoning to produce a new draft. It cannot change live context on its own.</p>
            <Textarea className="mt-3 min-h-28" placeholder={sourcePlaceholder} value={source} onChange={(event) => setSource(event.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={busyAction !== null} onClick={() => void runAction("save_draft")}>
          {busyAction === "save_draft" ? <LoaderCircle data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save data-icon="inline-start" aria-hidden="true" />}
          Save draft
        </Button>
        <Button type="button" variant="outline" disabled={busyAction !== null || source.trim().length < 20} onClick={() => void runAction("reanalyze")}>
          {busyAction === "reanalyze" ? <LoaderCircle data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RefreshCw data-icon="inline-start" aria-hidden="true" />}
          Re-analyze draft
        </Button>
        <Button type="button" disabled={busyAction !== null || !canApplyDraft} onClick={() => void runAction("apply")}>
          {busyAction === "apply" ? <LoaderCircle data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CheckCircle2 data-icon="inline-start" aria-hidden="true" />}
          Apply to future content
        </Button>
      </div>
    </div>
  );
}

function Field({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return <label className={`grid gap-1.5 text-sm font-semibold text-foreground-strong ${className ?? ""}`}><span>{label}</span>{children}</label>;
}

function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`w-full rounded-control border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 ${props.className ?? ""}`} />;
}

function normalizeContext(context: WebsiteBusinessAnalysis): WebsiteBusinessAnalysis {
  return {
    ...context,
    businessModel: context.businessModel ?? null,
    campaignPurposes: context.campaignPurposes ?? [],
    categories: context.categories ?? (context.category ? [context.category] : []),
  };
}
