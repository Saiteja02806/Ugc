import type { Metadata } from "next";
import { Suspense } from "react";
import { CharacterWorkspace } from "@/components/characters/character-workspace";

export const metadata: Metadata = {
  title: "Build AI influencer",
  description: "Create and save your own realistic social media influencer.",
};

type PageProps = {
  searchParams: Promise<{ preview?: string }>;
};

export default function BuildCharacterPage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV !== "development") return <CharacterWorkspace />;
  return <Suspense fallback={<CharacterWorkspace />}><BuildCharacterPreview searchParams={searchParams} /></Suspense>;
}

async function BuildCharacterPreview({ searchParams }: PageProps) {
  const query = await searchParams;
  return <CharacterWorkspace localPreview={query.preview === "1"} />;
}
