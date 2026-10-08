import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Creator Shows App on Phone",
  robots: { index: false, follow: false },
};

export default function CreatorPhonePage() {
  notFound();
}
