export function getVideoPreviewAspectRatio({
  height,
  ratio,
  width,
}: {
  height: number | null;
  ratio: string;
  width: number | null;
}) {
  if (width && height && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return `${width} / ${height}`;
  }
  return /^\d+:\d+$/.test(ratio) ? ratio.replace(":", " / ") : "9 / 16";
}
