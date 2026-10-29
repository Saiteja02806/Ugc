"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  applyBusinessContextListText,
  businessContextValidationMessage,
  createBusinessContextListText,
  type BusinessContextListField,
  type BusinessContextListText,
} from "@/lib/business-profiles/business-context-form";
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
  const [initialContext, setInitialContext] = useState<WebsiteBusinessAnalysis | null>(null);
  const [listText, setListText] = useState<BusinessContextListText | null>(null);
  const [busyAction, setBusyAction] = useState<"apply" | null>(null);
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

  const canApplyDraft = profile?.draft?.readiness === "ready" && Boolean(profile.draft.updatedAt);
  const editedContext = useMemo(
    () => context && listText
      ? normalizeContext(applyBusinessContextListText(context, listText))
      : null,
    [context, listText],
  );
  const hasFormChanges = Boolean(
    editedContext
    && initialContext
    && JSON.stringify(editedContext) !== JSON.stringify(initialContext),
  );
  const canApplyChanges = hasFormChanges || canApplyDraft;
  const version = profile?.activeProfileVersion ?? 0;

  function setLoadedProfile(next: ContextResponse) {
    const nextContext = normalizeContext(next.draft?.context ?? next.activeContext);
    setProfile(next);
    setContext(nextContext);
    setInitialContext(nextContext);
    setListText(createBusinessContextListText(nextContext));
  }

  function updateTextField(field: keyof WebsiteBusinessAnalysis, value: string) {
    setContext((current) => current ? { ...current, [field]: value || null } : current);
  }

  function updateListField(field: BusinessContextListField, value: string) {
    // Keep every keystroke exactly as entered. List parsing happens only for
    // the explicit Save draft action, not while a person is composing copy.
    setListText((current) => current ? { ...current, [field]: value } : current);
  }

  async function runAction(action: "apply") {
    if (!profile || !context || !listText) return;
    const validationMessage = businessContextValidationMessage(editedContext);
    if (validationMessage) { setMessage(null); setError(validationMessage); return; }
    setBusyAction(action);
    setError(null);
    setMessage(null);
    try {
      const token = await getCurrentUserIdToken();
      if (!token) throw new Error("Sign in again before updating Business Context.");
      const payload = {
        action,
        context: editedContext ?? normalizeContext(applyBusinessContextListText(context, listText)),
        expectedDraftUpdatedAt: profile.draft?.updatedAt ?? null,
        expectedProfileVersion: profile.activeProfileVersion,
      };
      const response = await fetch("/api/business-context", {
        body: JSON.stringify(payload),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json().catch(() => null) as ApiResponse;
      if (!response.ok || !data?.ok || !data.profile) throw new Error(data?.message ?? "Could not update Business Context.");
      setLoadedProfile(data.profile);
      setMessage(data.refreshScope ?? "Your new context is active for the next local Trending day. Today's pack was not changed.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update Business Context.");
    } finally {
      setBusyAction(null);
    }
  }

  if (!profile || !context || !listText) {
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
            {profile.draft ? <Badge variant={profile.draft.readiness === "ready" ? "secondary" : "outline"}>{profile.draft.readiness === "ready" ? `${profile.draft.factCount} factual anchors ready` : "Needs factual anchors"}</Badge> : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Edit the details below, then apply them when ready. Write full, specific sentences—there is no tight character limit, and each line in list fields becomes an independent marketing angle. Applying creates the next context version for future marketing content without rewriting today’s feed.
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
        <Field label="Business name">
          <Input
            value={context.businessName ?? ""}
            placeholder="e.g. Acme Nutrition"
            onChange={(event) => updateTextField("businessName", event.target.value)}
          />
        </Field>
        <Field label="Category">
          <Input
            value={context.category ?? ""}
            placeholder="e.g. Health & Wellness / AI Calorie Tracker"
            onChange={(event) => updateTextField("category", event.target.value)}
          />
        </Field>
        <Field label="Category tags (one per line)" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={listText.categories}
            placeholder={"Health Tech\nNutrition\nMobile App"}
            onChange={(event) => updateListField("categories", event.target.value)}
          />
        </Field>
        <Field label="Product summary" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={context.productSummary ?? ""}
            placeholder="An AI-powered meal tracking mobile app that scans any food photo and calculates calories and macros in under 3 seconds."
            onChange={(event) => updateTextField("productSummary", event.target.value)}
          />
        </Field>
        <Field label="Main customer problem" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={context.mainProblem ?? ""}
            placeholder="Manually searching and logging ingredients in calorie counters takes 15 minutes a day, leading to tracking fatigue and giving up on health goals."
            onChange={(event) => updateTextField("mainProblem", event.target.value)}
          />
        </Field>
        <Field label="Main promise" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={context.mainPromise ?? ""}
            placeholder="Effortless nutrition tracking with a single photo so you can stay consistent with your diet without typing every ingredient."
            onChange={(event) => updateTextField("mainPromise", event.target.value)}
          />
        </Field>
        <Field label="Target audience (one per line)" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={listText.targetAudience}
            placeholder={"Busy working professionals trying to stay in shape\nFitness enthusiasts tracking macros\nPeople tired of manual calorie counters"}
            onChange={(event) => updateListField("targetAudience", event.target.value)}
          />
        </Field>
        <Field label="Wall-of-Text primary reader" className="sm:col-span-2">
          <Input
            value={context.wallTextPrimaryReader ?? ""}
            placeholder="Busy corporate professionals who want quick, effortless meal tracking"
            onChange={(event) => updateTextField("wallTextPrimaryReader", event.target.value)}
          />
        </Field>
        <Field label="Wall-of-Text secondary reader (optional)" className="sm:col-span-2">
          <Input
            value={context.wallTextSecondaryReader ?? ""}
            placeholder="Athletes and bodybuilders tracking exact macros"
            onChange={(event) => updateTextField("wallTextSecondaryReader", event.target.value)}
          />
        </Field>
        <Field label="Customer pain points (one per line)" className="sm:col-span-2">
          <Textarea
            rows={4}
            value={listText.painPoints}
            placeholder={"Logging individual ingredients by hand is slow and frustrating\nMost food databases have inaccurate crowd-sourced calories\nForgetting to log meals because opening the app takes too long"}
            onChange={(event) => updateListField("painPoints", event.target.value)}
          />
        </Field>
        <Field label="Approved capabilities / value (one per line)" className="sm:col-span-2">
          <Textarea
            rows={4}
            value={listText.valueProps}
            placeholder={"Instant photo-based food analysis with calorie and macro breakdown\nBarcode scanner for packaged grocery items\nDaily macro progress charts and streak tracking"}
            onChange={(event) => updateListField("valueProps", event.target.value)}
          />
        </Field>
        <Field label="Differentiators (one per line)" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={listText.differentiators}
            placeholder={"Zero manual typing required—just snap a photo\nReal nutrition science data, not crowd-sourced estimates\nWorks offline for meals on the go"}
            onChange={(event) => updateListField("differentiators", event.target.value)}
          />
        </Field>
        <Field label="Claims to avoid (one per line)" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={listText.claimsToAvoid}
            placeholder={"Guaranteed weight loss\nMedical dietary advice or disease treatment claims\n100% lab-accurate nutrition measurement"}
            onChange={(event) => updateListField("claimsToAvoid", event.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button type="button" disabled={busyAction !== null || !canApplyChanges} onClick={() => void runAction("apply")}>
          {busyAction === "apply" ? <LoaderCircle data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CheckCircle2 data-icon="inline-start" aria-hidden="true" />}
          Apply changes to future content
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
    businessName: context.businessName?.trim() || null,
    category: context.category?.trim() || null,
    productSummary: context.productSummary?.trim() || null,
    mainProblem: context.mainProblem?.trim() || null,
    mainPromise: context.mainPromise?.trim() || null,
    wallTextPrimaryReader: context.wallTextPrimaryReader?.trim() || null,
    wallTextSecondaryReader: context.wallTextSecondaryReader?.trim() || null,
    businessModel: context.businessModel ?? null,
    campaignPurposes: context.campaignPurposes ?? [],
    categories: context.categories ?? (context.category ? [context.category] : []),
  };
}
