"use strict";
const $ = id => document.getElementById(id);
const labels = { clean: "Clean", "bold-box": "Bold box", "active-word": "Word highlight" };
const stages = { uploading: "Uploading your video", checking_video: "Checking your video", preparing_audio: "Preparing the audio", transcribing: "Listening to your video", aligning_words: "Placing each word", rendering_video: "Creating your captioned video", completed: "Subtitles generated", cancelling: "Stopping generation" };
let file, originalUrl, result, busy = false, currentJob, pollTimer, config, loadingFile = false;
const video = $("video"), dialog = $("style-dialog");

function showError(message) { $("error").textContent = message; $("error").hidden = !message; }
function setBusy(value) {
  busy = value;
  for (const id of ["file", "sample", "placement", "generate"]) $(id).disabled = value;
  document.querySelectorAll('input[name="style"]').forEach(input => { input.disabled = value; });
  $("upload-zone").classList.toggle("disabled", value);
  $("open-styles").disabled = value || !file || loadingFile || !config?.liveTranscriptionConfigured;
  $("progress-card").hidden = !value;
  $("dialog-progress").hidden = !value;
  $("dialog-cancel").textContent = value ? "Stop generation" : "Cancel";
  $("generate").textContent = value ? "Generating…" : "Generate subtitles →";
}
function setStage(stage) { const label = stages[stage] ?? "Generating subtitles"; $("stage").textContent = label; $("dialog-stage").textContent = label; }

async function selectFile(selected) {
  if (busy || !selected) return;
  if (!config) { showError("The local generator is still loading. Try choosing the video again."); return; }
  showError("");
  if (!selected.size || selected.size > config.maxBytes) { showError("Choose a video smaller than 50 MB."); return; }
  loadingFile = true; setBusy(false);
  if (originalUrl) URL.revokeObjectURL(originalUrl);
  file = selected; result = undefined;
  originalUrl = URL.createObjectURL(selected);
  $("file-name").textContent = selected.name;
  $("duration").textContent = "";
  $("empty-preview").hidden = true; video.hidden = false; video.src = originalUrl;
  $("result").hidden = true; $("view-switch").hidden = true;
  $("preview-label").textContent = "Your video";
  video.onloadedmetadata = () => {
    loadingFile = false;
    $("duration").textContent = `${video.duration.toFixed(1)} s`;
    if (!Number.isFinite(video.duration) || video.duration > config.maxDurationMs / 1000) {
      file = undefined; showError("This pilot supports videos up to 30 seconds. Choose a shorter clip.");
    }
    setBusy(false);
  };
  video.onerror = () => { loadingFile = false; file = undefined; setBusy(false); showError("This video could not be previewed. Try an MP4, MOV or WebM file."); };
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...(options.headers ?? {}), ...(options.method === "POST" ? { "X-Subtitle-Pilot": "1" } : {}) } });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error?.message ?? "The local request failed.");
  return value;
}

function switchPreview(captioned) {
  const position = video.currentTime;
  video.pause(); video.onloadedmetadata = null; video.onerror = null;
  video.src = captioned ? result.result.preview : originalUrl;
  video.addEventListener("loadedmetadata", () => { video.currentTime = Math.min(position, Math.max(0, video.duration - 0.1)); }, { once: true });
  $("view-original").setAttribute("aria-pressed", String(!captioned)); $("view-captions").setAttribute("aria-pressed", String(captioned));
  $("preview-label").textContent = captioned ? labels[result.style] : "Original video";
}

function finish(job) {
  clearTimeout(pollTimer); setBusy(false); currentJob = undefined;
  if (job.state === "completed") {
    result = job; dialog.close();
    $("result").hidden = false;
    $("result-details").textContent = `${labels[job.style]} · ${job.placement === "top" ? "Top" : "Bottom"} · ${job.result.wordCount} words`;
    $("download").href = job.result.download; $("srt").href = job.result.srt; $("vtt").href = job.result.vtt;
    $("view-switch").hidden = false; $("view-original").disabled = !originalUrl;
    $("empty-preview").hidden = true; video.hidden = false;
    switchPreview(true); showError("");
  } else {
    dialog.close();
    showError(job.state === "cancelled" ? "Generation stopped. Your original video is still available. A transcription already submitted may still be charged." : job.error?.message ?? "Subtitles could not be generated. Your original video is still available.");
  }
}

