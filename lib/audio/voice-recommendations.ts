import type { AudioVoice } from "./types";

export type AudioContentPurpose = "social" | "ugc_ad" | "product_demo" | "storytelling";
export type VoiceLibraryFocus = AudioContentPurpose | "all" | "conversational" | "advertisement" | "characters";

// These are UGC Pilot content intentions, not additional provider voice libraries.
export const AUDIO_CONTENT_PURPOSES = [
  { id: "social", label: "Social media", heading: "Voices for your next post", guidance: "A strong opening, one clear idea, a reason to keep watching.", structure: "Hook → main idea → closing line", placeholder: "What will make someone stop scrolling? Write your opening line, then the idea you want to share…", example: "Here's a quick way to [solve a problem]. Start with [first step], then [next step]. Save this for the next time you need it." },
  { id: "ugc_ad", label: "UGC ads", heading: "Voices for creator-style ads", guidance: "Keep it conversational. Introduce the product, explain the benefit, and close with a clear action.", structure: "Hook → product benefit → call to action", placeholder: "Open with the problem your product solves. Explain the benefit in everyday language, then add your call to action…", example: "Looking for a way to [solve a problem]? Meet [product]. It helps you [product benefit] with [key feature]. Take a closer look at [website or offer]." },
  { id: "product_demo", label: "Product demos", heading: "Voices for clear product walkthroughs", guidance: "Show what the product does, one step at a time. Match each line to what appears on screen.", structure: "Introduce → show the steps → explain the result", placeholder: "Introduce the product, walk through the steps, and explain what the viewer will see…", example: "Here's how to use [product]. First, [step one]. Next, [step two]. You'll see [observable result]. That's how [feature] works." },
  { id: "storytelling", label: "Storytelling", heading: "Voices for stories worth sharing", guidance: "Set the scene, build the story, and leave the viewer with a takeaway.", structure: "Opening → story → takeaway", placeholder: "Set the scene. What happened, why did it matter, and what should the viewer take away?…", example: "It started with [a real moment or problem]. Then [what happened next]. The lesson? [your takeaway]." },
] as const satisfies ReadonlyArray<{ id: AudioContentPurpose; label: string; heading: string; guidance: string; structure: string; placeholder: string; example: string }>;

type VoiceTrait = "social" | "conversational" | "advertisement" | "educational" | "narration" | "ugc_ad" | "product_demo" | "characters";
export type VoiceRecommendation = { voice: AudioVoice; score: number; reason: string; match: "direct" | "supporting" | "other" };
const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, "_");
const TRAITS: Record<VoiceTrait, string[]> = {
  social: ["social", "social_media"], conversational: ["conversation", "conversational"],
  advertisement: ["advertisement", "advertising", "commercial", "promotional"],
  educational: ["informative_educational", "educational", "informative", "explainer"],
  narration: ["narrative_story", "narration", "storytelling", "audiobook"],
  ugc_ad: ["ugc_ad", "ugc_ads"], product_demo: ["product_demo", "product_demos"],
  characters: ["characters_animation", "characters", "animation", "gaming"],
};
const PURPOSE_TRAITS: Record<AudioContentPurpose, Array<[VoiceTrait, number, string]>> = {
  social: [["social", 100, "Social media · short-form voiceovers"], ["conversational", 65, "Conversational · natural delivery"], ["advertisement", 45, "Advertising · promotional delivery"], ["educational", 30, "Informative · helpful explanations"]],
  ugc_ad: [["ugc_ad", 110, "UGC ads · creator-style delivery"], ["advertisement", 100, "Advertising · hooks, benefits and CTAs"], ["conversational", 80, "Conversational · creator-style delivery"], ["social", 65, "Social media · short-form voiceovers"]],
  product_demo: [["product_demo", 110, "Product demos · guided walkthroughs"], ["educational", 100, "Informative · clear explanations"], ["conversational", 65, "Conversational · approachable walkthroughs"], ["advertisement", 40, "Advertising · product introductions"]],
  storytelling: [["narration", 100, "Narration · storytelling delivery"], ["conversational", 45, "Conversational · personal stories"], ["educational", 30, "Informative · explanatory stories"]],
};

