"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { ArrowRight, AudioLines, ChevronDown, LoaderCircle, LockKeyhole, SlidersHorizontal, Sparkles } from "lucide-react";
import type { AudioModel, AudioVoice } from "@/lib/audio/types";
import { VoiceOrb } from "./voice-orb";

type SpeechControlsProps = {
  models: AudioModel[];
  modelId: string;
  speed: number;
  onModel: (id: string) => void;
  onSpeed: (speed: number) => void;
};
type SpeechEditorProps = SpeechControlsProps & {
  layout: "studio" | "standalone";
  voice: AudioVoice | undefined;
  name: string;
  script: string;
  placeholder: string;
  scriptRef: RefObject<HTMLTextAreaElement | null>;
  estimatedDuration: string | null;
  creditCostPer1000: number;
  availabilityMessage: string | null;
  freeTest: boolean;
  upgradeRequired: boolean;
  ready: boolean;
  posting: boolean;
  generating: boolean;
  onName: (name: string) => void;
  onScript: (script: string) => void;
  onExample: () => void;
  onBrowseVoices: () => void;
  onGenerate: () => void;
};

export function AudioSpeechEditor({ layout, voice, name, script, placeholder, scriptRef, estimatedDuration, creditCostPer1000, availabilityMessage, freeTest, upgradeRequired, ready, posting, generating, onName, onScript, onExample, onBrowseVoices, onGenerate, models, modelId, speed, onModel, onSpeed }: SpeechEditorProps) {
  const studio = layout === "studio";
  const controls = <SpeechControls models={models} modelId={modelId} speed={speed} onModel={onModel} onSpeed={onSpeed} />;
  return <div className={studio ? "audio-studio-editor" : "audio-speech-layout"}>
    <div className="audio-editor">
      <div className="audio-section-heading">
        <h2>Text to speech</h2>
        <button type="button" className="audio-text-button" disabled={Boolean(script.trim())} title={script.trim() ? "Examples are available for an empty draft" : undefined} onClick={onExample}><Sparkles size={14} />Try an example</button>
      </div>
      {studio ? <div className="audio-studio-selected-voice" aria-live="polite"><span><AudioLines size={15} />{voice ? "Selected voice · " + voice.name.split(" - ")[0] : "Choose a voice above"}{voice && !voice.available ? " · Preview only" : ""}</span><button type="button" className="audio-text-button" onClick={onBrowseVoices}>Change voice<ArrowRight size={14} /></button></div> : null}
      <input className="audio-title-input" aria-label="Audio name" maxLength={100} value={name} onChange={event => onName(event.target.value)} placeholder={studio ? "Name your voiceover" : "Untitled voiceover"} />
      <label className="sr-only" htmlFor="audio-script">Script</label>
      <textarea id="audio-script" ref={scriptRef} className="audio-script" value={script} maxLength={1500} onChange={event => onScript(event.target.value)} placeholder={placeholder} />
      <div className="audio-editor-footer"><span>{script.trim().length.toLocaleString()} / 1,500 characters</span>{creditCostPer1000 && script.trim() ? <span>{Math.ceil(script.trim().length / 1000) * creditCostPer1000} generation credits</span> : estimatedDuration ? <span>About {estimatedDuration} · estimated</span> : null}</div>
      {studio ? <>
        <details className="audio-studio-settings"><summary><SlidersHorizontal size={14} />Voice settings<span>{models.find(model => model.id === modelId)?.name || "Speech model"} · {speed.toFixed(2)}×</span><ChevronDown size={13} /></summary><div className="audio-studio-controls">{controls}</div></details>
        {availabilityMessage ? <p className="audio-inline-note audio-studio-availability"><LockKeyhole size={15} />{availabilityMessage}</p> : null}
      </> : null}
      <div className="audio-generate-row"><span className="audio-fine-print">{upgradeRequired ? "Browse voices and listen to samples on Free." : freeTest ? "Free-plan testing · Noncommercial use" : "Your audio saves automatically."}</span><div className="audio-generate-actions">{upgradeRequired ? <Link href="/pricing" className="audio-text-button">View plans<ArrowRight size={14} /></Link> : null}<button type="button" className="audio-primary" disabled={!ready || upgradeRequired} onClick={onGenerate}>{posting || generating ? <LoaderCircle size={16} className="animate-spin" /> : <AudioLines size={17} />}{posting ? "Submitting…" : generating ? "Generating…" : "Generate audio"}</button></div></div>
    </div>
    {!studio ? <aside className="audio-speech-settings" aria-label="Speech settings">
      <h3>Voice</h3><div className="audio-selected-voice">{voice ? <VoiceOrb id={voice.id} /> : <AudioLines size={30} />}<div><strong>{voice?.name || "Choose a voice"}</strong><span>{voice ? [voice.labels.accent, voice.labels.gender].filter(Boolean).map(displayLabel).join(" · ") : "Browse the voice library"}</span></div></div>
      <button type="button" className="audio-text-button" onClick={onBrowseVoices}>Change voice<ArrowRight size={14} /></button>
      {controls}
      {availabilityMessage ? <p className="audio-inline-note"><LockKeyhole size={15} />{availabilityMessage}</p> : <p className="audio-fine-print">Generation uses your ElevenLabs allowance. Voice samples are already available to preview.</p>}
    </aside> : null}
  </div>;
}

function SpeechControls({ models, modelId, speed, onModel, onSpeed }: SpeechControlsProps) {
  return <>
    <div className="audio-settings-field"><label htmlFor="audio-model">Speech model</label><select id="audio-model" className="audio-input" value={modelId} onChange={event => onModel(event.target.value)} disabled={!models.length}>{models.length ? models.map(model => <option key={model.id} value={model.id}>{model.name}</option>) : <option value="eleven_flash_v2_5">Connect to load models</option>}</select></div>
    <div className="audio-settings-field"><label htmlFor="audio-speed">Speed<span>{speed.toFixed(2)}×</span></label><input id="audio-speed" type="range" min={0.8} max={1.2} step={0.05} value={speed} onChange={event => onSpeed(Number(event.target.value))} /><div className="audio-range-labels"><span>Slower</span><span>Faster</span></div></div>
  </>;
}
function displayLabel(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