async function poll() {
  if (!currentJob) return;
  try {
    const job = await api(`/api/jobs/${currentJob}`);
    if (["completed", "failed", "cancelled"].includes(job.state)) { finish(job); return; }
    setStage(job.state === "cancelling" ? "cancelling" : job.stage);
    pollTimer = setTimeout(poll, 1200);
  } catch (error) {
    // A polling error does not resubmit the audio or mark the job as completed.
    showError(`${error.message} Checking the existing request again…`);
    pollTimer = setTimeout(poll, 2500);
  }
}

async function stop() {
  if (!currentJob) { dialog.close(); return; }
  try { await api(`/api/jobs/${currentJob}/cancel`, { method: "POST" }); setStage("cancelling"); }
  catch (error) { showError(error.message); }
}

$("file").addEventListener("change", () => { void selectFile($("file").files[0]); });
$("sample").addEventListener("click", async () => {
  $("sample").disabled = true;
  try {
    const response = await fetch("/api/sample");
    if (!response.ok) throw new Error("The local sample is unavailable. Choose a video instead.");
    await selectFile(new File([await response.blob()], "Verified SaaS sample.mp4", { type: "video/mp4" }));
  } catch (error) { showError(error.message); }
  finally { $("sample").disabled = busy; }
});
$("drop-target").addEventListener("dragover", event => { event.preventDefault(); if (!busy) $("drop-target").classList.add("drag-over"); });
$("drop-target").addEventListener("dragleave", () => $("drop-target").classList.remove("drag-over"));
$("drop-target").addEventListener("drop", event => { event.preventDefault(); $("drop-target").classList.remove("drag-over"); if (!busy) void selectFile(event.dataTransfer.files[0]); });
$("open-styles").addEventListener("click", () => { if (!busy && file) dialog.showModal(); });
$("close-dialog").addEventListener("click", () => dialog.close());
$("dialog-cancel").addEventListener("click", () => { if (busy) void stop(); else dialog.close(); });
$("cancel-page").addEventListener("click", () => { void stop(); });
$("view-original").addEventListener("click", () => switchPreview(false));
$("view-captions").addEventListener("click", () => switchPreview(true));
$("generate-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy || !file || loadingFile) return;
  showError(""); setBusy(true); setStage("uploading");
  const style = document.querySelector('input[name="style"]:checked').value, placement = $("placement").value;
  const id = crypto.randomUUID();
  currentJob = id;
  try {
    const job = await api(`/api/jobs?style=${encodeURIComponent(style)}&placement=${encodeURIComponent(placement)}`, {
      method: "POST", body: file, headers: { "Content-Type": "application/octet-stream", "X-Request-Id": id } });
    if (["completed", "failed", "cancelled"].includes(job.state)) finish(job);
    else { setStage(job.stage); void poll(); }
  } catch (error) {
    // The upload response can be lost after acceptance. Inspect this request ID
    // before enabling another generation; never silently submit another job.
    try {
      const job = await api(`/api/jobs/${id}`);
      if (["completed", "failed", "cancelled"].includes(job.state)) finish(job);
      else void poll();
    } catch { currentJob = undefined; setBusy(false); dialog.close(); showError(error.message); }
  }
});

void (async () => {
  try {
    config = await api("/api/config");
    $("sample").hidden = !config.sampleAvailable;
    if (!config.liveTranscriptionConfigured) {
      $("configuration").hidden = false;
      $("configuration").textContent = "Generation needs OPENAI_API_KEY in the local server environment. Keep the key out of this page.";
    }
    if (config.activeJob) { currentJob = config.activeJob.id; setBusy(true); setStage(config.activeJob.stage); void poll(); }
    else setBusy(false);
  } catch (error) { showError(error.message); }
})();
