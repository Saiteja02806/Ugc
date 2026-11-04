import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FormatWorkspace } from "@/components/explore/format-workspace";
import { HookWorkflowPreview } from "@/components/explore/hook-workflow-preview";
import { PhoneWorkflowPreview } from "@/components/explore/phone-workflow-preview";
import { getLocalRecreateReferences } from "@/lib/explore/recreate-catalog";
import { FeedbackPreview } from "./preview";

/** Actual local workflow chrome and notification; synthetic feedback, no submissions. */
export default async function Page({ searchParams }: { searchParams: Promise<{ flow?: string; state?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { flow, state } = await searchParams;
  return <AppShell activeKey="explore" focusNavigation><Suspense>
    {flow === "talking" ? <HookWorkflowPreview /> : flow === "phone" ? <PhoneWorkflowPreview />
      : <FormatWorkspace format={flow === "slideshow" ? "slideshow" : flow === "wall_text" ? "wall_text" : "hook"} previewReferences={getLocalRecreateReferences()} />}
    <FeedbackPreview key={`${flow}:${state}`} state={state ?? "error"} />
  </Suspense></AppShell>;
}
