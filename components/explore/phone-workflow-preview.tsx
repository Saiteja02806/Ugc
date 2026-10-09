"use client";

import { Tabs } from "@base-ui/react/tabs";
import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PhoneWorkflowComposer, AppScreenPicker } from "@/components/explore/phone-workflow-composer";
import { WorkflowCompositionPanel } from "@/components/explore/workflow-composition-panel";
import { WorkflowCreationPanel, type WorkflowSection } from "@/components/explore/workflow-creation-panel";
import { WorkflowEditWorkspace, WorkflowScheduleWorkspace } from "@/components/explore/workflow-edit-workspace";
import { EMPTY_SCHEDULE_DRAFT, WorkflowSchedulingPanel } from "@/components/explore/workflow-scheduling-panel";
import { WorkflowPreviewCanvas } from "@/components/explore/workflow-preview-canvas";
import { useLocalAppScreen } from "@/components/explore/use-local-app-screen";
import { useLocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import studio from "@/components/explore/workflow-studio.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import { cn } from "@/lib/utils";
import { WorkflowOwnedVideoBoundary } from "@/components/explore/workflow-owned-video-boundary";
import { WorkflowFinishingBoundary } from "@/components/explore/workflow-finishing-boundary";
import { WorkflowConnectedAccounts } from "@/components/explore/workflow-connected-accounts";
import { selectWorkflowAccount, workflowSelectedAccounts, workflowSelectedPlatforms } from "@/lib/explore/workflow-scheduling-draft";
import type { WorkflowVideoSelection } from "@/components/explore/use-workflow-source-video";
import { WorkflowVideoSourceSection } from "@/components/explore/workflow-video-source-section";

export function PhoneWorkflowPreview({ finishingEnabled = false }: { finishingEnabled?: boolean }) {
  return <WorkflowOwnedVideoBoundary enabled={finishingEnabled}>{selection => <PhoneWorkflowLayout key={selection.ownerId ?? "preview"} selection={selection} finishingEnabled={finishingEnabled} />}</WorkflowOwnedVideoBoundary>;
}
function PhoneWorkflowLayout({ selection, finishingEnabled }: { selection: WorkflowVideoSelection; finishingEnabled: boolean }) {
  const { ownerId, source } = selection;
  const [section, setSection] = useState<WorkflowSection>("create");
  const [scheduleDraft, setScheduleDraft] = useState(EMPTY_SCHEDULE_DRAFT);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [audioMode, setAudioMode] = useState<"voice" | "recording">("voice");
  const [instructions, setInstructions] = useState("");
  const appScreen = useLocalAppScreen();
  const creator = useLocalWorkflowMedia("image");
  const videoReference = useLocalWorkflowMedia("video");
  const creatorAudio = useLocalWorkflowMedia("audio");
  const demo = useLocalWorkflowMedia("video");
  const demoAudio = useLocalWorkflowMedia("audio");
  const dirty = Boolean(selection.dirty || instructions.length || appScreen.asset || creator.asset || videoReference.asset || creatorAudio.asset || demo.asset || demoAudio.asset || Object.values(scheduleDraft).some(Boolean));
  const [playback, setPlayback] = useState<"once" | "repeat">("once");

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function removeDemo() {
    demoAudio.remove();
    demo.remove();
    setPlayback("once");
  }

  async function chooseDemo(file: File) {
    const accepted = await demo.choose(file);
    if (accepted) { demoAudio.remove(); setPlayback("once"); }
    return accepted;
  }

  function changeSection(value: WorkflowSection) {
    workspaceRef.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach(player => player.pause());
    setSection(value);
    requestAnimationFrame(() => workspaceRef.current?.querySelector<HTMLButtonElement>('[role="tab"][data-active]')?.focus());
  }

  return <WorkflowFinishingBoundary enabled={finishingEnabled} ownerId={ownerId} kind="phone" source={source} demo={demo.asset} demoAudio={demoAudio.asset} playback={playback} scheduleDraft={scheduleDraft}>{finishing => <section className={cn(studio.studio, creation.shell, "min-w-0")}>
    {/* The Library follows the complete first-screen workspace, never its initial viewport. */}
    <div data-phone-first-screen className="flex min-h-[calc(100dvh-4rem)] flex-col md:min-h-dvh">
      <header className={cn(creation.header, "flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8")}>
        <Link href="/explore?preview=1" aria-label="Back to Explore" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={(event) => {
          if (!event.metaKey && !event.ctrlKey && dirty && !window.confirm("Leave this workflow? Your local changes are not saved.")) event.preventDefault();
        }}><ArrowLeft className="size-4" aria-hidden="true" /></Link>
        <span className="hidden text-sm text-muted sm:block">Explore <span className="ml-2" aria-hidden="true">/</span></span>
        <div className="min-w-0"><h1 className="text-base font-semibold tracking-tight text-foreground-strong sm:text-lg">Creator Shows App on Phone</h1></div>
      </header>

      <Tabs.Root ref={workspaceRef} value={section} className={creation.layout} onValueChange={(value) => {
        if (value !== "create" && value !== "edit" && value !== "schedule") return;
        changeSection(value);
      }}>
        <WorkflowCreationPanel kind="phone" section={section} create={selection.mode === "generate" ? undefined : { disabled: !selection.ready, busy: selection.busy, message: selection.ready ? "Your selected video is ready. Continue to add optional edits." : "Upload or choose a video to continue. Up to 120 seconds.", onAction: () => changeSection("edit") }} edit={finishingEnabled ? finishing.edit : undefined} schedule={finishingEnabled ? finishing.schedule : undefined}>
          <Tabs.Panel value="create" keepMounted className={creation.sectionPanel}>
            <WorkflowVideoSourceSection kind="phone" selection={selection} />
            <div hidden={selection.mode !== "generate"} className={creation.generationFields}>
            <PhoneWorkflowComposer instructions={instructions} onInstructionsChange={setInstructions} creator={creator} videoReference={videoReference} appScreenControl={<AppScreenPicker attachment={appScreen} />} audioLabel="Creator audio" audio={creatorAudio} audioMode={audioMode} onAudioModeChange={setAudioMode} />
            </div>
          </Tabs.Panel>
          <Tabs.Panel value="edit" keepMounted className={creation.sectionPanel}>
            <div className="mb-3 flex min-w-0 items-center justify-between gap-2"><p className="truncate text-xs text-muted" title={selection.preview?.name}>{selection.preview?.name ?? "Choose a video in Create."}</p><button type="button" className="shrink-0 rounded px-2 py-2 text-xs text-primary focus-visible:outline-2 focus-visible:outline-focus" onClick={() => changeSection("create")}>Change video</button></div>
            <WorkflowCompositionPanel connected={finishingEnabled && !!ownerId} ownerId={ownerId} options={finishing.options} onOptionsChange={finishing.setOptions} videoLabel="Phone video"
              demo={{ ...demo, choose: chooseDemo, remove: removeDemo }} demoAudio={demoAudio} demoAudioPlayback={playback} onDemoAudioPlaybackChange={setPlayback} />
          </Tabs.Panel>
          <Tabs.Panel value="schedule" keepMounted className={creation.sectionPanel}>
            <WorkflowSchedulingPanel draft={scheduleDraft} onChange={setScheduleDraft} accountsControl={<WorkflowConnectedAccounts enabled={finishingEnabled} active={section === "schedule"} ownerId={ownerId} platforms={workflowSelectedPlatforms(scheduleDraft)} selectedIds={workflowSelectedAccounts(scheduleDraft)} onSelect={(platform, id) => setScheduleDraft(selectWorkflowAccount(scheduleDraft, platform, id))} />} />
          </Tabs.Panel>
        </WorkflowCreationPanel>
        <section aria-label="Phone video creation workspace" className={creation.main}>
          {section === "create" ? <WorkflowPreviewCanvas kind="phone" source={selection.preview} mode={selection.mode} />
            : section === "edit" ? <WorkflowEditWorkspace kind="phone" demo={demo} demoAudio={demoAudio} generatedVideo={source} sourcePreview={selection.preview} finishedVideo={finishing.output} />
            : <WorkflowScheduleWorkspace draft={scheduleDraft} finishedVideo={finishing.output} />}
          <div className={creation.canvasFooter}>
            <a href="#phone-reference-library" aria-label="Scroll to Library" className={creation.libraryShortcut} onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              const library = document.getElementById("phone-reference-library");
              if (!library) return;
              event.preventDefault();
              library.focus({ preventScroll: true });
              library.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
            }}>Library ↓</a>
          </div>
        </section>

      </Tabs.Root>
    </div>

    <PhoneLibrary />
  </section>}</WorkflowFinishingBoundary>;
}

function PhoneLibrary() {
  // No cover, videos or substitutes until approved media is supplied.
  return <section aria-label="Reference library" data-phone-library className="px-4 pt-10 pb-16 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[944px]">
      <div className="flex items-center gap-2.5"><BookOpen className="size-4 text-primary" aria-hidden="true" /><h2 id="phone-reference-library" tabIndex={-1} className="scroll-mt-6 rounded-lg text-lg font-semibold tracking-tight text-foreground-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">Library</h2></div>
      <p className="mt-2 text-xs leading-5 text-muted">Examples to explore when you want inspiration.</p>
      <p className="mt-6 text-sm text-muted">No videos yet.</p>
    </div>
  </section>;
}
