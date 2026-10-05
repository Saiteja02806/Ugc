"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownAZ, ArrowRight, AudioLines, Bookmark, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, FileAudio, Headphones, Languages, LoaderCircle, LockKeyhole, Megaphone, MessageCircle, MonitorPlay, Pause, Play, Plus, RefreshCw, Search, SlidersHorizontal, Sparkles, Trash2, Upload, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";
import type { AudioAsset, AudioBootstrap, AudioHistory, AudioVoice } from "@/lib/audio/types";
import { audioSubmissionStorageKey, readAudioSubmission, audioSubmissionResolved, type SavedAudioSubmission } from "@/lib/audio/submission-client";
import { AUDIO_CONTENT_PURPOSES, getStudioVoiceShortlist, rankVoicesForLibraryFocus, selectInitialVoice, type AudioContentPurpose, type VoiceLibraryFocus } from "@/lib/audio/voice-recommendations";
import { AudioPlayer } from "./audio-player";
import { AudioSpeechEditor } from "./audio-speech-editor";
import { AUDIO_UPGRADE_MESSAGE } from "@/worker/src/lib/audio-access-policy";
import { VoiceOrb } from "./voice-orb";
import { useAudioBookmarks } from "./use-audio-bookmarks";
import "./audio-generation.css";

