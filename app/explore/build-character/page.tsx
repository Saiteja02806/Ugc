import type { Metadata } from "next";
import { CharacterWorkspace } from "@/components/characters/character-workspace";

export const metadata: Metadata = {
  title: "Build AI character",
  description: "Create and save your own realistic social media influencer.",
};

export default async function BuildCharacterPage({ searchParams }: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const query = await searchParams;
  return <CharacterWorkspace localPreview={process.env.NODE_ENV === "development" && query.preview === "1"} />;
}
