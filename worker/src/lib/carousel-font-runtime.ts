import { spawnSync } from "node:child_process";

export function getCarouselFontRuntimeInfo() {
  const result = spawnSync(
    "fc-match",
    ["-f", "%{family}|%{style}|%{file}", "Geist"],
    { encoding: "utf8", timeout: 5_000 },
  );
  const [family, style, file] = (result.stdout ?? "").trim().split("|");

  return {
    available: result.status === 0 && family?.toLowerCase().includes("geist"),
    family: family || null,
    file: file || null,
    style: style || null,
  };
}
