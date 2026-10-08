import type { Metadata } from "next";
import { notFound } from "next/navigation";
export const metadata: Metadata = { title: "Audio generation", description: "Generate speech, preview voices and save your recordings." };
export default function AudioGenerationPage() { notFound(); }
