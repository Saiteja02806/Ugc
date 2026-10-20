type InstagramCaptionPreviewProps = {
  caption: string;
  onEdit?: () => void;
  title?: string;
};

export function InstagramCaptionPreview({
  caption,
  onEdit,
  title = "Instagram caption preview",
}: InstagramCaptionPreviewProps) {
  // Scheduling trims the edges of a caption but preserves its line breaks.
  const publishedCaption = caption.trim();

  return (
    <section
      aria-label={title}
      className="min-w-0 rounded-card border border-border bg-card px-4 py-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-control px-2 py-1 text-xs font-semibold text-primary hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Edit caption
          </button>
        ) : null}
      </div>
      {publishedCaption ? (
        <p
          tabIndex={0}
          className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-foreground [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {publishedCaption}
        </p>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          No Instagram caption added.
        </p>
      )}
    </section>
  );
}
