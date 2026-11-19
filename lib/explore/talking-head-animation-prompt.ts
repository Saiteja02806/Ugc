type TalkingHeadAnimation = {
  directions: string; durationSeconds: number; generateAudio: boolean;
  voiceReference?: boolean; voiceIdentityPhotoCount?: number; identityPhotoCount?: number;
  spokenScript?: string; removePhysicalText?: boolean;
};

/** Keep the timing and delivery cues when the user supplies replacement words. */
export function talkingHeadPerformanceDirections(directions: string) {
  return directions
    .replace(/(?:Speak this line out loud:|SPOKEN SCRIPT:)\s*"[^"\n]+"[.!]?\s*/giu, "")
    .replace(/\bspeaks once, out loud:\s*“[^”]+”/giu, "speaks the approved line once")
    .trim();
}

export function buildTalkingHeadAnimationPrompt(input: TalkingHeadAnimation) {
  const directions = input.spokenScript === undefined ? input.directions.trim() : talkingHeadPerformanceDirections(input.directions);
  const photoCount = input.voiceReference ? input.voiceIdentityPhotoCount : input.identityPhotoCount;
  return [
    input.voiceReference
      ? `Create a ${input.durationSeconds}s talking-head hook. Image 1 guides the person, opening pose and scene as a visual reference. Audio 1 guides voice and delivery only. Ignore its words and music.`
      : `Animate the approved starting image into a ${input.durationSeconds}s talking-head hook. Start with its pose and composition.`,
    ...(photoCount ? [`Image 2 is the main face identity reference${photoCount > 1 ? `. Images 3–${photoCount + 1} support that identity` : ""}. Use Image 1 for the scene, pose, clothes and light.`] : []),
    "Keep the same face, hair, clothes, lighting and scene. Skip demo cutaways and added graphics.",
    directions,
    ...(input.spokenScript !== undefined ? [`APPROVED SPOKEN SCRIPT (say exactly once):\n${JSON.stringify(input.spokenScript.trim())}`] : []),
    input.removePhysicalText ? "Keep captions, readable text, labels, logos and watermarks out of the scene." : "Keep physical text from the image. Add no captions or logos.",
    input.generateAudio
      ? `SOUND SETTING: ON. Lip-sync ${input.spokenScript === undefined ? "the requested dialogue" : "only the approved words"}. Never speak scene directions or add words.`
      : "SOUND SETTING: OFF. Keep the video silent with natural mouth movement.",
    ...(input.generateAudio ? [input.voiceReference
      ? "VOICE DELIVERY: Follow Audio 1's vocal character, rhythm, emphasis, pauses and emotional delivery; adapt them naturally to the spoken words and scene."
      : "VOICE DELIVERY: Keep one natural human voice; vary pitch, pace, emphasis and pauses to fit the emotion."] : []),
  ].filter(Boolean).join("\n\n");
}
