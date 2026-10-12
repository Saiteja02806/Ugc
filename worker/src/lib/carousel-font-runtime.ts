import { spawnSync } from "node:child_process";

export function getCarouselFontRuntimeInfo() {
  const result = spawnSync(
    "fc-match",
    ["-f", "%{family}|%{style}|%{file}", "Inter:style=Medium"],
    { encoding: "utf8", timeout: 5_000 },
  );
  const [family, style, file] = (result.stdout ?? "").trim().split("|");

  return {
    available: result.status === 0 && family?.split(",").some((name) => /^(inter|inter variable)$/.test(name.trim().toLowerCase())),
    family: family || null,
    file: file || null,
    style: style || null,
  };
}
