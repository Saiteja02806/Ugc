"use client";

import { useEffect, useRef, useState } from "react";
import { EditorFields, EditorPreview } from "@/components/trending/trending-creative-editor";
import { CarouselSlideImageSection } from "@/components/trending/carousel-slide-image-section";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { readAIStudioReferenceMetadata } from "@/lib/ai-studio/reference-media-upload";
import type { MediaAsset } from "@/lib/media/types";
import type { TrendingCarouselEditContent, TrendingCreativeEditContent } from "@/lib/trending/creative-edit-contract";
import type { TrendingFeedItem } from "@/lib/trending/feed-items";
import { applyCarouselSlideImage, restoreOriginalCarouselBackground } from "@/lib/trending/carousel-slide-image-selection";

const initial: TrendingCarouselEditContent = {
  format: "carousel", version: "trending-creative-edit-v1",
  slides: Array.from({ length: 6 }, (_, index) => {
    const url = `/marketing/showcase-part2/slideshow/image_${index % 3}.jpg`;
    return {
      slideId: `slide-${index + 1}`, slideNumber: index + 1, structureId: "structure_2", renderFormat: "4:5",
      backgroundAssetId: `original-${index + 1}`, originalBackgroundAssetId: `original-${index + 1}`,
      backgroundUrl: url, originalBackgroundUrl: url, renderedUrl: url,
      visualRole: index === 0 ? "hook" : "human", originalVisualRole: index === 0 ? "hook" : "human",
      headline: index === 0 ? "Why your daily plan keeps falling apart" : "Make room for what matters",
      subtext: index === 0 ? "" : "Choose one useful next step.\n\nGive it your full attention.",
      hasHeading: index !== 0, ctaText: "", textPosition: { x: .5, y: .5 },
      productVisualEligibility: "forbidden", storyLayoutVariant: "story_overlay_only", storyTextTreatment: "overlay",
    };
  }),
};
const item: TrendingFeedItem = { id: "preview", assignmentId: "preview", creativeId: "preview", feedItemId: "preview",
  format: "carousel", position: 0, readiness: "preview_ready", source: "new", creative: {
    candidateIndex: 0, carouselId: "preview", categorySlug: null, generationBatchId: "preview", projectId: "preview",
    readySlideCount: 6, selectedAngle: "Image upload preview", slideCount: 6, status: "completed",
    thumbnailUrl: initial.slides[0].renderedUrl, updatedAt: "2026-10-10T00:00:00Z",
    slides: initial.slides.map(slide => ({ slideNumber: slide.slideNumber, headline: slide.headline,
      renderedUrl: slide.renderedUrl, slideType: "body", status: "ready", subtext: slide.subtext })),
  } };

export function CarouselSlideImagePreview() {
  const [content, setContent] = useState<TrendingCreativeEditContent | null>(initial);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [delay, setDelay] = useState(false);
  const [fail, setFail] = useState(false);
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const finish = useRef<(() => void) | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => {
    const createdUrls = urls.current;
    return () => { createdUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, []);
  if (content?.format !== "carousel") return null;
  async function localUpload(file: File): Promise<MediaAsset> {
    if (delay) await new Promise<void>(resolve => { finish.current = resolve; });
    if (fail) throw new Error("Test upload failed. Try again.");
    const metadata = await readAIStudioReferenceMetadata(file, "image");
    const url = URL.createObjectURL(file); urls.current.push(url);
    return { ...metadata, id: crypto.randomUUID(), collection: "image", status: "ready", url,
      title: file.name, fileName: file.name, fileSizeBytes: file.size, mimeType: file.type, sourceType: "upload",
      projectId: "trending-carousel-slide", metadata: {}, parentAssetId: null, sourceRecordId: null,
      thumbnailUrl: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }
  return <main className="min-h-dvh bg-background text-foreground">
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent showCloseButton={!busy} className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Edit creative</DialogTitle>
          <DialogDescription>Local slideshow editor preview. Uploads stay in this browser; no API or storage writes.</DialogDescription>
          <div className="flex flex-wrap gap-3 text-xs">
            <label><input type="checkbox" checked={delay} onChange={event => setDelay(event.target.checked)} /> Delay test upload</label>
            <label><input type="checkbox" checked={fail} onChange={event => setFail(event.target.checked)} /> Fail test upload</label>
            {busy && delay ? <button onClick={() => { finish.current?.(); finish.current = null; }}>Finish test upload</button> : null}
          </div>
        </DialogHeader>
        <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]">
          <div className="border-b border-border bg-muted/25 p-6 lg:border-b-0 lg:border-r">
            <EditorPreview content={content} edit={null} fallbackHookPreviewUrl={null} initialContent={null}
              item={item} onContentChange={setContent} sourcePreview={null} activeSlideIndex={index} />
          </div>
          <div className="min-w-0 p-6">
            <EditorFields content={content} activeSlideIndex={index} onActiveSlideIndexChange={setIndex} onContentChange={setContent} />
            <CarouselSlideImageSection slide={content.slides[index]} onBusyChange={setBusy} uploadImage={localUpload}
              onUploaded={(id, asset) => { setContent(current => applyCarouselSlideImage(current, id, asset)); setSaved(false); }}
              onRestore={id => { setSaved(false); setContent(current => current?.format === "carousel" ? { ...current,
                slides: current.slides.map(slide => slide.slideId === id ? restoreOriginalCarouselBackground(slide) : slide) } : current); }} />
            <p role="status" className="mt-4 text-xs text-muted-foreground">{content.slides.filter(slide => slide.backgroundAssetId !== slide.originalBackgroundAssetId).length} of 6 images replaced{saved ? " · Saved locally" : ""}</p>
          </div>
        </div>
        <DialogFooter className="m-0 shrink-0 rounded-none bg-card px-6 py-4">
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={busy} onClick={() => setSaved(true)}>Confirm and save creative edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {!open ? <Button onClick={() => setOpen(true)}>Reopen preview editor</Button> : null}
  </main>;
}
