"use client";

import { SlidersHorizontal, RotateCcw, Circle, Square, Play, Pause } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { DemoFramingRecording } from "@/components/explore/demo-framing-recording";
import { demoFramingPosition, type DemoFraming } from "@/worker/src/lib/explore-finishing-contract";

export function WorkflowDemoControls({ asset, value, onChange, outputAspect, disabled = false, onOpen }: {
  asset: LocalWorkflowMedia; value: DemoFraming | null; onChange: (value: DemoFraming | null) => void; outputAspect: number; disabled?: boolean; onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
    <Dialog open={open} onOpenChange={next => { if (next) onOpen?.(); setOpen(next); }}>
      <DialogTrigger render={<Button type="button" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs" disabled={disabled} />}>
        <SlidersHorizontal className="size-3.5" aria-hidden="true" />Adjust crop &amp; pan{value ? <><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" /><span className="sr-only">, framing applied</span></> : null}
      </DialogTrigger>
      {open ? <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogTitle>Adjust crop &amp; pan</DialogTitle>
        <DialogDescription>Choose what viewers see. Record your movement to pan smoothly across the demo.</DialogDescription>
        <DemoFramingEditor asset={asset} value={value} outputAspect={outputAspect} onSave={next => { onChange(next); setOpen(false); }} onCancel={() => setOpen(false)} />
      </DialogContent> : null}
    </Dialog>
    {value ? <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={() => onChange(null)} aria-label="Reset demo framing" title="Reset framing"><RotateCcw className="size-3.5" aria-hidden="true" /></Button> : null}
  </div>;
}

export function DemoFramingEditor({ asset, value, outputAspect, onSave, onCancel }: {
  asset: LocalWorkflowMedia; value: DemoFraming | null; outputAspect: number; onSave: (value: DemoFraming) => void; onCancel: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null), canvas = useRef<HTMLCanvasElement>(null), selection = useRef<HTMLButtonElement>(null);
  const clock = useRef<HTMLSpanElement>(null), animation = useRef(0), mounted = useRef(true);
  const activeFrame = useRef<DemoFraming | null>(null), position = useRef({ x: 0, y: 0 });
  const recorder = useRef<DemoFramingRecording | null>(null), lastSample = useRef(-1);
  const playbackMode = useRef<"position" | "record" | "review">("position");
  const playbackEpoch = useRef(0);
  const drag = useRef<{ id: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const [frame, setFrame] = useState<DemoFraming | null>(null), [mode, setMode] = useState<"position" | "record" | "review">("position");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [visiblePosition, setVisiblePosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1), [error, setError] = useState<string | null>(null), [ready, setReady] = useState(false);
  const bindVideo = useCallback((player: HTMLVideoElement | null) => {
    video.current = player;
    if (!player) return;
    if (player.getAttribute("src") !== asset.url) player.setAttribute("src", asset.url);
    return () => { playbackEpoch.current++; recorder.current = null; cancelAnimationFrame(animation.current); player.pause(); player.removeAttribute("src"); player.load(); video.current = null; };
  }, [asset.url]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; recorder.current = null; cancelAnimationFrame(animation.current); };
  }, []);

  function draw() {
    const player = video.current, target = canvas.current, current = activeFrame.current;
    if (!player || !target || !current || !player.videoWidth || player.readyState < 2) return;
    if (playbackMode.current === "review") {
      position.current = demoFramingPosition(current, player.currentTime * 1000);
      const next = position.current;
      setVisiblePosition(prior => prior.x === next.x && prior.y === next.y ? prior : next);
    }
    const { x, y } = position.current;
    if (selection.current) { selection.current.style.left = `${x * 100}%`; selection.current.style.top = `${y * 100}%`; }
    if (clock.current) clock.current.textContent = `${player.currentTime.toFixed(1)} / ${player.duration.toFixed(1)} s`;
    target.getContext("2d")?.drawImage(player, x * player.videoWidth, y * player.videoHeight, current.width * player.videoWidth, current.height * player.videoHeight, 0, 0, target.width, target.height);
  }
  function changeMode(next: typeof mode) { playbackEpoch.current++; playbackMode.current = next; setMode(next); }
  function fail(message: string) {
    recorder.current = null; video.current?.pause(); changeMode("position"); setError(message);
  }
  function finishRecording() {
    const recording = recorder.current, player = video.current;
    if (!recording || !player) return;
    recorder.current = null;
    try {
      recording.sample(player.currentTime * 1000, position.current.x, position.current.y);
      const next = recording.finish(Math.round(player.duration * 1000));
      activeFrame.current = next; setFrame(next); changeMode("review"); setError(null);
    } catch (e) { fail(e instanceof Error ? e.message : "Could not save this movement. Record it again."); }
    player.pause(); draw();
  }
  function tick() {
    if (!mounted.current) return;
    const player = video.current;
    if (!player) return;
    if (recorder.current && player.currentTime * 1000 - lastSample.current >= 32) {
      try { recorder.current.sample(player.currentTime * 1000, position.current.x, position.current.y); lastSample.current = player.currentTime * 1000; }
      catch (e) { fail(e instanceof Error ? e.message : "Could not record this movement."); }
    }
    draw();
    if (!player.paused && !player.ended) animation.current = requestAnimationFrame(tick);
  }
  function metadata() {
    const player = video.current;
    if (!player || !Number.isFinite(player.duration) || player.duration <= 0 || player.duration > 120 ||
        ![player.videoWidth, player.videoHeight].every(dimension => dimension >= 64 && dimension <= 4096)) {
      setReady(false); setError("Choose a playable demo up to 120 seconds long, with each side between 64 and 4096 pixels."); return;
    }
    const ratio = player.videoWidth / player.videoHeight, aspect = Number.isFinite(outputAspect) && outputAspect > 0 ? outputAspect : 9 / 16;
    const width = Math.min(1, aspect / ratio), height = Math.min(1, ratio / aspect);
    const compatible = value && Math.abs(value.width * ratio / value.height / aspect - 1) < .015;
    const next: DemoFraming = compatible ? value : { version: 1, width, height, points: [[0, (1 - width) / 2, (1 - height) / 2]] };
    activeFrame.current = next; position.current = demoFramingPosition(next, 0); setVisiblePosition(position.current); setFrame(next); setDimensions({ width: player.videoWidth, height: player.videoHeight });
    if (compatible) { setZoom(width / next.width); changeMode("review"); }
    if (canvas.current) { canvas.current.width = Math.round(Math.min(320, 320 * aspect)); canvas.current.height = Math.round(canvas.current.width / aspect); }
    draw();
  }
  function move(x: number, y: number) {
    const current = activeFrame.current;
    if (!current || playbackMode.current === "review") return;
    position.current = { x: Math.max(0, Math.min(1 - current.width, x)), y: Math.max(0, Math.min(1 - current.height, y)) };
    setVisiblePosition(position.current);
    if (playbackMode.current === "position") {
      const next: DemoFraming = { ...current, points: [[0, position.current.x, position.current.y]] };
      activeFrame.current = next; setFrame(next);
    } else if (recorder.current && video.current) {
      try { recorder.current.sample(video.current.currentTime * 1000, position.current.x, position.current.y); }
      catch (e) { fail(e instanceof Error ? e.message : "Could not record this movement."); }
    }
    draw();
  }
  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!ready || playbackMode.current === "review" || !event.isPrimary || event.button !== 0) return;
    event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: position.current.x, startY: position.current.y };
    if (recorder.current && video.current) {
      try { recorder.current.sample(video.current.currentTime * 1000, position.current.x, position.current.y); }
      catch (e) { fail(e instanceof Error ? e.message : "Could not record this movement."); }
    }
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current, bounds = video.current?.getBoundingClientRect();
    if (!start || start.id !== event.pointerId || !bounds?.width || !bounds.height) return;
    move(start.startX + (event.clientX - start.x) / bounds.width, start.startY + (event.clientY - start.y) / bounds.height);
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (playbackMode.current === "review") return;
    const step = event.shiftKey ? .02 : .005;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return; event.preventDefault(); move(position.current.x + delta[0], position.current.y + delta[1]);
  }
  function resize(nextZoom: number) {
    const player = video.current, current = activeFrame.current;
    if (!player || !current) return;
    player.pause();
    const ratio = player.videoWidth / player.videoHeight;
    const width = Math.min(1, outputAspect / ratio) / nextZoom, height = Math.min(1, ratio / outputAspect) / nextZoom;
    const x = Math.max(0, Math.min(1 - width, position.current.x + (current.width - width) / 2));
    const y = Math.max(0, Math.min(1 - height, position.current.y + (current.height - height) / 2));
    const next: DemoFraming = { version: 1, width, height, points: [[0, x, y]] };
    activeFrame.current = next; position.current = { x, y }; setVisiblePosition({ x, y }); setFrame(next); setZoom(nextZoom); setError(null); changeMode("position"); draw();
  }
  async function record() {
    const player = video.current, current = activeFrame.current;
    if (!player || !current) return;
    player.pause(); player.currentTime = 0; setError(null);
    const start = demoFramingPosition(current, 0); position.current = start; setVisiblePosition(start);
    const next: DemoFraming = { ...current, points: [[0, start.x, start.y]] };
    activeFrame.current = next; setFrame(next); recorder.current = new DemoFramingRecording(next); lastSample.current = -1; changeMode("record");
    const epoch = playbackEpoch.current;
    try { await player.play(); } catch { if (mounted.current && epoch === playbackEpoch.current) fail("Playback could not start. Try recording again."); }
  }
  async function review() {
    const player = video.current;
    if (!player || !frame) return;
    player.pause(); changeMode("review"); player.currentTime = 0; setError(null); draw();
    const epoch = playbackEpoch.current;
    try { await player.play(); } catch { if (mounted.current && epoch === playbackEpoch.current) setError("Playback could not start. Try reviewing again."); }
  }
  function positionAgain() {
    video.current?.pause(); changeMode("position"); setError(null);
    if (activeFrame.current) {
      const current = activeFrame.current;
      const next: DemoFraming = { ...current, points: [[0, position.current.x, position.current.y]] };
      activeFrame.current = next; setFrame(next); draw();
    }
  }
  const tooSmall = frame && (frame.width * dimensions.width < 64 || frame.height * dimensions.height < 64);
  return <div className="grid gap-4">
    <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0"><p className="mb-2 text-xs font-medium">Demo recording</p>
        <div className="relative mx-auto overflow-hidden rounded-lg bg-black" style={dimensions.width ? { width: `min(100%, calc(42dvh * ${dimensions.width / dimensions.height}))`, aspectRatio: dimensions.width / dimensions.height } : undefined}>
          <video ref={bindVideo} src={asset.url} playsInline preload="auto" aria-label="Demo framing source" className="block h-auto w-full" onLoadedMetadata={metadata} onLoadedData={() => { setReady(!!activeFrame.current); draw(); }}
            onPlay={() => { cancelAnimationFrame(animation.current); animation.current = requestAnimationFrame(tick); }}
            onPause={() => { if (!video.current?.paused) return; cancelAnimationFrame(animation.current); if (mounted.current && recorder.current) finishRecording(); }} onEnded={finishRecording} onSeeked={draw}
            onError={() => fail("This demo could not be played. Close the editor and choose it again.")} />
          {frame && ready ? <button ref={selection} type="button" aria-label="Move visible demo frame" aria-describedby="demo-frame-instructions" disabled={mode === "review"}
            className="absolute touch-none cursor-grab border-2 border-primary bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-focus active:cursor-grabbing disabled:cursor-default"
            style={{ left: `${visiblePosition.x * 100}%`, top: `${visiblePosition.y * 100}%`, width: `${frame.width * 100}%`, height: `${frame.height * 100}%` }}
            onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={keyboard} /> : null}
        </div>
      </div>
      <div className="min-w-0"><p className="mb-2 text-xs font-medium">What viewers see</p><canvas ref={canvas} aria-label="Live cropped demo preview" className="mx-auto h-auto max-w-full rounded-lg bg-black" style={{ width: `min(100%, calc(42dvh * ${outputAspect}))`, aspectRatio: outputAspect }} /></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><p id="demo-frame-instructions">{mode === "record" ? "Recording. Drag the frame or use arrow keys while the demo plays." : mode === "review" ? "Review the saved movement. Repositioning starts a new path." : "Position the frame with dragging or arrow keys, then record movement."}</p><span ref={clock} className="tabular-nums">0.0 s</span></div>
    <label className="flex items-center gap-3 text-xs">Zoom<span className="tabular-nums">{zoom.toFixed(1)}×</span><input type="range" min="1" max="4" step="0.1" value={zoom} disabled={!ready || mode === "record"} onChange={event => resize(Number(event.target.value))} className="min-w-0 flex-1 accent-accent" /></label>
    {error || tooSmall ? <p role="alert" className="text-sm text-destructive">{error ?? (zoom <= 1 ? "This demo is too small for this video shape. Use a larger demo or keep its original frame." : "Zoom out: the selected area must be at least 64 pixels wide and high.")}</p> : null}
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Demo movement recording">
      {mode === "record" ? <Button type="button" variant="outline" onClick={finishRecording}><Square className="size-3.5" aria-hidden="true" />Stop recording</Button>
        : <Button type="button" variant="outline" disabled={!ready || !!tooSmall} onClick={() => void record()}><Circle className="size-3.5" aria-hidden="true" />{frame && frame.points.length > 1 ? "Record again" : "Record movement"}</Button>}
      <Button type="button" variant="ghost" disabled={!ready || mode === "record"} onClick={() => void review()}><Play className="size-3.5" aria-hidden="true" />Review</Button>
      {mode === "review" ? <Button type="button" variant="ghost" onClick={positionAgain}>Reposition frame</Button> : null}
      <span role="status" className="text-xs text-muted">{mode === "record" ? "Recording movement…" : frame && frame.points.length > 1 ? "Movement ready to review" : "Fixed frame"}</span>
    </div>
    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
      <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button type="button" disabled={!ready || !frame || mode === "record" || !!error || !!tooSmall} onClick={() => { if (frame) onSave(frame); }}>Save framing</Button>
    </div>
  </div>;
}

