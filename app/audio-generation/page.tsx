import type { Metadata } from "next";
import { AudioGenerationWorkspace } from "@/components/audio/audio-generation-workspace";
export const metadata: Metadata = { title: "Audio generation", description: "Generate speech, preview voices and save your recordings." };
export default function AudioGenerationPage() { return <AudioGenerationWorkspace />; }
