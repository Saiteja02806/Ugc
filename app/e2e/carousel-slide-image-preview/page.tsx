import { notFound } from "next/navigation";
import { CarouselSlideImagePreview } from "./preview";

export default function CarouselSlideImagePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CarouselSlideImagePreview />;
}
