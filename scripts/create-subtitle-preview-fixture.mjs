// Optional authoring tool. Offline eSpeak is isolated in .tmp; no app runtime
// dependency, provider, credentials or user media. Frozen outputs are reviewed.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";

const root = resolve("scripts/fixtures/subtitle-preview");
await mkdir(root, { recursive: true });
const modulePath = resolve(process.argv[2] ?? ".tmp/subtitle-preview-tools/node_modules/@echogarden/espeak-ng-emscripten/espeak-ng.js");
const { default: initialize } = await import(pathToFileURL(modulePath).href);
const espeakModule = await initialize(), voice = new espeakModule.eSpeakNGWorker();
voice.set_voice("en-us"); voice.set_rate(180); voice.set_pitch(50); voice.set_range(50);
const labels = "Make every word count. Keep your captions beautifully clear, and let your story shine.".split(" ");
const ssml = labels.map((text, i) => `${i === 4 ? '<break time="650ms"/>' : i === 6 ? '<break time="180ms"/>' : ""}<mark name="s${i}"/>${text}<mark name="e${i}"/>`).join(" ");
const chunks = [], events = [];
voice.synthesize(ssml, (samples, batch) => { chunks.push(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)); events.push(...batch); });
const pcm = Buffer.concat(chunks), rate = voice.get_samplerate();
const leadingMs = 300, durationMs = 8000, audio = Buffer.alloc(Math.round(durationMs * rate / 1000) * 2);
const offset = Math.round(leadingMs * rate / 1000) * 2;
if (offset + pcm.length > audio.length) throw new Error("Review a shorter fixture script; never truncate its speech.");
pcm.copy(audio, offset);
const words = labels.map((text, i) => {
  const start = events.find(event => event.type === "mark" && event.id === `s${i}`);
  const end = events.find(event => event.type === "mark" && event.id === `e${i}`);
  if (!start || !end || end.audio_position <= start.audio_position) throw new Error(`Missing measured timing: ${text}`);
  return { text, startMs: start.audio_position + leadingMs, endMs: end.audio_position + leadingMs };
});
const header = Buffer.alloc(44);
header.write("RIFF"); header.writeUInt32LE(36 + audio.length, 4); header.write("WAVEfmt ", 8); header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(audio.length, 40);
await writeFile(join(root, "voice.wav"), Buffer.concat([header, audio]), { flag: "wx" });
await writeFile(join(root, "transcript.json"), JSON.stringify({ schemaVersion: 1, provider: "fixture", model: "espeak-ng-0.3.0-marks-reviewed-v1", language: "en", durationMs, words }, null, 2), { flag: "wx" });
await writeFile(join(root, "timing-events.json"), JSON.stringify(events, null, 2), { flag: "wx" });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="854"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#182234"/><stop offset="1" stop-color="#2e203b"/></linearGradient><linearGradient id="screen" x2="0" y2="1"><stop stop-color="#9582e1"/><stop offset="1" stop-color="#63558c"/></linearGradient></defs><rect width="480" height="854" fill="url(#bg)"/><circle cx="442" cy="341" r="180" fill="#746a9c" opacity=".1"/><text x="42" y="72" fill="#c9b6ec" font-family="Arial" font-size="13" letter-spacing="3">UGC PILOT · STYLE EXAMPLES</text><text x="42" y="133" fill="#fff" font-family="Arial" font-size="38" font-weight="bold">One story.</text><text x="42" y="181" fill="#fff" font-family="Arial" font-size="38" font-weight="bold">Seven ways.</text><g transform="translate(152 253) rotate(-8 89 130)"><rect x="-7" y="-7" width="190" height="302" rx="28" fill="#100f19"/><rect width="176" height="288" rx="22" fill="url(#screen)"/><rect x="54" y="9" width="68" height="12" rx="6" fill="#15121e"/><circle cx="88" cy="101" r="41" fill="#ece1d1"/><path d="M57 104L81 121L119 78" fill="none" stroke="#72619b" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><rect x="26" y="161" width="124" height="9" rx="4" fill="#e8ddfa"/><rect x="43" y="185" width="90" height="6" rx="3" fill="#e8ddfa" opacity=".55"/><rect x="25" y="228" width="126" height="27" rx="13" fill="#ece1d1"/></g><path d="M45 605H435" stroke="#756483" opacity=".35"/><text x="42" y="800" fill="#b9acc5" font-family="Arial" font-size="12" letter-spacing="2">SAME CLIP · SAME SPOKEN WORDS</text></svg>`;
await writeFile(join(root, "scene.svg"), svg, { flag: "wx" });
await sharp(Buffer.from(svg)).png().toFile(join(root, "scene.png"));
execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-n", "-loop", "1", "-i", join(root, "scene.png"), "-i", join(root, "voice.wav"),
  "-t", "8", "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", join(root, "source.mp4")], { windowsHide: true });
console.log(JSON.stringify({ durationMs, words, speechMs: pcm.length / 2 / rate * 1000 }, null, 2));
