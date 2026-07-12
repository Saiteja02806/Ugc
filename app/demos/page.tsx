import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Library",
  description: "Manage uploaded posts and saved content.",
};

export default function DemosPage() {
  redirect("/library?tab=posts");
}