/** Replays the same saved path in the sequence preview, with its original sound. */
export function WorkflowDemoPreview({ asset, framing }: { asset: LocalWorkflowMedia; framing: DemoFraming }) {
  const video = useRef<HTMLVideoElement | null>(null), canvas = useRef<HTMLCanvasElement>(null), animation = useRef(0), alive = useRef(true);
  const playbackEpoch = useRef(0);
  const [playing, setPlaying] = useState(false), [time, setTime] = useState(0), [duration, setDuration] = useState(0), [aspect, setAspect] = useState(9 / 16), [error, setError] = useState<string | null>(null);
  const bind = useCallback((player: HTMLVideoElement | null) => {
    video.current = player;
    if (!player) return;
    if (player.getAttribute("src") !== asset.url) player.setAttribute("src", asset.url);
    return () => { playbackEpoch.current++; cancelAnimationFrame(animation.current); player.pause(); player.removeAttribute("src"); player.load(); video.current = null; };
  }, [asset.url]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; cancelAnimationFrame(animation.current); }; }, []);
  function draw() {
    const player = video.current, target = canvas.current;
    if (!alive.current || !player || !target || player.readyState < 2) return;
    const point = demoFramingPosition(framing, player.currentTime * 1000);
    target.getContext("2d")?.drawImage(player, point.x * player.videoWidth, point.y * player.videoHeight, framing.width * player.videoWidth, framing.height * player.videoHeight, 0, 0, target.width, target.height);
    setTime(player.currentTime);
  }
  function tick() { draw(); if (video.current && !video.current.paused && !video.current.ended) animation.current = requestAnimationFrame(tick); }
  async function toggle() {
    const player = video.current;
    if (!player) return;
    if (!player.paused) { player.pause(); return; }
    if (player.ended) player.currentTime = 0;
    const epoch = ++playbackEpoch.current;
    try { await player.play(); } catch { if (alive.current && epoch === playbackEpoch.current) setError("The preview could not start. Try playing it again."); }
  }
  return <div className="grid min-w-0 gap-2">
    <video ref={bind} src={asset.url} playsInline preload="auto" className="sr-only" aria-label="Cropped demo playback source" onLoadedMetadata={() => {
      const player = video.current;
      if (!player || !canvas.current) return;
      const ratio = player.videoWidth * framing.width / (player.videoHeight * framing.height);
      setAspect(ratio); setDuration(player.duration); canvas.current.width = 320; canvas.current.height = Math.round(320 / ratio);
    }} onLoadedData={draw} onPlay={() => { setPlaying(true); cancelAnimationFrame(animation.current); animation.current = requestAnimationFrame(tick); }}
      onPause={() => { if (!video.current?.paused) return; playbackEpoch.current++; setPlaying(false); cancelAnimationFrame(animation.current); }} onEnded={() => { playbackEpoch.current++; setPlaying(false); draw(); }} onSeeked={draw} onError={() => setError("This demo preview could not be played. Choose the demo again.")} />
    <canvas ref={canvas} aria-label="Demo preview with recorded framing" className="mx-auto h-auto w-full max-w-full rounded-lg bg-black" style={{ aspectRatio: aspect }} />
    <div className="flex items-center gap-2"><Button type="button" variant="ghost" size="icon-sm" aria-label={playing ? "Pause framed demo" : "Play framed demo"} onClick={() => void toggle()}>{playing ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}</Button>
      <input type="range" aria-label="Framed demo playback position" min="0" max={duration || 1} step="0.1" value={time} disabled={!duration} className="min-w-0 flex-1 accent-accent" onChange={event => { if (video.current) { video.current.currentTime = Number(event.target.value); setTime(Number(event.target.value)); } }} />
      <span className="text-xs tabular-nums text-muted">{Math.floor(time)}s</span></div>
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
  </div>;
}
