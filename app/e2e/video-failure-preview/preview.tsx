"use client";

import { History, Plus } from "lucide-react";
import { useState } from "react";

import { AiStudioComposer, AiStudioSettingSelect } from "@/components/generation/ai-studio-composer";
import { AiStudioResults } from "@/components/generation/ai-studio-results";
import { Button } from "@/components/ui/button";
import { VideoGenerationFailure } from "@/components/video/video-generation-failure";

// Local-only layout fixture: no authentication, job submission or paid API calls.
export function VideoFailurePreview() {
  const [scenario, setScenario] = useState("moderation");
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [prompt, setPrompt] = useState("Create a short video about better sleep habits.");
  const message = scenario === "moderation"
    ? "The model provider blocked this generation through content moderation. Review your prompt and reference media before starting a new generation."
    : "The video provider is temporarily unavailable. Try again in a moment.";

  return (
    <main id="ai-studio-videos-panel" className="mx-auto flex min-h-dvh max-w-[1500px] flex-col px-4 pt-5 text-foreground sm:px-7 md:h-dvh md:min-h-0">
      <header className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">AI Studio</h1>
        <p className="mt-1 text-sm text-muted">Create platform-ready images and presenter videos from a prompt.</p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Local preview scenarios">
          {[["moderation", "Moderation"], ["retryable", "Retryable"], ["partial", "Partial batch"]].map(([value, label]) => (
            <Button key={value} type="button" variant="outline" size="sm" aria-pressed={scenario === value} onClick={() => { setScenario(value); setDismissed(false); setRetrying(false); }}>{label}</Button>
          ))}
        </div>
      </header>
      <AiStudioResults
        ariaLabel="Generated videos"
        emptyDescription="Start a new video below. Your earlier generations are in History."
        hasResults={scenario === "partial"}
        status={dismissed ? null : { tone: "error", label: message }}
        toolbar={<Button type="button" variant="outline" size="sm" className="rounded-full"><History aria-hidden="true" />History</Button>}
        failure={<VideoGenerationFailure
          title={scenario === "moderation" ? "Generation blocked" : "Video couldn't be generated"}
          message={message}
          jobId="7330fb5c-938c-474e-826c-3b7089609373"
          onDismiss={() => setDismissed(true)}
          onEditPrompt={() => document.querySelector<HTMLTextAreaElement>('textarea[name="videoPrompt"]')?.focus()}
          onRetry={scenario === "moderation" ? undefined : () => setRetrying(true)}
          retrying={retrying}
        />}
      >
        <div className="mx-auto rounded-xl border border-border bg-card p-6">Successful video result remains visible</div>
      </AiStudioResults>
      <AiStudioComposer
        active
        ariaLabel="Video generation prompt"
        generateDisabled={!prompt.trim()}
        generateLabel="Generate video"
        generationLocked={false}
        isGenerating={false}
        layout="unified"
        maxLength={10000}
        name="videoPrompt"
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmit={(event) => event?.preventDefault()}
        onTextareaKeyDown={() => {}}
        placeholder="Describe the video you want to create…"
        showPromptHint={false}
        leadingControl={<Button type="button" variant="ghost" size="icon-sm" aria-label="Attach reference"><Plus aria-hidden="true" /></Button>}
        settings={<>
          <AiStudioSettingSelect ariaLabel="Video model" size="sm" options={[{ label: "Seedance 2.5", value: "seedance_2_5" }, { label: "Omni Flash 1.1", value: "google_omni" }]} value="seedance_2_5" onChange={() => {}} />
          <AiStudioSettingSelect ariaLabel="Resolution" size="sm" options={[{ label: "720p", value: "720p" }]} value="720p" onChange={() => {}} />
          <AiStudioSettingSelect ariaLabel="Duration" size="sm" options={[{ label: "5 sec", value: "5" }]} value="5" onChange={() => {}} />
        </>}
      />
    </main>
  );
}