function traitsFor(voice: AudioVoice): Set<VoiceTrait> {
  const raw = voice.labels.use_case || "";
  const labels = raw.split(/[,;|]/).map(normalize);
  const traits = new Set<VoiceTrait>();
  for (const [trait, aliases] of Object.entries(TRAITS)) {
    if (aliases.some(alias => labels.includes(alias))) traits.add(trait as VoiceTrait);
  }
  // Descriptions can suggest a fit only when structured purpose metadata is absent.
  if (!raw.trim()) {
    const description = voice.description.toLowerCase();
    if (/social media|short.form|tiktok/.test(description)) traits.add("social");
    if (/conversational|conversation/.test(description)) traits.add("conversational");
    if (/advertis|commercial|promotional/.test(description)) traits.add("advertisement");
    if (/educational|informative|explainer/.test(description)) traits.add("educational");
    if (/narration|storytelling|audiobook/.test(description)) traits.add("narration");
    if (/character|animation|gaming/.test(description)) traits.add("characters");
  }
  return traits;
}

export function rankVoicesForPurpose(voices: readonly AudioVoice[], purpose: AudioContentPurpose): VoiceRecommendation[] {
  return voices.map<VoiceRecommendation>(voice => {
    const traits = traitsFor(voice);
    const fit = PURPOSE_TRAITS[purpose].find(([trait]) => traits.has(trait));
    const fromDescription = !voice.labels.use_case?.trim();
    const score = fit ? (fromDescription ? Math.min(fit[1], 25) : fit[1]) : 0;
    return { voice, score, reason: fit ? `${fromDescription ? "Suggested from description · " : ""}${fit[2]}` : "Explore this voice", match: score >= 100 ? "direct" : score > 0 ? "supporting" : "other" };
  }).sort((a, b) => Number(b.voice.available) - Number(a.voice.available) || b.score - a.score || a.voice.name.localeCompare(b.voice.name) || a.voice.id.localeCompare(b.voice.id));
}

export function selectInitialVoice(voices: readonly AudioVoice[], purpose: AudioContentPurpose = "social", previousId = ""): string {
  if (voices.some(voice => voice.id === previousId)) return previousId;
  return rankVoicesForPurpose(voices, purpose)[0]?.voice.id || "";
}

// A focus changes the display order, never removes provider records. Search and
// explicit language/type filters are applied separately by the library.
export function rankVoicesForLibraryFocus(voices: readonly AudioVoice[], focus: VoiceLibraryFocus): VoiceRecommendation[] {
  if (focus === "all") return rankVoicesForPurpose(voices, "social");
  if (focus in PURPOSE_TRAITS) return rankVoicesForPurpose(voices, focus as AudioContentPurpose);
  return rankVoicesForPurpose(voices, "social").map<VoiceRecommendation>(item => {
    if (!traitsFor(item.voice).has(focus as VoiceTrait)) return item;
    const structured = Boolean(item.voice.labels.use_case?.trim());
    const reason = focus === "characters" ? "Characters · expressive delivery" : focus === "advertisement" ? "Advertising · promotional delivery" : "Conversational · natural delivery";
    return { ...item, reason, score: structured ? 110 : 26, match: structured ? "direct" : "supporting" };
  }).sort((a, b) => Number(b.voice.available) - Number(a.voice.available) || b.score - a.score || a.voice.name.localeCompare(b.voice.name) || a.voice.id.localeCompare(b.voice.id));
}

// Studio deliberately offers at most two small pages. Lower-confidence matches
// and the complete catalogue remain accessible through the existing library.
export function getStudioVoiceShortlist(voices: readonly AudioVoice[], purpose: AudioContentPurpose): AudioVoice[] {
  const presets = voices.filter(voice => !voice.private);
  const hasUsablePresets = presets.some(voice => voice.available);
  const minimumScore = purpose === "ugc_ad" || purpose === "product_demo" ? 65 : 45;
  return rankVoicesForPurpose(presets, purpose)
    .filter(item => item.score >= minimumScore && (!hasUsablePresets || item.voice.available))
    .slice(0, 12).map(item => item.voice);
}