const TERMINAL = new Set(["completed", "failed", "uncertain", "cancelled"]);
export function AudioGenerationWorkspace() {
  const { user } = useAuth();
  return user ? <AudioGenerationSession key={user.uid} uid={user.uid} /> : <section className="p-8 text-sm text-muted">Sign in to generate audio.</section>;
}
function AudioGenerationSession({ uid }: { uid: string }) {
  const [data, setData] = useState<AudioBootstrap | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); const [posting, setPosting] = useState(false); const postingRef = useRef(false);
  const [view, setView] = useState<"studio" | "library" | "bookmarks" | "speech" | "voices" | "audio">("studio");
  const [editorView, setEditorView] = useState<"studio" | "speech">("studio"); const [studioPage, setStudioPage] = useState(0);
  const [purpose, setPurpose] = useState<AudioContentPurpose>("social"); const purposeRef = useRef<AudioContentPurpose>("social");
  const [category, setCategory] = useState<VoiceLibraryFocus>("social"); const [showVoiceForm, setShowVoiceForm] = useState(false);
  const [language, setLanguage] = useState("all"); const [gender, setGender] = useState("all"); const [sort, setSort] = useState("recommended");
  const [playingId, setPlayingId] = useState<string | null>(null); const scriptInput = useRef<HTMLTextAreaElement>(null);
  const [script, setScript] = useState(""); const [name, setName] = useState("");
  const [voiceId, setVoiceId] = useState(""); const [modelId, setModelId] = useState("eleven_flash_v2_5"); const [speed, setSpeed] = useState(1); const [query, setQuery] = useState("");
  const [referenceId, setReferenceId] = useState(""); const [voiceName, setVoiceName] = useState(""); const [consent, setConsent] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null); const [liveId, setLiveId] = useState<string | null>(null);
  const submission = useRef<SavedAudioSubmission | null>(null);
  const [savedSubmission, setSavedSubmission] = useState<SavedAudioSubmission | null>(null), [restored, setRestored] = useState(false), [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const preview = useRef<HTMLAudioElement | null>(null); const session = useRef(0);
  const api = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!uid) throw new Error("Sign in to use audio generation.");
    const current = session.current; const token = await getCurrentUserIdToken(uid);
    if (!token || current !== session.current) throw new Error("Sign in to use audio generation.");
    const response = await fetch(path, { ...init, cache: "no-store", headers: { ...init.headers, Authorization: `Bearer ${token}` } });
    const result = await response.json(); if (current !== session.current) throw new Error("This audio account is no longer active."); if (!response.ok) throw new Error(result.error || "Audio could not be loaded."); return result as T;
  }, [uid]);
  const reconcileSubmission = useCallback((result: AudioHistory, saved = submission.current) => {
    if (!saved) return;
    const latest = result.requests.find(r => r.requestKey === saved.key);
    if (!latest) return; // An absent/limited history is not permission for a new key.
    setLiveId(latest.id); setRecoveryBlocked(latest.status === "uncertain");
    if (latest.status === "completed" && latest.outputAssetId) setSelectedAssetId(latest.outputAssetId);
    if (audioSubmissionResolved(latest.status)) {
      const stored = readAudioSubmission(localStorage.getItem(audioSubmissionStorageKey(uid)), uid);
      if (stored?.key === saved.key) localStorage.removeItem(audioSubmissionStorageKey(uid));
      if (submission.current?.key === saved.key) { submission.current = null; setSavedSubmission(null); setLiveId(null); }
    }
  }, [uid]);
  const bookmarks = useAudioBookmarks(uid, api);
  const bookmarkControls = {
    bookmarkIds: bookmarks.ids, bookmarkPendingIds: bookmarks.pendingIds,
    bookmarksReady: bookmarks.ready, onBookmark: (id: string) => void bookmarks.toggle(id),
  };
  const load = useCallback(async (refresh = false) => {
    const current = session.current;
    try {
      const result = await api<AudioBootstrap>(`/api/audio/bootstrap${refresh ? "?refresh=1" : ""}`); if (current !== session.current) return;
      setData(result); setError(null); setVoiceId(previous => selectInitialVoice(result.voices, purposeRef.current, previous));
      reconcileSubmission(result);
      setModelId(previous => result.models.some(m => m.id === previous) ? previous : result.models[0]?.id || "eleven_flash_v2_5");
      return result;
    } catch (err) { if (current === session.current) setError(err instanceof Error ? err.message : "Audio could not be loaded."); }
    finally { if (current === session.current) setLoading(false); }
  }, [api, reconcileSubmission]);
  useEffect(() => {
    const current = ++session.current; const sessionRef = session; const previewRef = preview;
    void api<AudioBootstrap>("/api/audio/bootstrap").then(result => {
      if (current !== sessionRef.current) return;
      setData(result); setVoiceId(selectInitialVoice(result.voices, purposeRef.current)); setModelId(result.models[0]?.id || "eleven_flash_v2_5");
      const saved = readAudioSubmission(localStorage.getItem(audioSubmissionStorageKey(uid)), uid);
      submission.current = saved; setSavedSubmission(saved); setRestored(true);
      if (saved) {
        // Read-only recovery, including requests older than the first history page.
        void api<AudioHistory>(`/api/audio/history?requestKey=${encodeURIComponent(saved.key)}`).then(history => {
          if (current === sessionRef.current) reconcileSubmission(history, saved);
        }).catch(err => { if (current === sessionRef.current) setError(err instanceof Error ? err.message : "The saved audio request could not be checked."); });
      }
    }).catch(err => { if (current === sessionRef.current) setError(err instanceof Error ? err.message : "Audio could not be loaded."); })
      .finally(() => { if (current === sessionRef.current) setLoading(false); });
    return () => { sessionRef.current++; previewRef.current?.pause(); };
  }, [api, uid, reconcileSubmission]);
  const activeRequests = data?.requests.filter(r => !TERMINAL.has(r.status)) ?? [];
  const activeSpeech = activeRequests.find(r => r.kind === "speech");
  const hasActive = activeRequests.length > 0 || (savedSubmission !== null && liveId !== null && !recoveryBlocked);
  useEffect(() => {
    if (!hasActive) return; let stopped = false; let busy = false;
    const poll = async () => {
      if (busy || document.hidden) return; busy = true;
      try {
        const savedKey = submission.current?.key;
        const result = await api<AudioHistory>(savedKey ? `/api/audio/history?requestKey=${encodeURIComponent(savedKey)}` : "/api/audio/history"); if (stopped) return;
        setData(previous => previous ? { ...previous, ...result, requests: savedKey ? [...result.requests, ...previous.requests.filter(r => !result.requests.some(next => next.id === r.id))] : result.requests } : previous);
        const latest = result.requests.find(r => r.id === liveId);
        if (latest?.status === "completed" && latest.outputAssetId) { setSelectedAssetId(latest.outputAssetId); setLiveId(null); }
        reconcileSubmission(result);
        if (result.requests.length && result.requests.every(r => TERMINAL.has(r.status))) void load(true);
      } catch (err) { if (!stopped) setError(err instanceof Error ? err.message : "Progress could not be loaded."); }
      finally { busy = false; }
    };
    const timer = setInterval(() => void poll(), 1600); return () => { stopped = true; clearInterval(timer); };
  }, [api, hasActive, liveId, load, reconcileSubmission]);
  const selected = data?.assets.find(a => a.id === selectedAssetId && a.status === "ready") ?? null;
  const references = data?.assets.filter(a => a.purpose === "reference" && a.status === "ready") ?? [];
  const allVoices = data?.voices ?? [];
  const bookmarkedVoices = allVoices.filter(voice => bookmarks.ids.has(voice.id));
  const missingBookmarks = [...bookmarks.ids].filter(id => !allVoices.some(voice => voice.id === id));
  const chosenVoice = allVoices.find(v => v.id === voiceId);
  const purposeInfo = AUDIO_CONTENT_PURPOSES.find(item => item.id === purpose)!;
  const recommendations = rankVoicesForLibraryFocus(allVoices.filter(v => (view === "voices" ? v.private : !v.private) &&
    `${v.name} ${v.description} ${Object.values(v.labels).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()) &&
    (language === "all" || voiceLanguage(v) === language) && (gender === "all" || v.labels.gender?.toLowerCase() === gender)), category);
  if (sort === "name") recommendations.sort((a, b) => a.voice.name.localeCompare(b.voice.name) || a.voice.id.localeCompare(b.voice.id));
  const languages = [...new Set(allVoices.map(voiceLanguage).filter(Boolean))].sort();
  const filtered = Boolean(query.trim() || language !== "all" || gender !== "all" || sort !== "recommended");
  const voices = recommendations.map(item => item.voice);
  const focusInfo = VOICE_CATEGORIES.find(item => item.id === category)!;
  const studioShortlist = getStudioVoiceShortlist(allVoices, purpose);
  const studioPageCount = Math.ceil(studioShortlist.length / 6);
  const currentStudioPage = Math.min(studioPage, Math.max(0, studioPageCount - 1));
  const studioVoices = studioShortlist.slice(currentStudioPage * 6, (currentStudioPage + 1) * 6);
  const estimatedSeconds = script.trim() ? Math.max(1, Math.round(script.trim().split(/\s+/).length / (2.5 * speed))) : 0;
  const ready = Boolean(restored && !recoveryBlocked && data?.generationAccess === "allowed" && !posting && !activeSpeech && (savedSubmission || data.canGenerate && script.trim() && chosenVoice?.available && data.models.some(m => m.id === modelId)));
  async function submitSpeech() {
    if (!ready || postingRef.current) return; postingRef.current = true; setPosting(true); setError(null); const current = session.current;
    try {
      if (!navigator.locks) throw new Error("Use a browser with Web Locks support to generate audio safely across tabs.");
      await navigator.locks.request(audioSubmissionStorageKey(uid), { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is generating audio. Refresh its status first.");
        const prior = readAudioSubmission(localStorage.getItem(audioSubmissionStorageKey(uid)), uid);
        const saved: SavedAudioSubmission = prior ?? { version: 1, owner: uid, key: crypto.randomUUID(), payload: { script: script.trim(), voiceId, modelId, speed, name: name.trim() || "Untitled audio" } };
        readAudioSubmission(JSON.stringify(saved), uid);
        if (!prior) localStorage.setItem(audioSubmissionStorageKey(uid), JSON.stringify(saved));
        submission.current = saved; setSavedSubmission(saved);
        // An explicit resume replays this exact payload; current form edits must
        // never silently replace a request whose paid outcome is unknown.
        const result = await api<{ id: string; status: string }>("/api/audio/generations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...saved.payload, requestKey: saved.key }) });
        if (current !== session.current) return;
        setSelectedAssetId(null); setLiveId(result.id);
        reconcileSubmission(await api<AudioHistory>(`/api/audio/history?requestKey=${encodeURIComponent(saved.key)}`), saved);
        await load();
      });
    } catch (err) { if (current === session.current) setError(err instanceof Error ? err.message : "Speech could not be generated."); }
    finally { postingRef.current = false; if (current === session.current) setPosting(false); }
  }
  async function refreshSavedSubmission() {
    if (postingRef.current) return;
    const current = session.current;
    try {
      const saved = readAudioSubmission(localStorage.getItem(audioSubmissionStorageKey(uid)), uid);
      if (!saved) { await load(); return; }
      submission.current = saved; setSavedSubmission(saved);
      const result = await api<AudioHistory>(`/api/audio/history?requestKey=${encodeURIComponent(saved.key)}`);
      if (current === session.current) reconcileSubmission(result, saved);
    } catch (err) { if (current === session.current) setError(err instanceof Error ? err.message : "Could not check the saved audio request."); }
  }
  async function upload(file: File, purpose: "exact" | "reference") {
    if (postingRef.current) return;
    if (file.size > 3 * 1024 * 1024) { setError("Choose an audio file smaller than 3 MB."); return; }
    postingRef.current = true; setPosting(true); setError(null); const current = session.current;
    try {
      const form = new FormData(); form.append("file", file); form.append("purpose", purpose); form.append("requestKey", crypto.randomUUID());
      const result = await api<{ assetId: string }>("/api/audio/uploads", { method: "POST", body: form });
      if (current !== session.current) return;
      if (purpose === "reference") setReferenceId(result.assetId); else setSelectedAssetId(result.assetId); await load();
    } catch (err) { if (current === session.current) setError(err instanceof Error ? err.message : "Audio could not be uploaded."); }
    finally { postingRef.current = false; if (current === session.current) setPosting(false); }
  }
  async function clone() {
    if (!data?.canClone || !referenceId || !consent || !voiceName.trim() || postingRef.current) return;
    postingRef.current = true; setPosting(true); setError(null); const current = session.current;
    try { await api("/api/audio/voices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestKey: crypto.randomUUID(), assetId: referenceId, name: voiceName.trim(), consent }) }); if (current === session.current) await load(true); }
    catch (err) { if (current === session.current) setError(err instanceof Error ? err.message : "The voice could not be created."); }
    finally { postingRef.current = false; if (current === session.current) setPosting(false); }
  }
  function playSample(voice: AudioVoice) {
    preview.current?.pause();
    if (playingId === voice.id) { setPlayingId(null); return; }
    if (!voice.previewUrl) return;
    const current = session.current; const audio = new Audio(voice.previewUrl); preview.current = audio; setPlayingId(voice.id);
    audio.addEventListener("ended", () => { if (current === session.current && preview.current === audio) setPlayingId(null); }, { once: true });
    void audio.play().catch(() => { if (current === session.current && preview.current === audio) { setPlayingId(null); setError("This voice sample could not be played. Try another voice or refresh the library."); } });
  }
  async function removeAudio(kind: "assets" | "voices", id: string) {
    if (postingRef.current) return; postingRef.current = true; setPosting(true); setError(null); const current = session.current;
    try {
      await api(`/api/audio/${kind}/${id}`, { method: "DELETE" }); if (current !== session.current) return;
      if (kind === "assets" && selectedAssetId === id) { setSelectedAssetId(null); setLiveId(null); }
      await load(true);
    } catch (err) {
      if (current === session.current) {
        const message = err instanceof Error ? err.message : "Audio could not be removed.";
        // Retirement can commit before external cleanup fails. Refresh the
        // retired entries and retry controls, then retain the cleanup error.
        await load(true);
        if (current === session.current) setError(message);
      }
    }
    finally { postingRef.current = false; if (current === session.current) setPosting(false); }
  }
  function chooseAsset(asset: AudioAsset) { setLiveId(null); setSelectedAssetId(asset.id); setView("audio"); }
  function selectVoice(voice: AudioVoice) {
    if (editorView === "studio") prepareStudioPurpose();
    preview.current?.pause(); setPlayingId(null); setVoiceId(voice.id); setView(editorView); setError(null);
    if (view !== editorView) requestAnimationFrame(() => scriptInput.current?.focus());
  }
  function changeView(next: typeof view) {
    if (next === "studio") prepareStudioPurpose();
    preview.current?.pause(); setPlayingId(null); setView(next); setQuery(""); setLanguage("all"); setGender("all"); setSort("recommended"); setError(null);
    if (next === "studio" || next === "speech") setEditorView(next);
  }
  function prepareStudioPurpose() {
    if (purposeRef.current === "storytelling") { purposeRef.current = "social"; setPurpose("social"); setStudioPage(0); }
  }
  function changeCategory(next: VoiceLibraryFocus) {
    setCategory(next); setSort("recommended");
    if (next === "social" || next === "ugc_ad" || next === "product_demo" || next === "storytelling") { preview.current?.pause(); setPlayingId(null); purposeRef.current = next; setPurpose(next); setStudioPage(0); }
  }
  function changeStudioPage(next: number) { preview.current?.pause(); setPlayingId(null); setStudioPage(Math.max(0, Math.min(next, studioPageCount - 1))); }
  function insertExample() { if (script.trim()) return; setScript(purposeInfo.example); scriptInput.current?.focus(); }
  function clearFilters() { setQuery(""); setLanguage("all"); setGender("all"); setSort("recommended"); }
  const pendingCleanup = data?.cleanupPending?.filter(item => item.kind === (view === "voices" ? "voice" : "asset")) ?? [];
  const needsAttention = data?.requests.filter(r => r.status !== "completed" || r.voiceStatus === "verification_required") ?? [];
  const publicPreview = data?.catalogueSource === "public-preview";
  const upgradeRequired = data?.generationAccess === "upgrade_required";
  const availabilityMessage = upgradeRequired ? AUDIO_UPGRADE_MESSAGE : !data?.canGenerate ? data?.message || (publicPreview ? "Preview voices are ready. Connect and enable your audio account to generate your own script." : "Audio generation is not available yet. You can still explore the voice library.") : chosenVoice && !chosenVoice.available ? "This voice is a preview. Choose an available voice to generate." : null;
  return <section className="audio-workspace">
    <header className="audio-page-header">
      <div><h1>Audio generation</h1><p>Discover a voice. Create your next voiceover.</p></div>
      <div className="audio-header-actions">
        <button type="button" className="audio-icon-button" disabled={loading || posting} aria-label="Refresh voices" onClick={() => { void load(true); bookmarks.refresh(); }}><RefreshCw size={17} className={cn(loading && "animate-spin")} /></button>
      </div>
    </header>
    <nav className="audio-tabs" aria-label="Audio workspace">
      {([
        ["studio", "Voiceover Studio", AudioLines], ["library", "Voice library", AudioLines], ["bookmarks", "Bookmarks", Bookmark], ["speech", "Text to speech", FileAudio], ["voices", "My voices", Users], ["audio", "My audio", Headphones],
      ] as const).map(([value,label,Icon]) => <button key={value} type="button" className={cn("audio-tab", view === value && "is-active")} aria-current={view === value ? "page" : undefined} onClick={() => changeView(value)}><Icon size={16} />{label}</button>)}
    </nav>
    {error ? <p role="alert" className="audio-alert">{error}</p> : null}
    {savedSubmission ? <div className="audio-alert" role="status">
      <p>{recoveryBlocked ? "This audio request needs review; it will not be submitted again automatically." : `Saved request: ${savedSubmission.payload.name}. Resume uses its original script and voice, not your current form edits.`}</p>
      <div className="flex flex-wrap gap-3 mt-2"><button type="button" className="audio-text-button" disabled={!ready} onClick={() => void submitSpeech()}>Resume saved audio</button><button type="button" className="audio-text-button" disabled={posting} onClick={() => void refreshSavedSubmission()}>Refresh status</button></div>
    </div> : null}
    {bookmarks.error ? <p role="alert" className="audio-alert audio-bookmark-error">{bookmarks.error}<button type="button" className="audio-text-button" onClick={bookmarks.refresh}>Reload bookmarks</button></p> : null}

    {view === "studio" ? <div className="audio-studio">
      <div className="audio-section-heading"><div><h2>Recommended voices</h2><p>A small selection for your next post, ad or product video.</p></div><button type="button" className="audio-text-button" onClick={() => changeView("library")}>View all voices<ArrowRight size={15} /></button></div>
      <div className="audio-studio-purpose" role="group" aria-label="Studio content purpose">{AUDIO_CONTENT_PURPOSES.filter(item => item.id !== "storytelling").map(item => <button key={item.id} type="button" className={cn("audio-category", purpose === item.id && "is-active")} aria-pressed={purpose === item.id} onClick={() => changeCategory(item.id)}>{item.label}</button>)}</div>
      {loading ? <p role="status" className="audio-empty"><LoaderCircle size={18} className="animate-spin" />Loading recommended voices…</p> : studioVoices.length ? <VoiceList items={studioVoices} compact privateLibrary={false} voiceId={voiceId} playingId={playingId} posting={posting} playSample={playSample} selectVoice={selectVoice} {...bookmarkControls} onRemove={id => void removeAudio("voices", id)} /> : <div className="audio-empty"><AudioLines size={25} /><h3>No recommendations available</h3><p>Open the voice library to explore the available styles, or select a saved private voice in My voices.</p></div>}
      <div className="audio-studio-pager"><p className="audio-fine-print">{publicPreview ? "Real voice samples · Preview only" : "Play a sample, then select a voice for your script."}</p><div aria-label="Recommended voice pages"><span className="audio-fine-print" role="status">{studioPageCount ? currentStudioPage + 1 : 0} / {studioPageCount}</span><button type="button" className="audio-icon-button" aria-label="Previous recommended voices" disabled={!studioPageCount || currentStudioPage === 0} onClick={() => changeStudioPage(currentStudioPage - 1)}><ChevronLeft size={18} /></button><button type="button" className="audio-icon-button" aria-label="Next recommended voices" disabled={!studioPageCount || currentStudioPage >= studioPageCount - 1} onClick={() => changeStudioPage(currentStudioPage + 1)}><ChevronRight size={18} /></button></div></div>
    </div> : null}

    {view === "library" || view === "voices" ? <div className="audio-library">
      <div className="audio-library-toolbar">
        <div className="audio-search-field"><Search size={18} /><input type="search" aria-label="Search voices" value={query} onChange={e => setQuery(e.target.value)} placeholder={view === "voices" ? "Search your voices…" : "Search by name, accent or style…"} />{query ? <button type="button" className="audio-icon-button" aria-label="Clear voice search" onClick={() => setQuery("")}><X size={15} /></button> : null}</div>
        <details className="audio-filter-menu"><summary><SlidersHorizontal size={16} /><span>Filters</span>{gender !== "all" ? <span className="audio-filter-dot" /> : null}</summary><div className="audio-filter-popover"><label htmlFor="audio-gender">Voice type</label><select id="audio-gender" value={gender} onChange={e => setGender(e.target.value)}><option value="all">All voices</option><option value="female">Female</option><option value="male">Male</option><option value="non-binary">Non-binary</option></select></div></details>
        <label className="audio-sort-control" title="Sort voices"><ArrowDownAZ size={17} /><select aria-label="Sort voices" value={sort} onChange={e => setSort(e.target.value)}><option value="recommended">Recommended</option><option value="name">Name A–Z</option></select><ChevronDown size={13} /></label>
      </div>
      {view === "library" ? <div className="audio-category-bar" role="group" aria-label="Voice focus">
        <label className="audio-language-filter"><Languages size={16} /><select aria-label="Sample language" value={language} onChange={e => setLanguage(e.target.value)}><option value="all">All languages</option>{languages.map(item => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={13} /></label>
        <span className="audio-filter-divider" />
        {VOICE_CATEGORIES.map(({ id,label,icon: Icon }) => <button type="button" key={id} className={cn("audio-category", category === id && "is-active")} aria-pressed={category === id} onClick={() => changeCategory(id)}><Icon size={15} />{label}</button>)}
      </div> : <div className="audio-section-heading"><div><h2>Your private voices</h2><p>Create a voice once, then reuse it for any script.</p></div><button type="button" className="audio-primary" onClick={() => setShowVoiceForm(value => !value)}><Plus size={16} />Create voice</button></div>}

      {view === "voices" && showVoiceForm ? <div className="audio-reference-form">
        <div className="audio-section-heading"><div><h3>Create your voice</h3><p>A clean recording of one speaker, ideally 1–2 minutes.</p></div><button type="button" className="audio-icon-button" aria-label="Close voice creation" onClick={() => setShowVoiceForm(false)}><X size={18} /></button></div>
        {!data?.canClone ? <p className="audio-inline-note"><LockKeyhole size={14} />{upgradeRequired ? "Create a private voice with Starter or Growth. You can still explore voices and listen to samples." : "Private voice creation is not available on this account yet. You can still browse and preview voices."}</p> : null}
        <UploadControl disabled={posting || !data?.canUpload} label="Upload voice reference" onFile={file => void upload(file, "reference")} />
        <div className="audio-reference-fields"><div><label htmlFor="audio-reference">Reference recording</label><select id="audio-reference" className="audio-input" value={referenceId} onChange={e => setReferenceId(e.target.value)}><option value="">Choose a recording</option>{references.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div><div><label htmlFor="audio-voice-name">Voice name</label><input id="audio-voice-name" className="audio-input" value={voiceName} maxLength={100} onChange={e => setVoiceName(e.target.value)} placeholder="My narration voice" /></div></div>
        <label className="audio-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I own this voice or have permission to clone and use it.</label>
        <button type="button" className="audio-primary" disabled={!data?.canClone || !referenceId || !references.some(asset => asset.id === referenceId) || !voiceName.trim() || !consent || posting || activeRequests.some(r => r.kind === "clone")} onClick={() => void clone()}>{posting ? <LoaderCircle size={16} className="animate-spin" /> : <AudioLines size={16} />}Create private voice</button>
        <p className="audio-fine-print">MP3, WAV, M4A, OGG or WebM · Up to 3 MB and 3 minutes</p>
      </div> : null}

      {view === "library" ? <div className="audio-section-heading audio-library-heading"><div><h2>{filtered ? "Matching voices" : focusInfo.heading}</h2><p>{filtered ? `${voices.length} ${voices.length === 1 ? "voice" : "voices"} found` : focusInfo.description}</p></div><span className="audio-fine-print">{publicPreview ? "Public demos · Preview before connecting" : `${voices.length} ${voices.length === 1 ? "voice" : "voices"} in your library`}</span></div> : null}
      {loading ? <p role="status" className="audio-empty"><LoaderCircle size={18} className="animate-spin" />Loading voices…</p> : voices.length ? <>
        <VoiceList items={view === "library" && !filtered ? voices.slice(0,6) : voices} privateLibrary={view === "voices"} voiceId={voiceId} playingId={playingId} posting={posting} playSample={playSample} selectVoice={selectVoice} {...bookmarkControls} onRemove={id => void removeAudio("voices", id)} />
        {view === "library" && !filtered && voices.length > 6 ? <><div className="audio-section-heading audio-more-heading"><h2>More voices to explore</h2><span className="audio-fine-print">Listen to a sample, then choose your voice.</span></div><VoiceList items={voices.slice(6)} privateLibrary={false} voiceId={voiceId} playingId={playingId} posting={posting} playSample={playSample} selectVoice={selectVoice} {...bookmarkControls} onRemove={id => void removeAudio("voices", id)} /></> : null}
      </> : <div className="audio-empty"><AudioLines size={25} /><h3>{view === "voices" && !query ? "Make a voice your own" : "No voices found"}</h3><p>{view === "voices" && !query ? "Your private voices will appear here after creation. Your recordings stay private." : "Try another name, accent or style, or clear your filters."}</p>{filtered ? <button type="button" className="audio-text-button" onClick={clearFilters}>Clear filters</button> : null}</div>}
      {publicPreview ? <p className="audio-library-footnote"><Headphones size={14} />Listen to real ElevenLabs voice samples here. Generation uses the voices available on your connected account.</p> : null}
    </div> : null}

    {view === "bookmarks" ? <div className="audio-bookmarks">
      <div className="audio-section-heading"><div><h2>Bookmarked voices</h2><p>Your saved picks. Listen to a sample, then use it for your next voiceover.</p></div><button type="button" className="audio-text-button" onClick={() => changeView("library")}>Explore voices<ArrowRight size={15} /></button></div>
      {loading || bookmarks.loading ? <p role="status" className="audio-empty"><LoaderCircle size={18} className="animate-spin" />Loading bookmarked voices…</p> : bookmarkedVoices.length ? <VoiceList items={bookmarkedVoices} privateLibrary voiceId={voiceId} playingId={playingId} posting={posting} playSample={playSample} selectVoice={selectVoice} {...bookmarkControls} onRemove={id => void removeAudio("voices", id)} /> : <div className="audio-empty"><Bookmark size={27} /><h3>{bookmarks.ready ? "Keep your favorite voices here" : "Bookmarks are unavailable"}</h3><p>{bookmarks.ready ? "Tap the bookmark beside any voice to save it. Your script and selected voice stay as they are." : "Reload your bookmarks to try again. You can still explore voices and use text to speech."}</p><button type="button" className="audio-text-button" onClick={() => bookmarks.ready ? changeView("library") : bookmarks.refresh()}>{bookmarks.ready ? "Browse the voice library" : "Reload bookmarks"}<ArrowRight size={15} /></button></div>}
      {missingBookmarks.length ? <div className="audio-unavailable-bookmarks"><p className="audio-fine-print">Some saved voices are no longer in your current library. They stay bookmarked in case they become available again.</p>{missingBookmarks.map((id, index) => <div key={id}><span className="audio-fine-print">Unavailable saved voice</span><button type="button" className="audio-text-button" disabled={bookmarks.pendingIds.has(id)} aria-label={`Remove unavailable saved voice ${index + 1} bookmark`} onClick={() => void bookmarks.toggle(id)}>Remove bookmark</button></div>)}</div> : null}
    </div> : null}

    {view === "studio" || view === "speech" ? <AudioSpeechEditor
      layout={view === "studio" ? "studio" : "standalone"} voice={chosenVoice}
      name={name} script={script} placeholder={purposeInfo.placeholder} scriptRef={scriptInput}
      models={data?.models ?? []} modelId={modelId} speed={speed}
      estimatedDuration={estimatedSeconds ? formatDuration(estimatedSeconds) : null}
      creditCostPer1000={data?.creditCostPer1000 ?? 0} availabilityMessage={availabilityMessage}
      freeTest={Boolean(data?.account && !data.account.paid)} upgradeRequired={upgradeRequired} ready={ready && !savedSubmission} posting={posting} generating={Boolean(activeSpeech)}
      onName={setName} onScript={setScript} onModel={setModelId} onSpeed={setSpeed}
      onExample={insertExample} onBrowseVoices={() => changeView("library")} onGenerate={() => void submitSpeech()}
    /> : null}

    {view === "audio" ? <div className="audio-saved-library"><div className="audio-section-heading"><div><h2>My audio</h2><p>Your voiceovers, references and original recordings.</p></div><UploadControl disabled={posting || !data?.canUpload} label="Upload recording" onFile={file => void upload(file,"exact")} /></div>
      {data?.assets.length ? <div className="audio-recordings">{data.assets.map(asset => <div className="audio-recording-row" key={asset.id}><FileAudio size={20} /><button type="button" className="audio-recording-name" disabled={asset.status !== "ready"} onClick={() => chooseAsset(asset)}><strong>{asset.name}</strong><span>{asset.status === "processing" ? "Checking recording…" : asset.status === "failed" ? "Recording could not be validated" : asset.purpose === "reference" ? "Voice reference" : asset.purpose === "exact" ? "Original recording" : "Generated voiceover"}{asset.testOnly ? " · Free test" : ""}</span></button><span className="audio-recording-duration">{asset.duration ? formatDuration(asset.duration) : "—"}</span><button type="button" className="audio-icon-button" disabled={asset.status !== "ready"} aria-label={`Open ${asset.name} recording`} onClick={() => chooseAsset(asset)}><Play size={16} /></button><button type="button" className="audio-icon-button" disabled={posting || asset.status === "processing"} aria-label={`Remove ${asset.name} recording`} onClick={() => void removeAudio("assets",asset.id)}><Trash2 size={15} /></button></div>)}</div> : <div className="audio-empty"><Headphones size={28} /><h3>Your next voiceover starts here</h3><p>Generate speech or upload a recording. Your saved audio stays here when you leave this screen.</p><button type="button" className="audio-text-button" onClick={() => changeView("library")}>Explore voices<ArrowRight size={15} /></button></div>}
      <p className="audio-fine-print audio-recordings-note">Uploaded recordings keep their original words and delivery. Uploading uses no speech generation allowance.</p>
    </div> : null}

    {(view === "audio" || view === "voices") && pendingCleanup.length ? <div className="audio-pending-removals">{pendingCleanup.map(item => <div key={item.id}><span>{item.name}<small>Removal pending</small></span><button type="button" className="audio-text-button" disabled={posting} onClick={() => void removeAudio(item.kind === "asset" ? "assets" : "voices",item.id)}>Retry removal</button></div>)}</div> : null}
    {view === "speech" || selected || liveId || activeSpeech ? <div className="audio-preview-section"><AudioPlayer key={selected?.generationId || selected?.id || liveId || activeSpeech?.id || "empty"} asset={selected} liveRequestId={liveId || activeSpeech?.id || null} userId={uid} removing={posting} onRemove={id => void removeAudio("assets",id)} /></div> : null}
    {needsAttention.length ? <div className="audio-activity"><h3>Activity</h3>{needsAttention.slice(0,8).map(request => <div className="audio-activity-row" key={request.id}><span><strong>{request.name}</strong><small>{request.voiceStatus === "verification_required" ? "Verify this voice in ElevenLabs before generating" : request.status === "uncertain" ? "Needs review · No automatic retry" : request.status === "queued" ? "Queued" : displayLabel(request.status)}{request.error ? ` · ${request.error}` : ""}</small></span>{request.voiceStatus === "verification_required" && request.voiceProfileId ? <button type="button" className="audio-text-button" disabled={posting} onClick={() => void removeAudio("voices",request.voiceProfileId!)}>Remove voice</button> : null}</div>)}</div> : null}
  </section>;
}

function VoiceList({ items, voiceId, playingId, privateLibrary, posting, playSample, selectVoice, onRemove, bookmarkIds, bookmarkPendingIds, bookmarksReady, onBookmark, compact = false }: {
  items: AudioVoice[]; voiceId: string; playingId: string | null;
  privateLibrary: boolean; posting: boolean; playSample: (voice: AudioVoice) => void;
  selectVoice: (voice: AudioVoice) => void; onRemove: (id: string) => void;
  bookmarkIds: ReadonlySet<string>; bookmarkPendingIds: ReadonlySet<string>; bookmarksReady: boolean; onBookmark: (id: string) => void;
  compact?: boolean;
}) {
    return <div className="audio-voice-grid">{items.map(voice => <article key={voice.id} className={cn("audio-voice-row", voice.id === voiceId && "is-selected")}>
      <button className="audio-preview-orb" type="button" disabled={!voice.previewUrl} aria-label={`${playingId === voice.id ? "Pause" : "Play"} ${voice.name} voice sample`} aria-pressed={playingId === voice.id} onClick={() => playSample(voice)}>
        <VoiceOrb id={voice.id} />
        <span className="audio-orb-control">{playingId === voice.id ? <Pause size={15} fill="currentColor" /> : voice.previewUrl ? <Play size={15} fill="currentColor" /> : <AudioLines size={17} />}</span>
      </button>
      <button className="audio-voice-copy" type="button" aria-label={`Use ${voice.name} voice`} aria-pressed={voice.id === voiceId} onClick={() => selectVoice(voice)}>
        <span className="audio-voice-title" title={voice.name}>{compact ? voice.name.split(" - ")[0] : voice.name}</span>
        <span className="audio-voice-description" title={voice.description}>{compact ? voice.name.split(" - ")[1] || voice.description || "Speech voice" : voice.description || (voice.private ? "Your private voice" : "Speech voice")}</span>
        <span className="audio-voice-meta">{(compact ? [voice.labels.accent, !voice.available ? "Preview only" : null] : [voice.labels.accent, voice.labels.gender, voice.private ? "Private voice" : voiceLanguage(voice), !voice.available ? "Preview only" : null]).filter(Boolean).map((label,index) => <span key={`${label}-${index}`} className={label === "Preview only" ? "audio-voice-preview-only" : undefined}>{displayLabel(label!)}</span>)}</span>
      </button>
      <div className="audio-voice-actions">
        <button type="button" className={cn("audio-use-voice", voice.id === voiceId && "is-active")} aria-label={`Use It: ${voice.name}`} aria-pressed={voice.id === voiceId} onClick={() => selectVoice(voice)}>Use It{voice.id === voiceId ? <Check size={15} /> : <ArrowRight size={15} />}</button>
        <button type="button" className={cn("audio-icon-button audio-bookmark-voice", bookmarkIds.has(voice.id) && "is-active")} disabled={!bookmarksReady || bookmarkPendingIds.has(voice.id)} aria-label={`${bookmarkIds.has(voice.id) ? "Remove bookmark for" : "Bookmark"} ${voice.name}`} title={bookmarkIds.has(voice.id) ? "Remove bookmark" : "Bookmark voice"} aria-pressed={bookmarkIds.has(voice.id)} onClick={() => onBookmark(voice.id)}>{bookmarkPendingIds.has(voice.id) ? <LoaderCircle size={16} className="animate-spin" /> : <Bookmark size={16} fill={bookmarkIds.has(voice.id) ? "currentColor" : "none"} />}</button>
        {voice.profileId && privateLibrary ? <button type="button" className="audio-icon-button" disabled={posting} aria-label={`Remove ${voice.name} private voice`} onClick={() => onRemove(voice.profileId!)}><Trash2 size={15} /></button> : null}
      </div>
    </article>)}</div>;
}
const VOICE_CATEGORIES = [
  { id: "social", label: "Social media", icon: Users, heading: "Social media picks", description: "Start with voices for Reels, Shorts and social posts. Explore the full library below." },
  { id: "ugc_ad", label: "UGC ads", icon: Megaphone, heading: "Voices for UGC ads", description: "Advertising and conversational voices first. Explore every other style below." },
  { id: "product_demo", label: "Product demos", icon: MonitorPlay, heading: "Voices for product demos", description: "Clear, informative voices for product walkthroughs. The full library stays below." },
  { id: "all", label: "All voices", icon: AudioLines, heading: "Featured voices", description: "Voices for social posts, ads, demos and every kind of story." },
  { id: "conversational", label: "Conversational", icon: MessageCircle, heading: "Conversational voices", description: "Natural, conversational delivery first. Browse the other styles below." },
  { id: "storytelling", label: "Narration", icon: BookOpen, heading: "Narration voices", description: "Storytelling voices first. Browse the other styles below." },
  { id: "advertisement", label: "Advertisement", icon: Megaphone, heading: "Advertising voices", description: "Promotional voices first. Browse the other styles below." },
  { id: "characters", label: "Characters", icon: Sparkles, heading: "Character voices", description: "Expressive character voices first. Browse the other styles below." },
] as const satisfies ReadonlyArray<{ id: VoiceLibraryFocus; label: string; icon: typeof AudioLines; heading: string; description: string }>;
function displayLabel(value: string) { return value.replace(/_/g," ").replace(/\b\w/g,letter => letter.toUpperCase()); }
function voiceLanguage(voice: AudioVoice) {
  const language = voice.labels.language?.toLowerCase(); if (!language) return "";
  const names: Record<string,string> = { en: "English", hi: "Hindi", es: "Spanish", fr: "French", de: "German", ar: "Arabic", pt: "Portuguese", ja: "Japanese", zh: "Chinese", ko: "Korean", it: "Italian" };
  return names[language] || displayLabel(language);
}
function formatDuration(seconds: number) { const total = Math.round(seconds); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2,"0")}`; }
function UploadControl({ disabled, label, onFile }: { disabled: boolean; label: string; onFile: (file: File) => void }) {
  return <label className={cn("audio-upload",disabled && "is-disabled")}><Upload size={16} />{label}<input type="file" className="sr-only" aria-label={label} accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,audio/webm" disabled={disabled} onChange={event => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ""; }} /></label>;
}
