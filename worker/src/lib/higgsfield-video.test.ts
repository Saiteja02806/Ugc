import assert from "node:assert/strict";
import test from "node:test";
import { buildHiggsfieldVideoRequest } from "./higgsfield-video.js";

const base = { aspectRatio: "9:16" as const, durationSeconds: 5, resolution: "720p" as const, prompt: "Use the audio as the timing reference" };
const audio = "https://storage.example.com/sound.mp3";
const image = "https://storage.example.com/portrait.jpg";
const video = "https://storage.example.com/input.mp4";

test("routes audio-only and image-plus-audio through reference-to-video with audio_urls", () => {
  for (const images of [[], [image]]) {
    const request = buildHiggsfieldVideoRequest({ ...base, referenceImageUrls: images, referenceAudioUrls: [audio] });
    assert.equal(request.model, "bytedance/seedance-2.5/reference-to-video");
    assert.ok("audio_urls" in request.input);
    assert.deepEqual(request.input.audio_urls, [audio]);
    assert.equal(request.input.duration, 5);
    assert.equal(request.input.aspect_ratio, "9:16");
    assert.equal(request.input.generate_audio, true);
    if (images.length) assert.deepEqual(request.input.image_urls, images);
  }
});
test("keeps the edit video and all image/audio inputs in a video-edit request", () => {
  const request = buildHiggsfieldVideoRequest({ ...base, referenceVideoUrl: video, referenceImageUrls: [image], referenceAudioUrls: [audio] });
  assert.equal(request.model, "bytedance/seedance-2.5/video-edit");
  assert.ok("video_url" in request.input);
  assert.ok("image_urls" in request.input);
  assert.ok("audio_urls" in request.input);
  assert.equal(request.input.video_url, video);
  assert.deepEqual(request.input.image_urls, [image]);
  assert.deepEqual(request.input.audio_urls, [audio]);
  assert.equal(Object.hasOwn(request.input, "duration"), false);
});
test("preserves existing text-only, single-image, and multiple-image routes", () => {
  assert.equal(buildHiggsfieldVideoRequest(base).model, "bytedance/seedance-2.5/text-to-video");
  assert.equal(buildHiggsfieldVideoRequest({ ...base, referenceImageUrl: image }).model, "bytedance/seedance-2.5/image-to-video");
  assert.equal(buildHiggsfieldVideoRequest({ ...base, referenceImageUrls: [image, `${image}?2`] }).model, "bytedance/seedance-2.5/reference-to-video");
});
test("rejects insecure audio URLs and excessive combined references before submission", () => {
  assert.throws(() => buildHiggsfieldVideoRequest({ ...base, referenceAudioUrls: ["http://example.com/audio.mp3"] }), /HTTPS/);
  assert.throws(() => buildHiggsfieldVideoRequest({ ...base, referenceImageUrls: Array(29).fill(image), referenceVideoUrl: video, referenceAudioUrls: [audio] }), /Too many/);
  assert.throws(() => buildHiggsfieldVideoRequest({ ...base, durationSeconds: 31, referenceAudioUrls: [audio] }), /between 4 and 30/);
});
